import * as path from 'path'
import * as vscode from 'vscode'

export class UsbDeviceFolder extends vscode.TreeItem {
  path: string
  constructor (
    label: string,
    command: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)
    this.path = label
    this.tooltip = label
    this.command = command
    this.contextValue = 'usbDeviceFolder'
    this.iconPath = {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-folder.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-folder.svg')
    }
  }
}
