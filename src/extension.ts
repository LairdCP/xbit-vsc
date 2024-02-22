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
      ExtensionContextStore.error('Error Refreshing Devices', error, true)
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

  vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {
    console.log('<><> Opened.', e)
  })

  // vscode.workspace.onDidChangeTextDocument(() => {
  //   // console.log('Changed.', e);
  // })

  vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
    console.log('<><> Closed.', e)
  })

  vscode.workspace.onDidCreateFiles(async (e: vscode.FileCreateEvent) => {
    console.log('<><> Created workspace event', e)
  })

  vscode.workspace.onDidSaveTextDocument(async (textDocument: vscode.TextDocument) => {
    console.log('<><> Saved workspace event', textDocument)

    // this fires for any file save, so only show the error if the file is in the tree
    if (textDocument.uri.scheme !== 'memfs') {
      return
    }

    let usbDeviceFile: UsbDeviceFile | undefined
    let usbDevice: UsbDevice | undefined
    if (ExtensionContextStore.provider !== undefined) {
      usbDeviceFile = ExtensionContextStore.provider.findDeviceFileByUri(textDocument.uri)

      // if this is a new file that doesn't exist on the device yet
      // create the file on the device
      if (usbDeviceFile === undefined) {
        // create the file if it doesn't exist
        // find the device based on the file path
        usbDevice = ExtensionContextStore.provider.findDeviceByUri(textDocument.uri)

        if (usbDevice === undefined) {
          return await vscode.window.showErrorMessage('Error Creating File. Device Not Found')
        }
        // create the file
        const fileName = textDocument.uri.path.split('/').pop()
        if (fileName === undefined) {
          return await vscode.window.showErrorMessage('Error Creating File. File Name Not Found')
        }
        // TODO fileName will need to be a uri when folders are supported
        // e.files[0] is a uri
        usbDeviceFile = await usbDevice.createFile(fileName)
        // refresh the tree
        ExtensionContextStore.provider.refresh()
      } else {
        usbDevice = usbDeviceFile?.parentDevice
      }

      // if for some reason the file is still not found, throw an error
      if (usbDeviceFile === undefined) {
        throw new Error('usbDeviceFile is undefined')
      }

      // if the device is not connected, connect it
      if (!usbDevice.connected) {
        try {
          await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
        } catch (error) {
          // throw an error and mark the file as missing
          return await vscode.window.showErrorMessage('Error Saving File. Device Not Available')
        }
      }

      // write the file to the device
      const dataToWrite = Buffer.from(textDocument.getText(), 'utf8')
      try {
        ExtensionContextStore.inform(`Writing File ${usbDeviceFile.name}`)
        return await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Writing File ${usbDeviceFile.name}`,
          cancellable: false
        }, async (progress) => {
          if (usbDeviceFile === undefined) {
            throw new Error('usbDeviceFile is undefined')
          }
          await usbDevice?.writeFile(usbDeviceFile, dataToWrite, (increment: number, total: number) => {
            progress.report({ increment: (increment / total) * 100, message: '...' })
          })
          ExtensionContextStore.outputChannel.appendLine('Saved\n')
          // remove the local copy?
          ExtensionContextStore.inform(`Saved File ${usbDeviceFile.name}\n`)
        })
      } catch (error) {
        ExtensionContextStore.outputChannel.appendLine('Error saving\n')
        ExtensionContextStore.error(`Error Saving File ${textDocument.uri.path}\n`, error, true)
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
