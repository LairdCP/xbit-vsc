import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function DeleteDeviceFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  // const dirPath = path.dirname(filePath)
  const key = usbDeviceFile.parentDevice.uri.path
  try {
    await usbDeviceFile.parentDevice.deleteFile(usbDeviceFile.devPath)
    // remove from MemFS cache
    ExtensionContextStore.provider?.treeCache.delete(key)
    ExtensionContextStore.provider?.refresh()

    await ExtensionContextStore.memFs.delete(usbDeviceFile.uri)
    ExtensionContextStore.inform(`Deleted File: ${usbDeviceFile.name}`)
    return await Promise.resolve(null)
  } catch (error: unknown) {
    ExtensionContextStore.error('Error Deleting File', error, true)
    return await Promise.reject(error)
  }
}
