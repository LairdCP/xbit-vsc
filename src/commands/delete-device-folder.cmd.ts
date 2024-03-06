import * as vscode from 'vscode'
// import * as path from 'path'
// import * as fs from 'fs/promises'

import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function DeleteDeviceFolderCommand (usbDeviceFolder: UsbDeviceFolder): Promise<null | Error> {
  // const config = vscode.workspace.getConfiguration('xbit-vsc')
  console.log('DeleteDeviceFolderCommand', usbDeviceFolder)
  if (!usbDeviceFolder.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFolder.parentDevice)
  }

  if (usbDeviceFolder.parentDevice.filesystem === null) {
    throw new Error('Device File System Not Found')
  }

  try {
    if (usbDeviceFolder.parentDevice.filesystem.opLock !== false) {
      throw new Error(usbDeviceFolder.parentDevice.filesystem.opLock as string)
    }
    // if folder is not empty, prompt user to confirm
    const children = await ExtensionContextStore.provider?.getChildren(usbDeviceFolder)
    if (children !== undefined && children.length > 0) {
      return await Promise.reject(new Error('Folder is not empty.'))

      // TODO prompt user to confirm, and recursively delete all children
      // const confirm = await vscode.window.showWarningMessage(
      //   'Folder is not empty. Are you sure you want to delete it?',
      //   { modal: true },
      //   'Yes'
      // )
      // if (confirm !== 'Yes') {
      //   return await Promise.resolve(null)
      // }
    }

    ExtensionContextStore.mute()
    await usbDeviceFolder.parentDevice.deleteFolder(usbDeviceFolder.devPath)
    // remove from MemFS cache
    ExtensionContextStore.memFs.delete(usbDeviceFolder.uri)
    // TODO recursively remove all children from MemFS cache

    ExtensionContextStore.provider?.refresh()
    ExtensionContextStore.inform('Deleted Folder')

    return await Promise.resolve(null)
  } catch (error: unknown) {
    console.error(error)
    return await Promise.reject(error)
  } finally {
    ExtensionContextStore.unmute()
  }
}
