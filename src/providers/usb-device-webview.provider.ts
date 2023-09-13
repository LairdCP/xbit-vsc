// import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit'
import * as vscode from 'vscode'
import * as fs from 'fs'

import { UsbDevice } from '../lib/usb-device.class'

export class UsbDeviceWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType: string = 'xbitVsc.optionsView'
  public webview?: vscode.Webview
  private _view?: vscode.WebviewView
  private _selectedDevice?: UsbDevice | null

  constructor (
    private readonly _extensionUri: vscode.Uri
  ) {
    this._extensionUri = _extensionUri
  }

  resolveWebviewView (
    webviewView: vscode.WebviewView
  ): void {
    this._view = webviewView
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    }
    try {
      // const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'script.js')
      // const scriptSrc = webviewView.webview.asWebviewUri(onDiskPath)

      const path = vscode.Uri.joinPath(this._extensionUri, 'resources/device-details.webview.html')
      const html = fs.readFileSync(path.fsPath, 'utf8')
      // const src = webviewView.webview.asWebviewUri(path)
      // console.log(src)
      webviewView.webview.html = html
      this.webview = webviewView.webview
      this._setWebviewMessageListener(webviewView)
    } catch (error) {
      console.log(error)
    }
  }

  private _setWebviewMessageListener (webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      console.log('webviewView received message', message)

      if (message.command === 'connect' &&
        this._selectedDevice !== null) {
        await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', this._selectedDevice)
      } else if (message.command === 'disconnect' &&
        this._selectedDevice !== null) {
        await vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', this._selectedDevice)
      } else if (message.command === 'save') {
        await vscode.commands.executeCommand('xbitVsc.updateUsbDeviceSettings', this._selectedDevice, message)
      } else if (message.command === 'break') {
        this._selectedDevice?.ifc.sendBreak()
      } else if (message.command === 'eof') {
        this._selectedDevice?.ifc.sendEof()
      }
    })
  }

  async onDeselected (): Promise<void> {
    this._selectedDevice = null

    // tell the webview the device was deselected
    await this.webview?.postMessage({
      command: 'setSelected',
      device: null
    })
  }

  async onSelected (usbDevice: UsbDevice): Promise<void> {
    if (usbDevice instanceof UsbDevice) {
      this._selectedDevice = usbDevice

      // tell the webview the device was selected
      await this.webview?.postMessage({
        command: 'setSelected',
        device: {
          serialNumber: usbDevice.serialNumber,
          path: usbDevice.options.path,
          name: usbDevice.name,
          manufacturer: usbDevice.options.manufacturer,
          baudRate: usbDevice.baudRate,
          connected: usbDevice.connected
        }
        // device: usbDevice
      })
    } else {
      // file selected
    }
  }
}
