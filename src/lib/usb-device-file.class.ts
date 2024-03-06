import * as path from 'path'
import * as vscode from 'vscode'
import { UsbDevice } from './usb-device.class'
import { TreeItemIconPath } from '../lib/util.ifc'

export class UsbDeviceFile extends vscode.TreeItem {
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
    type: string,
    size: number,
    parentDevice: UsbDevice
  ) {
    let fragment = uri.path.split('/').pop()
    if (fragment === undefined) {
      fragment = '?'
    }
    super(fragment, vscode.TreeItemCollapsibleState.None)
    this.context = context
    this.label = fragment
    this.uri = uri
    this.size = size
    this.type = type
    this.name = this.label
    this.contextValue = this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
    this.tooltip = this.uri.path
    this.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'resources/light/gen-file.svg'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources/dark/gen-file.svg')
    }
    this.parentDevice = parentDevice
  }

  // full fs path
  get dir (): string {
    return path.dirname(this.uri.path)
  }

  // file system provider.readFile will figure this out
  // stupid hack
  get devPath (): string {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }
}
