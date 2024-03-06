import * as path from 'path'
import * as vscode from 'vscode'
import { UsbDevice } from './usb-device.class'

export class UsbDeviceFolder extends vscode.TreeItem {
  uri: vscode.Uri
  parentDevice: UsbDevice
  size: number

  constructor (
    uri: vscode.Uri,
    parentDevice: UsbDevice
  ) {
    let fragment = uri.path.split('/').pop()
    if (fragment === undefined) {
      fragment = '?'
    }
    super(fragment, vscode.TreeItemCollapsibleState.Collapsed)
    this.uri = uri
    this.parentDevice = parentDevice
    this.tooltip = this.uri.path
    this.contextValue = 'usbDeviceFolder'
    this.size = 0
    this.iconPath = {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-folder.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-folder.svg')
    }
  }

  get devPath (): string {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }
}
