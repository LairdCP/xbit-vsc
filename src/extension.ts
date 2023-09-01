// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import * as path from 'path'
import { PyocdInterface } from './lib/pyocd'
// const SerialPortProvider = require('./serial-port.lib')
// const commands = require('./commands')
import { UsbDevicesProvider } from './providers/usb-devices.provider'
import { MemFS } from './providers/file-system.provider'
import { UsbDeviceFile } from './lib/usb-device-file.class'
import { UsbDevice } from './lib/usb-device.class'

import { UsbDeviceWebViewProvider } from './providers/usb-device-webview.provider'

let usbDevicesProvider: UsbDevicesProvider

export function activate (context: vscode.ExtensionContext): void {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "xbit-vsc" is now active!')

  const memFs = new MemFS()
  context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }))
  memFs.createDirectory(vscode.Uri.parse('memfs:/serial'))
  memFs.createDirectory(vscode.Uri.parse('memfs:/serial/dev'))

  const outputChannel = vscode.window.createOutputChannel('xbit-vsc')
  const pyocdInterface = new PyocdInterface(context, outputChannel)
  usbDevicesProvider = new UsbDevicesProvider(context, pyocdInterface)

  vscode.window.registerTreeDataProvider('usbDevices', usbDevicesProvider)
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.refreshEntry', () => {
    // clear the cached devices list to hard refresh
    usbDevicesProvider.usbDeviceNodes.length = 0
    usbDevicesProvider.hiddenUsbDeviceNodes.length = 0
    usbDevicesProvider.refresh()
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.createDeviceFile', async (usbDevice: UsbDevice) => {
    // create a new file object with unamed file
    const fileName = await vscode.window.showInputBox()
    // check if the file already exists with the same filename. If it does, append a number to the filename?
    // create a new file object with named file
    if (fileName !== undefined) {
      const filePath = path.join('/', fileName)
      await usbDevicesProvider.createFile(usbDevice, filePath)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.renameDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    // create a new file object with unamed file
    const newFileName = await vscode.window.showInputBox({
      value: usbDeviceFile.label
    })
    if (newFileName !== undefined) {
      await usbDevicesProvider.renameFile(usbDeviceFile, newFileName)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.deleteDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    // delete the file
    await usbDevicesProvider.deleteFile(usbDeviceFile)
    try {
      await memFs.delete(usbDeviceFile.uri)
      outputChannel.appendLine(`Deleted File ${usbDeviceFile.label}\n`)
    } catch (error: any) {
      outputChannel.appendLine(`Error Deleting File ${String(error.message)}\n`)
    }
  }))

  // called when a python file on a connected device is selected
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.openDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    // e.command.arguments[0].label is the file selected
    // e.command.arguments[1].main is the device selected
    outputChannel.appendLine(`Opening File ${usbDeviceFile.label}\n`)
    outputChannel.show()

    try {
      // if file is already open, switch to it
      memFs.stat(usbDeviceFile.uri)
      await vscode.window.showTextDocument(usbDeviceFile.uri)
      outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
      return
    } catch (error: any) {
      outputChannel.appendLine(`Error Opening File ${String(error.message)}\n`)
    }

    // open file
    const result: string = await usbDeviceFile.readFileFromDevice()
    const fileData = Buffer.from(result, 'hex')
    try {
    // check if directory exists in memfs
      memFs.stat(usbDeviceFile.parentDevice.uri)
    } catch (error) {
      memFs.createDirectory(usbDeviceFile.parentDevice.uri)
    }
    try {
      memFs.writeFile(usbDeviceFile.uri, fileData, { create: true, overwrite: true })
      await vscode.window.showTextDocument(usbDeviceFile.uri)
      outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
    } catch (error: any) {
      outputChannel.appendLine(`Error Opening File ${String(error.message)}\n`)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHexFile', (usbDevice: UsbDevice) => {
    // console.log('write hex file', context, selectedContext)
    // selectedContext[0] is the file selected
    // if not connected to a device, return error
    outputChannel.appendLine(`write hex file ${usbDevice.name}\n`)
    outputChannel.show()
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.connectUsbDevice', async (usbDevice: UsbDevice) => {
    // console.log('connect to usb device', context)
    outputChannel.appendLine(`connecting to device ${usbDevice.name}\n`)
    outputChannel.show()
    try {
      await usbDevice.connect()
      await usbDevice.createTerminal(context)
      usbDevicesProvider.refresh()
      await vscode.window.showInformationMessage(`Port Connected: ${String(usbDevice.options.path)}`)
    } catch (error: any) {
      await vscode.window.showInformationMessage(`Error Connection to Port: ${String(error.message)}`)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', async (usbDevice: UsbDevice) => {
    // console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${usbDevice.name}\n`)
    outputChannel.show()
    try {
      await usbDevice.disconnect()
      await vscode.window.showInformationMessage('Port Disconnected')
      usbDevice.terminal.remove()
      usbDevicesProvider.refresh()
    } catch (error: any) {
      await vscode.window.showInformationMessage(`Error closing port: ${String(error.message)}`)
    }
  }))

  const options = {
    treeDataProvider: usbDevicesProvider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('usbDevices', options)

  tree.onDidChangeSelection(async (e: vscode.TreeViewSelectionChangeEvent<any>) => {
    // console.log('onDidChangeSelection', e) // breakpoint here for debug
    console.log('onDidChangeSelection', e.selection[0])
    // if (usbDeviceWebViewProvider.webview !== undefined) {
    //   if (e.selection.length > 0) {
    //     await usbDeviceWebViewProvider.webview.postMessage({
    //       command: 'setSelected',
    //       device: {
    //         serialNumber: e.selection[0].serialNumber,
    //         path: e.selection[0].options.path,
    //         name: e.selection[0].name,
    //         manufacturer: e.selection[0].options.manufacturer,
    //         baudRate: e.selection[0].baudRate,
    //         connected: e.selection[0].connected
    //       }
    //     })
    //   } else {
    //     await usbDeviceWebViewProvider.webview.postMessage({
    //       command: 'setSelected',
    //       device: null
    //     })
    //   }
    //  }
  })

  tree.onDidCollapseElement(e => {
    // console.log('onDidCollapseElement', e) // breakpoint here for debug
  })

  tree.onDidChangeVisibility(e => {
    // console.log('onDidChangeVisibility', e) // breakpoint here for debug
  })

  tree.onDidExpandElement(e => {
    // console.log('onDidExpandElement', e) // breakpoint here for debug
  })

  // tree is a disposable object so we need to push it to subscriptions
  context.subscriptions.push(tree)

  const usbDeviceWebViewProvider = new UsbDeviceWebViewProvider(context.extensionUri, 'usbDevice.optionsView')
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(usbDeviceWebViewProvider.viewType, usbDeviceWebViewProvider))

  vscode.workspace.onDidChangeTextDocument(() => {
    // console.log('Changed.', e);
  })

  vscode.workspace.onDidCloseTextDocument(() => {
    // console.log('Closed.', e);
  })

  vscode.workspace.onDidSaveTextDocument(async (textDocument: vscode.TextDocument) => {
    console.log('Saved.', textDocument)
    // let usbDeviceFile = null
    // // find the deviceFile by uri

    // const iterator = usbDevicesProvider.treeCache.entries()
    // for (const [key, value] of iterator) {
    //   for (const i of value) {
    //     if (textDocument.uri.toString() === i.uri.toString()) {
    //       usbDeviceFile = usbDevicesProvider.treeCache[k][i]
    //       break
    //     }
    //   }
    // }
    // if (!usbDeviceFile) {
    //   return
    // }
    // const dataToWrite = textDocument.getText()
    // usbDeviceFile.writeFileToDevice(dataToWrite)
    //   .then(() => {
    //     // OK result
    //     outputChannel.appendLine(`Saved ${usbDeviceFile.name}\n`)
    //     outputChannel.show()
    //   }).catch((error) => {
    //     outputChannel.appendLine(`Error saving: ${String(error.message)}\n`)
    //     outputChannel.show()
    //   })
  })

  // context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHex', (usbDevice, file) => {
  // if (usbDevice.ifc.connected) { usbDevice.ifc.disconnect() }
  // make pyocd write hex file based on the usbDevice and file info
  // })
}

// This method is called when your extension is deactivated
export function deactivate (): void {
  usbDevicesProvider.disconnectAll()
}

module.exports = {
  activate,
  deactivate
}
