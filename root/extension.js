// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
// const SerialPortProvider = require('./serial-port.lib')
// const commands = require('./commands')
const UsbDevicesProvider = require('./providers/usb-devices.provider')
const UsbDeviceWebViewProvider = require('./providers/usb-device-webview.provider')

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  const openFiles = {}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "xbit-vsc" is now active!')

  const outputChannel = vscode.window.createOutputChannel("xbit-vsc");

  const rootPath =
  vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined
  
  const usbDevicesProvider = new UsbDevicesProvider(rootPath, context)
  vscode.window.registerTreeDataProvider('usbDevices', usbDevicesProvider)
  vscode.commands.registerCommand('usbDevices.refreshEntry', () =>
    usbDevicesProvider.refresh()
  )

  // called when a python file on a connected device is selected
  vscode.commands.registerCommand('usbDevices.openDeviceFile', (e) => {
    console.log('open file', e)
    // e.command.arguments[0].label is the file selected
    // e.command.arguments[1].main is the device selected
    outputChannel.appendLine(`opening file ${e.path}\n`)
    outputChannel.show()

    // if file is already open, switch to it
    if (openFiles[e.path]) {
      vscode.window.showTextDocument(openFiles[e.path])
    } else {
      // open file
      vscode.workspace.openTextDocument(e.path).then((doc) => {
        openFiles[e.path] = doc
        vscode.window.showTextDocument(doc)
      }
      )
    }
  })

  vscode.commands.registerCommand('usbDevices.writeHexFile', (context, selectedContext) => {
    console.log('write hex file', context, selectedContext)
    // selectedContext[0] is the file selected
    // if not connected to a device, return error
    outputChannel.appendLine(`write hex file ${selectedContext[0].path}\n`)
    outputChannel.show()
  })

  vscode.commands.registerCommand('usbDevices.connectUsbDevice', (context) => {
    console.log('connect to usb device', context)
    outputChannel.appendLine(`connecting to device ${context.path}\n`)
    outputChannel.show()
    usbDevicesProvider.connect(context)

  })

  vscode.commands.registerCommand('usbDevices.disconnectUsbDevice', (context) => {
    console.log('disconnect from usb device', context)
    outputChannel.appendLine(`disconnecting from device ${context.path}\n`)
    outputChannel.show()
    usbDevicesProvider.disconnect(context)
  })

  const options = {
    treeDataProvider: usbDevicesProvider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('usbDevices', options)

  tree.onDidChangeSelection(e => {
    console.log('onDidChangeSelection', e) // breakpoint here for debug
    usbDeviceWebViewProvider.webview.postMessage({ command: 'setPath', path: e.selection[0].path });
  })
  tree.onDidCollapseElement(e => {
    console.log('onDidCollapseElement', e) // breakpoint here for debug
  })
  tree.onDidChangeVisibility(e => {
    console.log('onDidChangeVisibility', e) // breakpoint here for debug
  })
  tree.onDidExpandElement(e => {
    console.log('onDidExpandElement', e) // breakpoint here for debug
  })

  // subscribe
  context.subscriptions.push(tree)

	const usbDeviceWebViewProvider = new UsbDeviceWebViewProvider(context.extensionUri, 'usbDevice.optionsView');

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(usbDeviceWebViewProvider.viewType, usbDeviceWebViewProvider));

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
