// import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit'
import * as vscode from 'vscode'
import * as fs from 'fs'

import { UsbDevice } from '../lib/usb-device.class'
import AppletsStore from '../stores/applets.store'
import { DeviceCommand } from '../lib/util.ifc'
import { UsbDeviceFile } from '../lib/usb-device-file.class'

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

      webviewView.onDidChangeVisibility(async () => {
        // if selected device, call onSelected
        if (webviewView.visible && this._selectedDevice !== null) {
          await this.onSelected(this._selectedDevice)
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  private _setWebviewMessageListener (webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(async (message: DeviceCommand) => {
      if (message.method === 'connect') {
        // if message.params.path
        // find the device by path
        if (this._selectedDevice !== null && this._selectedDevice !== undefined) {
          await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', this._selectedDevice)
        }
      } else if (message.method === 'disconnect' &&
        this._selectedDevice !== null) {
        await vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', this._selectedDevice)
      } else if (message.method === 'save') {
        await vscode.commands.executeCommand('xbitVsc.updateUsbDeviceSettings', this._selectedDevice, message)
      } else if (message.method === 'break') {
        await this._selectedDevice?.ifc.sendBreak()
      } else if (message.method === 'eof') {
        await this._selectedDevice?.ifc.sendEof()
      } else if (message.method === 'use-for-applet' &&
        this._selectedDevice !== null && this._selectedDevice !== undefined) {
        if (message.params.applet !== 'none') {
          AppletsStore.link(String(message.params.applet), this._selectedDevice)
        } else {
          AppletsStore.unlink(String(message.params.applet), this._selectedDevice)
        }
      } else if (message.method === 'exit-raw-mode') {
        await this._selectedDevice?.ifc.sendExitRawMode()
      } else if (message.method === 'enter-raw-mode') {
        await this._selectedDevice?.ifc.sendEnterRawMode()
      } else if (message.method === 'exec-raw-mode') {
        await this._selectedDevice?.ifc.sendExecuteRawMode()
      }
    })
  }

  async onDeselected (): Promise<void> {
    this._selectedDevice = null

    // tell the webview the device was deselected
    await this.webview?.postMessage({
      method: 'setSelected',
      params: {
        device: null
      }
    })
  }

  async onSelected (usbDevice: UsbDevice | UsbDeviceFile): Promise<void> {
    if (this._view !== null) {
      try {
        this._view.show()
      } catch (error) {
        console.log('error showing webview', error)
      }
    }

    if (usbDevice instanceof UsbDeviceFile) {
      usbDevice = usbDevice.parentDevice
    }

    if (usbDevice instanceof UsbDevice) {
      this._selectedDevice = usbDevice
      console.log(this._selectedDevice)
      // tell the webview the device was selected
      await this.webview?.postMessage({
        method: 'setSelected',
        params: {
          device: {
            serialNumber: usbDevice.serialNumber,
            path: usbDevice.options.path,
            name: usbDevice.name,
            manufacturer: usbDevice.options.manufacturer,
            baudRate: usbDevice.baudRate,
            rtscts: usbDevice.rtscts,
            connected: usbDevice.connected,
            productId: usbDevice.options.productId,
            vendorId: usbDevice.options.vendorId,
            supportsBreak: usbDevice.ifc.supportsBreak,
            eofType: usbDevice.ifc.eofType
          }
        }
      })

      await this.webview?.postMessage({
        method: 'applets',
        params: {
          applets: AppletsStore.list()
        }
      })
    } else {
      // deselect
      await this.onDeselected()
    }
  }
}
