// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
// const SerialPortProvider = require('./serial-port.lib')
// const commands = require('./commands')
const UsbDevicesProvider = require('./providers/usb-devices.provider')
const UsbDeviceWebViewProvider = require('./providers/usb-device-webview.provider')
const { MemFSProvider } = require('./providers/file-system.provider')

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

  const rootPath =
  vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined

  usbDevicesProvider = new UsbDevicesProvider(rootPath, context)
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
      // rename the file with fileName
      // const oldFileName = usbDeviceFile.devPath
      const oldFileName = usbDeviceFile.devPath.split('/').pop()
      newFileName = newFileName.split('/').pop()
      console.log('oldFileName', oldFileName, 'newFileName', newFileName)
      return usbDevicesProvider.renameFile(usbDeviceFile.parentDevice, oldFileName, newFileName)
    })
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.deleteDeviceFile', (usbDeviceFile) => {
    // delete the file
    usbDevicesProvider.deleteFile(usbDeviceFile).then(() => {
      try {
        memFs.delete(usbDeviceFile.uri)
      } catch (error) {
        console.log('error', error)
      }
    })
  }))

  // called when a python file on a connected device is selected
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.openDeviceFile', (usbDeviceFile) => {
    // e.command.arguments[0].label is the file selected
    // e.command.arguments[1].main is the device selected
    outputChannel.appendLine(`opening file ${usbDeviceFile.path}\n`)
    outputChannel.show()

    try {
      // if file is already open, switch to it
      memFs.stat(usbDeviceFile.uri)
      vscode.window.showTextDocument(usbDeviceFile.uri)
      return
    } catch (error) {
      // console.log('error', error)
    }
    // open file
    usbDevicesProvider.connect(usbDeviceFile.parentDevice, { skipRefresh: true }).then(() => {
      return readFileFromDevice(usbDevicesProvider, usbDeviceFile)
    })
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

        return usbDevicesProvider.disconnect(usbDeviceFile.parentDevice)
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
    outputChannel.appendLine(`connecting to device ${usbDevice.path}\n`)
    outputChannel.show()
    usbDevicesProvider.connect(usbDevice)
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', (usbDevice) => {
    // console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${usbDevice.path}\n`)
    outputChannel.show()
    usbDevicesProvider.disconnect(usbDevice)
  }))

  const options = {
    treeDataProvider: usbDevicesProvider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('usbDevices', options)

  tree.onDidChangeSelection(e => {
    // console.log('onDidChangeSelection', e) // breakpoint here for debug
    usbDeviceWebViewProvider.webview.postMessage({ command: 'setPath', path: e.selection[0].path })
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

  vscode.workspace.onDidSaveTextDocument((usbDeviceFile) => {
    const dataToWrite = usbDeviceFile.getText()

    usbDevicesProvider.connect(usbDeviceFile.parentDevice).then(() => {
      return writeFileToDevice(usbDevicesProvider, usbDeviceFile.devPath, dataToWrite)
    }).then(() => {
      // OK result
      outputChannel.appendLine(`Saved ${usbDeviceFile.path}\n`)
      outputChannel.show()
    }).catch((error) => {
      outputChannel.appendLine(`Error saving: ${error.message}\n`)
      outputChannel.show()
    }).finally(() => {
      return usbDevicesProvider.disconnect(usbDeviceFile.parentDevice)
    })
  })
}

// This method is called when your extension is deactivated
function deactivate () {
  usbDevicesProvider.disconnectAll()
}

module.exports = {
  activate,
  deactivate
}

// given a filePath, read the file from the device in 64 byte chunks
const readFileFromDevice = (usbDevicesProvider, usbDeviceFile) => {
  const rate = 128
  let resultData = ''

  return new Promise((resolve, reject) => {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading ${usbDeviceFile.path}`,
      cancellable: true
    }, (progress, token) => {
      let cancelled = false
      token.onCancellationRequested(() => {
        cancelled = true
      })

      let data = ''
      const read = async () => {
        let result
        try {
          result = await usbDevicesProvider.writeWait(`hex(f.read(${rate}))\r`, 1000)
          // console.log('read result', result)
        } catch (error) {
          console.log('error', error)
          return Promise.reject(error)
        }

        // loop until returned bytes is less than 64
        const chunk = Buffer.from(result.slice(result.indexOf("'") + 1, result.lastIndexOf("'")), 'hex').toString('hex')
        data += chunk
        const increment = Math.round((chunk.length / usbDeviceFile.size * 2) * 100)
        progress.report({ increment, message: 'Loading File...' })

        if (chunk.length === rate * 2) {
          return read()
        } else if (cancelled) {
          return Promise.reject(new Error('cancelled'))
        } else {
          return Promise.resolve(data)
        }
      }

      // open file
      return usbDevicesProvider.writeWait(`f = open('${usbDeviceFile.devPath}', 'rb')\r`, 1000)
        .then(() => {
          return read()
        })
        .then((result) => {
          resultData = result
          // close file
          return usbDevicesProvider.writeWait('f.close()\r', 1000)
        })
        .then(() => {
          resolve(resultData)
        }).catch((error) => {
          console.timeEnd('readFileFromDevice')
          return reject(error)
        })
    })
  })
}

const writeFileToDevice = (usbDevicesProvider, usbDeviceFile, data) => {
  let offset = 0
  const write = async () => {
    try {
      const bytesToWrite = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + 50).match(/[\s\S]{2}/g) || []
      await usbDevicesProvider.writeWait(`f.write(b'\\x${bytesToWrite.join('\\x')}')\r`)
    } catch (error) {
      console.log('error', error)
      return Promise.reject(error)
    }
    offset += 50
    if (offset < data.length * 2) {
      return write()
    } else {
      return Promise.resolve()
    }
  }

  return usbDevicesProvider.writeWait(`f = open('${usbDeviceFile.devPath}', 'wb')\r`, 1000)
    .then((result) => {
      if (result.indexOf('>>>') === -1) {
        return Promise.reject(result)
      }
      // start writing chunks
      return write()
        .then(() => {
          // console.log('write result', result)
          return usbDevicesProvider.writeWait('f.close()\r', 1000)
        })
    })
}
