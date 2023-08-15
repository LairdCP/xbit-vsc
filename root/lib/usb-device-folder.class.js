const path = require('path')
const vscode = require('vscode')

class UsbDeviceFolder extends vscode.TreeItem {
  constructor (
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    command
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)
    this.path = label
    this.tooltip = `${this.label}`
    this.command = command
    this.contextValue = 'usbDeviceFolder'
    // this.iconPath = iconPath;
    // this.children = children;
  }

  get iconPath () {
    return {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-folder.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-folder.svg')
    }
  }
}
module.exports = UsbDeviceFolder
