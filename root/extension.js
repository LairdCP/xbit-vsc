// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
// const SerialPortProvider = require('./serial-port.lib')
// const commands = require('./commands')
const UsbDevicesProvider = require('./providers/usb-devices.provider')
const UsbDeviceWebViewProvider = require('./providers/usb-device-webview.provider')
const { MemFSProvider } = require('./providers/file-system.provider')
const ReplTerminal = require('./lib/repl-terminal.class')
const PyocdInterface = require('./lib/pyocd')
// const fs = require('fs/promises')

// function getPath(file, context, webView) {
//   // if (webView) {
//   //   let uri = Uri.file(context.asAbsolutePath(path.join('misc', file)));
//   //   return webView.asWebviewUri(uri).toString();
//   // }
//   return context.asAbsolutePath(path.join('misc', file));
// }

let usbDevicesProvider
/**
 * @param {vscode.ExtensionContext} context
 */
function activate (context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "xbit-vsc" is now active!')

  const memFs = new MemFSProvider()
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

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.createDeviceFile', (usbDevice) => {
    // create a new file object with unamed file
    vscode.window.showInputBox().then((fileName) => {
      // check if the file already exists with the same filename. If it does, append a number to the filename?
      // create a new file object with named file
      const filePath = path.join('/', fileName)
      return usbDevicesProvider.createFile(usbDevice, filePath)
    })
  }))

  const path = require('path')
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.renameDeviceFile', (usbDeviceFile) => {
    // create a new file object with unamed file
    vscode.window.showInputBox({
      value: usbDeviceFile.label
    }).then((newFileName) => {
      return usbDevicesProvider.renameFile(usbDeviceFile, newFileName)
    })
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.deleteDeviceFile', (usbDeviceFile) => {
    // delete the file
    usbDevicesProvider.deleteFile(usbDeviceFile).then(() => {
      try {
        memFs.delete(usbDeviceFile.uri)
        outputChannel.appendLine(`Deleted File ${usbDeviceFile.name}\n`)
      } catch (error) {
        outputChannel.appendLine(`Error Deleting File ${error.message}\n`)
      }
    })
  }))

  // called when a python file on a connected device is selected
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.openDeviceFile', (usbDeviceFile) => {
    // e.command.arguments[0].label is the file selected
    // e.command.arguments[1].main is the device selected
    outputChannel.appendLine(`Opening File ${usbDeviceFile.name}\n`)
    outputChannel.show()

    try {
      // if file is already open, switch to it
      memFs.stat(usbDeviceFile.uri)
      vscode.window.showTextDocument(usbDeviceFile.uri)
      outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
      return
    } catch (error) {
      outputChannel.appendLine(`Error Opening File ${error.message}\n`)
    }
    // open file
    usbDeviceFile.readFileFromDevice()
      .then((result) => {
      // convert to hex
      // loop?
        const fileData = Buffer.from(result, 'hex')
        // write file to memfs
        try {
        // check if directory exists in memfs
          memFs.stat(usbDeviceFile.parentDevice.uri)
        } catch (error) {
          memFs.createDirectory(usbDeviceFile.parentDevice.uri)
        }
        memFs.writeFile(usbDeviceFile.uri, fileData, { create: true, overwrite: true })
        vscode.window.showTextDocument(usbDeviceFile.uri)
        outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
      })
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHexFile', (usbDevice) => {
    // console.log('write hex file', context, selectedContext)
    // selectedContext[0] is the file selected
    // if not connected to a device, return error
    outputChannel.appendLine(`write hex file ${usbDevice.path}\n`)
    outputChannel.show()
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.connectUsbDevice', (usbDevice) => {
    // console.log('connect to usb device', context)
    outputChannel.appendLine(`connecting to device ${usbDevice.name}\n`)
    outputChannel.show()
    usbDevice.connect()
      .then(() => {
        usbDevice.terminal = new ReplTerminal(context, {
          name: usbDevice.path
        })
        usbDevice.terminal.onInput((data) => {
          // send line to the serial port
          if (usbDevice.connected) {
            usbDevice.lastSentHex = Buffer.from(data).toString('hex')
            usbDevice.write(data)
          }
        })
        usbDevice.ifc.on('data', (data) => {
          const hex = data.toString('hex')
          if (/^7f20/.test(hex)) {
            // Move cursor backward
            usbDevice.terminal.write('\x1b[D')
            // Delete character
            usbDevice.terminal.write('\x1b[P')
          }

          if (usbDevice.terminal) {
            usbDevice.terminal.write(data.toString())
          }
        })
        usbDevicesProvider.refresh()
        vscode.window.showInformationMessage(`Port Connected: ${usbDevice.port.path}`)
      }).catch((error) => {
        vscode.window.showInformationMessage(`Error Connection to Port: ${error.message}`)
      })
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', (usbDevice) => {
    // console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${usbDevice.name}\n`)
    outputChannel.show()
    usbDevice.disconnect().then(() => {
      vscode.window.showInformationMessage('Port Disconnected')
      if (usbDevice.terminal) {
        usbDevice.terminal.remove()
      }
      usbDevicesProvider.refresh()
    }).catch((error) => {
      vscode.window.showInformationMessage(`Error closing port: ${error.message}`)
    })
  }))

  const options = {
    treeDataProvider: usbDevicesProvider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('usbDevices', options)

  tree.onDidChangeSelection(e => {
    // console.log('onDidChangeSelection', e) // breakpoint here for debug
    console.log('e.selection[0]', e)
    if (e.selection[0]) {
      usbDeviceWebViewProvider.webview.postMessage({
        command: 'setSelected',
        device: {
          serialNumber: e.selection[0].port.serialNumber,
          path: e.selection[0].port.path,
          name: e.selection[0].port.name,
          manufacturer: e.selection[0].port.manufacturer,
          baudRate: e.selection[0].baudRate,
          connected: e.selection[0].connected
        }
      })
    } else {
      usbDeviceWebViewProvider.webview.postMessage({
        command: 'setSelected',
        device: null
      })
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

  const usbDeviceWebViewProvider = new UsbDeviceWebViewProvider(context.extensionUri, 'usbDevice.optionsView')
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(usbDeviceWebViewProvider.viewType, usbDeviceWebViewProvider))

  vscode.workspace.onDidChangeTextDocument(() => {
    // console.log('Changed.', e);
  })

  vscode.workspace.onDidCloseTextDocument(() => {
    // console.log('Closed.', e);
  })

  vscode.workspace.onDidSaveTextDocument((textDocument) => {
    let usbDeviceFile = null
    // find the deviceFile by uri
    for (const k in usbDevicesProvider.treeCache) {
      for (const i in usbDevicesProvider.treeCache[k]) {
        if (textDocument.uri.toString() === usbDevicesProvider.treeCache[k][i].uri.toString()) {
          usbDeviceFile = usbDevicesProvider.treeCache[k][i]
          break
        }
      }
    }
    if (!usbDeviceFile) {
      return
    }
    const dataToWrite = textDocument.getText()
    usbDeviceFile.writeFileToDevice(dataToWrite)
      .then(() => {
        // OK result
        outputChannel.appendLine(`Saved ${usbDeviceFile.name}\n`)
        outputChannel.show()
      }).catch((error) => {
        outputChannel.appendLine(`Error saving: ${error.message}\n`)
        outputChannel.show()
      })
  })

  // context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHex', (usbDevice, file) => {
  // if (usbDevice.ifc.connected) { usbDevice.ifc.disconnect() }
  // make pyocd write hex file based on the usbDevice and file info
  // })
}

// This method is called when your extension is deactivated
function deactivate () {
  usbDevicesProvider.disconnectAll()
}

module.exports = {
  activate,
  deactivate
}
