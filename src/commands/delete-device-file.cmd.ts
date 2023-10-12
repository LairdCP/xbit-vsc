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
    ExtensionContextStore.mute()
    await usbDeviceFile.parentDevice.deleteFile(usbDeviceFile.devPath)
    // remove from MemFS cache
    ExtensionContextStore.provider?.treeCache.delete(key)
    ExtensionContextStore.provider?.refresh()

    // deleting a file that's never been opened will throw an error
    try {
      await ExtensionContextStore.memFs.delete(usbDeviceFile.uri)
    } catch (error: unknown) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        // ignore
      } else {
        throw error
      }
    }

    ExtensionContextStore.inform(`Deleted File: ${usbDeviceFile.name}`)
    return await Promise.resolve(null)
  } catch (error: unknown) {
    console.error(error)
    ExtensionContextStore.error('Error Deleting File', error, true)
    return await Promise.reject(error)
  } finally {
    ExtensionContextStore.unmute()
  }
}
