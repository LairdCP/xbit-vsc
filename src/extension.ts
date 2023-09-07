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

  const memFs = new MemFS()
  memFs.createDirectory(vscode.Uri.parse('memfs:/serial/'))

  context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }))

  const outputChannel = vscode.window.createOutputChannel('xbit-vsc')
  const pyocdInterface = new PyocdInterface(context, outputChannel)
  usbDevicesProvider = new UsbDevicesProvider(context, pyocdInterface)

  vscode.window.registerTreeDataProvider('usbDevices', usbDevicesProvider)
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.refreshEntry', async () => {
    // clear the cached devices list to hard refresh
    for (const usbDevice of usbDevicesProvider.usbDeviceNodes) {
      await vscode.commands.executeCommand('usbDevices.disconnectUsbDevice', usbDevice)
    }
    usbDevicesProvider.usbDeviceNodes.length = 0
    usbDevicesProvider.hiddenUsbDeviceNodes.length = 0
    usbDevicesProvider.refresh()
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.createDeviceFile', async (usbDevice: UsbDevice) => {
    if (!usbDevice.connected) {
      await vscode.commands.executeCommand('usbDevices.connectUsbDevice', usbDevice)
    }

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
    if (!usbDeviceFile.parentDevice.connected) {
      await vscode.commands.executeCommand('usbDevices.connectUsbDevice', usbDeviceFile.parentDevice)
    }

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
    if (!usbDeviceFile.parentDevice.connected) {
      await vscode.commands.executeCommand('usbDevices.connectUsbDevice', usbDeviceFile.parentDevice)
    }
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
    // if not connected, connect
    if (!usbDeviceFile.parentDevice.connected) {
      await vscode.commands.executeCommand('usbDevices.connectUsbDevice', usbDeviceFile.parentDevice)
    }
    outputChannel.appendLine(`Opening File ${usbDeviceFile.label}\n`)

    try {
      // if file is already open, switch to it
      memFs.stat(usbDeviceFile.uri)
      await vscode.window.showTextDocument(usbDeviceFile.uri)
      outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
      return
    } catch (error: any) {
      // outputChannel.appendLine(`Error Opening File ${String(error.message)}\n`)
    }

    const pathParts = usbDeviceFile.parentDevice.uri.path.split('/')
    let pathToCreate = ''
    while (pathParts.length !== 0) {
      pathToCreate = path.join(pathToCreate, pathParts.shift() as string)
      try {
      // check if directory exists in memfs
        memFs.stat(vscode.Uri.parse(pathToCreate))
      } catch (error) {
        memFs.createDirectory(vscode.Uri.parse(pathToCreate))
      }
    }

    // open file
    const result: string = await usbDeviceFile.readFileFromDevice()
    const fileData = Buffer.from(result, 'ascii')

    try {
      memFs.writeFile(usbDeviceFile.uri, fileData, { create: true, overwrite: true })
      await vscode.window.showTextDocument(usbDeviceFile.uri)
      outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
    } catch (error: any) {
      outputChannel.appendLine(`Error Opening File ${String(error.message)}\n`)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHexFile', (usbDevice: UsbDevice) => {
    // selectedContext[0] is the file selected
    // if not connected to a device, return error
    outputChannel.appendLine(`write hex file ${usbDevice.name}\n`)
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.connectUsbDevice', async (usbDevice: UsbDevice) => {
    if (usbDevice.connected) {
      return
    }
    outputChannel.appendLine(`connecting to device ${usbDevice.name}\n`)
    try {
      await usbDevice.connect()
      await usbDevice.createTerminal(context)
      usbDevice.setIconPath()
      usbDevicesProvider.refresh()
      void vscode.window.showInformationMessage(`Port Connected: ${String(usbDevice.options.path)}`)
      if (usbDeviceWebViewProvider.webview !== undefined) {
        await usbDeviceWebViewProvider.webview.postMessage({
          command: 'connected',
          device: {
            connected: true
          }
        })
      }
    } catch (error: any) {
      await vscode.window.showInformationMessage(`Error Connection to Port: ${String(error.message)}`)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', async (usbDevice: UsbDevice) => {
    if (!usbDevice.connected) {
      return
    }

    // console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${usbDevice.name}\n`)
    try {
      await usbDevice.disconnect()
      await usbDevice.destroyTerminal()
      usbDevice.setIconPath()
      usbDevicesProvider.refresh()
      void vscode.window.showInformationMessage('Port Disconnected')
      if (usbDeviceWebViewProvider.webview !== undefined) {
        await usbDeviceWebViewProvider.webview.postMessage({
          command: 'connected',
          device: {
            connected: false
          }
        })
      }
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
    if (usbDeviceWebViewProvider.webview !== undefined) {
      if (e.selection.length > 0) {
        await usbDeviceWebViewProvider.onSelected(e.selection[0])
      } else {
        await usbDeviceWebViewProvider.onDeselected()
      }
    }
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

  const usbDeviceWebViewProvider = new UsbDeviceWebViewProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(UsbDeviceWebViewProvider.viewType, usbDeviceWebViewProvider))

  vscode.workspace.onDidChangeTextDocument(() => {
    // console.log('Changed.', e);
  })

  vscode.workspace.onDidCloseTextDocument(() => {
    // console.log('Closed.', e);
  })

  vscode.workspace.onDidSaveTextDocument(async (textDocument: vscode.TextDocument) => {
    let usbDeviceFile: UsbDeviceFile | undefined
    // find the deviceFile by uri

    const iterator = usbDevicesProvider.treeCache.entries()
    for (const [, value] of iterator) {
      for (const i of value) {
        if (i.uri.path === textDocument.uri.path) {
          usbDeviceFile = i
          break
        }
      }
    }
    if (usbDeviceFile === undefined) {
      return
    }
    const dataToWrite = textDocument.getText()
    try {
      const writeResult = await usbDeviceFile.writeFileToDevice(dataToWrite)
      // OK result
      console.log('writeResult', writeResult)
      outputChannel.appendLine('Saved\n')
    } catch (error) {
      outputChannel.appendLine('Error saving\n')
    }
  })

  // context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHex', (usbDevice, file) => {
  // if (usbDevice.ifc.connected) { usbDevice.ifc.disconnect() }
  // make pyocd write hex file based on the usbDevice and file info
  // })
}

// This method is called when your extension is deactivated
export function deactivate (): void {
  usbDevicesProvider.disconnectAll().catch((error: any) => {
    console.log('error disconnecting all', error)
  })
}
