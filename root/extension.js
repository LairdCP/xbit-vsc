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
function activate(context) {

  const openFiles = {}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "xbit-vsc" is now active!')

  const memFs = new MemFSProvider();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));

  const outputChannel = vscode.window.createOutputChannel("xbit-vsc");

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

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.createDeviceFile', (context) => {
    // create a new file object with unamed file
    vscode.window.showInputBox().then((fileName) => {
      // check if the file already exists with the same filename. If it does, append a number to the filename?
      // create a new file object with named file
      const filePath = path.join('/', fileName)
      return usbDevicesProvider.createFile(context, filePath)
    }).then((result) => {
      console.log(result)
      console.log('file created')
      // return usbDevicesProvider.refresh()
    });
  }))

  const path = require('path')
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.renameDeviceFile', (e) => {
    // create a new file object with unamed file
    vscode.window.showInputBox({
      value: e.label,
    }).then((newFileName) => {
      // rename the file with fileName
      const oldFileName = path.join('/', e.label).split('/').pop()
      newFileName = newFileName.split('/').pop()
      console.log('oldFileName', oldFileName, 'newFileName', newFileName)
      return usbDevicesProvider.renameFile(e.parentDevice, oldFileName, newFileName)
    });
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.deleteDeviceFile', (e) => {
    // delete the file
    // e.path is the file selected
    usbDevicesProvider.deleteFile(e.parentDevice, e.path).then((result) => {
      const deviceContext = e.parentDevice
      const devicePath = deviceContext.path.split('/').pop()
  
      let file
      try {
        file = vscode.Uri.parse(`memfs:/${devicePath}${e.path}`)
        memFs.delete(file)
      } catch (error) {
        file = null
        console.log('error', error)
      }
    })
  }))

  // called when a python file on a connected device is selected
  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.openDeviceFile', (e) => {
    // e.command.arguments[0].label is the file selected
    // e.command.arguments[1].main is the device selected
    outputChannel.appendLine(`opening file ${e.path}\n`)
    outputChannel.show()

    const deviceContext = e.parentDevice
    const devicePath = deviceContext.path.split('/').pop()

    let file
    try {
      file = vscode.Uri.parse(`memfs:/${devicePath}${e.path}`)
      memFs.stat(file)
    } catch (error) {
      file = null
      // console.log('error', error)
    }
    // if file is already open, switch to it
    if (file) {
      vscode.window.showTextDocument(file)
    } else {
      // open file
      usbDevicesProvider.connect(deviceContext, { skipRefresh: true }).then(() => {
        return readFileFromDevice(usbDevicesProvider, e)
      })
      .then((result) => {
        // convert to hex
        // loop?
        const buffer = Buffer.from(result, 'hex')
        openFiles[e.path] = buffer.toString('utf8')
        // write file to memfs
        try {
          memFs.stat(vscode.Uri.parse(`memfs:/${devicePath}`))
        } catch (error) {
          memFs.createDirectory(vscode.Uri.parse(`memfs:/${devicePath}`));
        }
        memFs.writeFile(vscode.Uri.parse(`memfs:/${devicePath}${e.path}`), Buffer.from(openFiles[e.path]), { create: true, overwrite: true })
        const file = vscode.Uri.parse(`memfs:/${devicePath}${e.path}`)
        vscode.window.showTextDocument(file)

        return usbDevicesProvider.disconnect(deviceContext)
      })
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.writeHexFile', (context, selectedContext) => {
    // console.log('write hex file', context, selectedContext)
    // selectedContext[0] is the file selected
    // if not connected to a device, return error
    outputChannel.appendLine(`write hex file ${selectedContext[0].path}\n`)
    outputChannel.show()
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.connectUsbDevice', (context) => {
    // console.log('connect to usb device', context)
    outputChannel.appendLine(`connecting to device ${context.path}\n`)
    outputChannel.show()
    usbDevicesProvider.connect(context)
  }))

  context.subscriptions.push(vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', (context) => {
    // console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${context.path}\n`)
    outputChannel.show()
    usbDevicesProvider.disconnect(context)
  }))

  const options = {
    treeDataProvider: usbDevicesProvider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('usbDevices', options)

  tree.onDidChangeSelection(e => {
    // console.log('onDidChangeSelection', e) // breakpoint here for debug
    usbDeviceWebViewProvider.webview.postMessage({ command: 'setPath', path: e.selection[0].path });
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

  // subscribe
  context.subscriptions.push(tree)

	const usbDeviceWebViewProvider = new UsbDeviceWebViewProvider(context.extensionUri, 'usbDevice.optionsView');
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(usbDeviceWebViewProvider.viewType, usbDeviceWebViewProvider));

  vscode.workspace.onDidChangeTextDocument(function(e) {
    // console.log('Changed.', e);
  })

  vscode.workspace.onDidCloseTextDocument(function(e) {
    // console.log('Closed.', e);
  })

  vscode.workspace.onDidSaveTextDocument(function(e) {
    // console.log('Saved!', e);

    // should save to e.parentDevice.path
    const dataToWrite = e.getText()
    const fileName = e.uri.path.split('/').pop()
    const devicePath = '/dev/' + e.uri.path.split('/')[1]

    usbDevicesProvider.connect({ path: devicePath }).then((result) => {
      return writeFileToDevice(usbDevicesProvider, fileName, dataToWrite)
    }).then((result) => {
      // OK result
    }).catch((error) => {
      console.log('error', error)
    }).finally(() => {
      return usbDevicesProvider.disconnect({ path: devicePath })
    })
  })
}

// This method is called when your extension is deactivated
function deactivate() {
  usbDevicesProvider.disconnectAll()
}

module.exports = {
	activate,
	deactivate
}


// given a filePath, read the file from the device in 64 byte chunks
const readFileFromDevice = (usbDevicesProvider, fileNode) => {
  let data = ''
  let rate = 64
  let resultData = ''
  let size = fileNode.size * 2

  // console.log('readFileFromDevice', fileNode.path)
  console.time('readFileFromDevice')

  return new Promise((resolve, reject) => {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading ${fileNode.path}`,
      cancellable: true
    }, (progress, token) => {

      let cancelled = false
      token.onCancellationRequested(() => {
        console.log("User canceled the long running operation");
        cancelled = true
      })

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
        let increment = Math.round((chunk.length / size) * 100)
        progress.report({ increment, message: "Loading File..." })

        if (chunk.length === rate * 2) {
          return read()
        } else if (cancelled) {
          return Promise.reject('cancelled')
        } else {
          return Promise.resolve(data)
        }
      }

      // open file
      return usbDevicesProvider.writeWait(`f = open('${fileNode.path}', 'rb')\r`, 1000)
      .then((result) => {
        return read()
      })
      .then((result) => {
        resultData = result
        // close file
        return usbDevicesProvider.writeWait(`f.close()\r`, 1000)
      })
      .then((result) => {
        resolve(resultData)
      }).catch((error) => {
        console.timeEnd('readFileFromDevice')
        return reject(error)
      })
    })
  })
}

const writeFileToDevice = (usbDevicesProvider, filePath, data) => {
  let offset = 0

  const write = async () => {
    try {
      let byteString = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + 50).match(/[\s\S]{2}/g) || []
      byteString = `f.write(b'\\x${byteString.join('\\x')}')\r`
      await usbDevicesProvider.writeWait(byteString)
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

  return usbDevicesProvider.writeWait(`f = open('${filePath}', 'wb')\r`, 1000)
  .then((result) => {
    if (result.indexOf('>>>') === -1) {
      return Promise.reject(result)
    }
    // start writing chunks
    return write()
    .then((result) => {
      // console.log('write result', result)
      return usbDevicesProvider.writeWait(`f.close()\r`, 1000)
    })
  })
}
