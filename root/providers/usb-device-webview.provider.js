import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit'

const vscode = require('vscode')
const fs = require('fs')

provideVSCodeDesignSystem().register(vsCodeButton())

class UsbDeviceWebViewProvider {
  constructor (
    _extensionUri,
    viewType
  ) {
    this._extensionUri = _extensionUri
    this.viewType = viewType
    this.webview = null
  }

  resolveWebviewView (
    webviewView,
    context,
    token
  ) {
    this._view = webviewView
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    }
    try {
      const path = vscode.Uri.joinPath(this._extensionUri, 'root/providers', 'device-details.webview.html')
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

  getWebviewContent () {
  //   const path = vscode.Uri.joinPath(context.extensionUri, 'room/providers', 'device-details.webview.html')
    return ''
  }
}

module.exports = UsbDeviceWebViewProvider
