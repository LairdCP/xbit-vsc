// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// import { PyocdInterface } from './lib/pyocd'
// const SerialPortProvider = require('./serial-port.lib')
import { UsbDeviceFile } from './lib/usb-device-file.class'
import { UsbDevice } from './lib/usb-device.class'
import { UsbDeviceWebViewProvider } from './providers/usb-device-webview.provider'

import {
  RunApplet,
  RefreshDevicesCommand,
  RefreshFileCommand,
  RefreshDeviceFilesCommand,
  CreateDeviceFileCommand,
  DeleteDeviceFileCommand,
  RenameDeviceFileCommand,
  OpenDeviceFileCommand,
  WriteHexFileCommand,
  ConnectUsbDeviceCommand,
  DisconnectUsbDeviceCommand,
  UpdateUsbDeviceSettingsCommand,
  InitializeWorkspaceCommand,
  RunPythonCommand,
  InitializePythonCommand
} from './commands'

// this is a singleton that can be imported anywhere
import ExtensionContextStore from './stores/extension-context.store'

export function activate (context: vscode.ExtensionContext): void {
  // initialize the extension context store with the extension context
  ExtensionContextStore.init(context).catch((error: unknown) => {
    ExtensionContextStore.error('Error initializing extension context', error, true)
  })

  // "files.autoSave": "afterDelay"
  const workbenchConfig = vscode.workspace.getConfiguration('files')
  if (workbenchConfig.get('autoSave') !== 'off') {
    void vscode.window.showErrorMessage('Please disable auto save in the settings.json file when using this extension.')
  }

  // listen for usb device connection events from the connect command
  // this is used to update the webview state
  ExtensionContextStore.on('connectUsbDevice', () => {
    if (usbDeviceWebViewProvider.webview !== undefined) {
      void usbDeviceWebViewProvider.webview.postMessage({
        method: 'connected',
        params: {
          device: {
            connected: true
          }
        }
      })
    }
  })

  // listen for usb device disconnect events from the disconnect command
  // this is used to update the webview state
  ExtensionContextStore.on('disconnectUsbDevice', () => {
    if (usbDeviceWebViewProvider.webview !== undefined) {
      void usbDeviceWebViewProvider.webview.postMessage({
        method: 'disconnected',
        params: {
          device: {
            connected: false
          }
        }
      })
    }
  })

  // listen for usb device selected events from the tree select handler
  // this is used to update the webview state
  ExtensionContextStore.on('selectedDevice', (device: any) => {
    if (usbDeviceWebViewProvider.webview !== undefined) {
      void usbDeviceWebViewProvider.onSelected(device)
    }
  })

  // listen for usb device deselected events from the tree select handler
  // this is used to update the webview state
  ExtensionContextStore.on('deselectedDevice', () => {
    if (usbDeviceWebViewProvider.webview !== undefined) {
      void usbDeviceWebViewProvider.onDeselected()
    }
  })

  // Register command handlers for the extension
  //
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.refreshDevices', async () => {
    try {
      await RefreshDevicesCommand()
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Refreshing File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.refreshFile', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await RefreshFileCommand(usbDeviceFile)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Refreshing File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.refreshDeviceFiles', async (usbDevice: UsbDevice) => {
    try {
      await RefreshDeviceFilesCommand(usbDevice)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Refreshing Files', error, true)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.createDeviceFile', async (usbDevice: UsbDevice) => {
    try {
      await CreateDeviceFileCommand(usbDevice)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Creating File', error, true)
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.deleteDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await DeleteDeviceFileCommand(usbDeviceFile)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Deleting File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.renameDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await RenameDeviceFileCommand(usbDeviceFile)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Renaming File', error, true)
    }
  }))
  // called when a python file on a connected device is selected in the tree view
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.openDeviceFile', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await OpenDeviceFileCommand(usbDeviceFile)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Opening File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.writeHexFile', WriteHexFileCommand))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.runApplet', RunApplet))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.connectUsbDevice', ConnectUsbDeviceCommand))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.disconnectUsbDevice', DisconnectUsbDeviceCommand))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.updateUsbDeviceSettings', UpdateUsbDeviceSettingsCommand))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.initializeWorkspace', InitializeWorkspaceCommand))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.runPythonReset', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await RunPythonCommand(usbDeviceFile, true)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Opening File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.runPythonNoReset', async (usbDeviceFile: UsbDeviceFile) => {
    try {
      await RunPythonCommand(usbDeviceFile, false)
    } catch (error) {
      // TODO select the previous device
      ExtensionContextStore.error('Error Opening File', error, true)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('xbitVsc.initializePython', async () => {
    try {
      await InitializePythonCommand()
    } catch (error) {
      ExtensionContextStore.error('Error Initializing Python Environment', error, true)
    }
  }))

  // register the webview provider
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
    // this fires for any file save, so only show the error if the file is in the tree
    if (textDocument.uri.scheme !== 'memfs') {
      return
    }

    // find the deviceFile by uri
    if (ExtensionContextStore.provider !== undefined) {
      const iterator = ExtensionContextStore.provider.treeCache.entries()
      for (const [, value] of iterator) {
        for (const i of value) {
          if (i.uri.path === textDocument.uri.path) {
            usbDeviceFile = i
            break
          }
        }
      }

      if (usbDeviceFile === undefined) {
        return await vscode.window.showErrorMessage('Error Saving File. File Not Found')
      }
      const usbDevice = usbDeviceFile.parentDevice
      if (!usbDevice.connected) {
        try {
          await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
        } catch (error) {
          // throw an error and mark the file as missing
          return await vscode.window.showErrorMessage('Error Saving File. Device Not Available')
        }
      }

      // set the silent flag to true to hide REPL output if not enabled in settings
      const dataToWrite = textDocument.getText()
      try {
        ExtensionContextStore.mute()
        await usbDevice.writeFile(usbDeviceFile, dataToWrite)
        ExtensionContextStore.outputChannel.appendLine('Saved\n')
        // remove the local copy?
        ExtensionContextStore.inform(`Saved File ${usbDeviceFile.name}\n`)
      } catch (error) {
        ExtensionContextStore.outputChannel.appendLine('Error saving\n')
        ExtensionContextStore.error(`Error Saving File ${usbDeviceFile.name}\n`, error, true)
      } finally {
        ExtensionContextStore.unmute()
      }
    } else {
      return await vscode.window.showErrorMessage('Error Saving File. No Tree Provider')
    }
  })
}

// This method is called when your extension is deactivated
export function deactivate (): void {
  if (ExtensionContextStore.provider !== undefined) {
    ExtensionContextStore.provider.disconnectAll().catch((error: unknown) => {
      ExtensionContextStore.error('Error disconnecting devices', error, true)
    })
  }
}
