import * as path from 'path'
import * as vscode from 'vscode'
import { UsbDevice } from './usb-device.class'
import { TreeItemIconPath } from '../lib/util.ifc'

export class UsbDeviceFolder extends vscode.TreeItem {
  label: string
  context: vscode.ExtensionContext
  uri: vscode.Uri
  type: string
  size: number
  name: string
  parentDevice: UsbDevice

  // overrides
  public readonly contextValue: string
  public readonly tooltip: string
  public readonly iconPath: TreeItemIconPath

  constructor (
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    parentDevice: UsbDevice
  ) {
    let fragment = uri.path.split('/').pop()
    if (fragment === undefined) {
      fragment = '?'
    }
    super(fragment, vscode.TreeItemCollapsibleState.Collapsed)
    this.context = context
    this.label = fragment
    this.uri = uri
    this.parentDevice = parentDevice
    this.tooltip = this.uri.path
    this.contextValue = 'usbDeviceFolder'
    this.size = 0
    this.type = 'folder'
    this.name = this.label
    this.contextValue = this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
    this.tooltip = this.uri.path
    this.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'resources/light/gen-folder.svg'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources/dark/gen-folder.svg')
    }
  }

  get dir (): string {
    return path.dirname(this.uri.path)
  }

  get devPath (): string {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }
}
