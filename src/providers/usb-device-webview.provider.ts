// import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit'
import * as vscode from 'vscode'
import * as fs from 'fs'

import { UsbDevice } from '../lib/usb-device.class'
import AppletsStore from '../stores/applets.store'

export class UsbDeviceWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType: string = 'xbitVsc.optionsView'
  public webview?: vscode.Webview
  private _view: vscode.WebviewView | null = null
  private _selectedDevice: UsbDevice | null = null

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
      const path = vscode.Uri.joinPath(this._extensionUri, 'resources/device-details.webview.html')
      const html = fs.readFileSync(path.fsPath, 'utf8')

      webviewView.webview.html = html
      this.webview = webviewView.webview
      this._setWebviewMessageListener(webviewView)

      webviewView.onDidChangeVisibility(async (event) => {
        // if selected device, call onSelected
        if (webviewView.visible && this._selectedDevice !== null) {
          await this.onSelected(this._selectedDevice)
        }
      })
    } catch (error) {
      console.log(error)
    }
  }

  private _setWebviewMessageListener (webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      if (message.command === 'connect' &&
      this._selectedDevice !== null && this._selectedDevice !== undefined) {
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
      } else if (message.command === 'use-for-applet' &&
        this._selectedDevice !== null && this._selectedDevice !== undefined) {
        if (message.applet !== 'none') {
          AppletsStore.link(message.applet, this._selectedDevice)
        } else {
          AppletsStore.unlink(message.applet, this._selectedDevice)
        }
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
    if (this._view !== null) {
      try {
        this._view.show()
      } catch (error) {
        console.log('error showing webview', error)
      }
    }
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
          connected: usbDevice.connected,
          productId: usbDevice.options.productId,
          vendorId: usbDevice.options.vendorId,
          supportsBreak: usbDevice.ifc.supportsBreak,
          eofType: usbDevice.ifc.eofType
        }
        // device: usbDevice
      })

      await this.webview?.postMessage({
        command: 'applets',
        applets: AppletsStore.list()
      })
    } else {
      // file selected
    }
  }
}
