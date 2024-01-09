import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function RefreshFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  if (usbDeviceFile.parentDevice.filesystem.opLock !== false) {
    throw new Error(usbDeviceFile.parentDevice.filesystem.opLock as string)
  }

  ExtensionContextStore.memFs.delete(usbDeviceFile.uri)
  // clear the tree nodes and re-read the files
  try {
    await vscode.window.showTextDocument(usbDeviceFile.uri)
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    return await vscode.commands.executeCommand('xbitVsc.openDeviceFile', usbDeviceFile)
  } catch (error) {
    return await Promise.reject(error)
  }
}
