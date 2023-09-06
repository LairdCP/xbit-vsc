// import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit'
import * as vscode from 'vscode'
import * as fs from 'fs'

// provideVSCodeDesignSystem().register(vsCodeButton())

export class UsbDeviceWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType: string = 'usbDevice.optionsView'
  public webview?: vscode.Webview
  private _view?: vscode.WebviewView

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
      const path = vscode.Uri.joinPath(this._extensionUri, 'src/providers', 'device-details.webview.html')
      console.log(path)
      const html = fs.readFileSync(path.fsPath, 'utf8')
      // const src = webviewView.webview.asWebviewUri(path)
      // console.log(src)
      webviewView.webview.html = html
      webviewView.webview.onDidReceiveMessage(data => {
        console.log('webviewView received message', data)
      })
      this.webview = webviewView.webview
    } catch (error) {
      console.log(error)
    }
  }
}
