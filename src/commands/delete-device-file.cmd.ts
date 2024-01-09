import * as vscode from 'vscode'
import * as path from 'path'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'
import * as fs from 'fs/promises'

const config = vscode.workspace.getConfiguration('xbit-vsc')

export async function DeleteDeviceFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  // const dirPath = path.dirname(filePath)
  const key = usbDeviceFile.parentDevice.uri.path
  try {
    if (usbDeviceFile.parentDevice.filesystem.opLock !== false) {
      throw new Error(usbDeviceFile.parentDevice.filesystem.opLock as string)
    }
    ExtensionContextStore.mute()
    await usbDeviceFile.parentDevice.deleteFile(usbDeviceFile.devPath)
    // remove from MemFS cache
    ExtensionContextStore.provider?.treeCache.delete(key)
    ExtensionContextStore.provider?.refresh()

    // deleting a file that's never been opened will throw an error
    try {
      ExtensionContextStore.memFs.delete(usbDeviceFile.uri)
      const location: string | undefined = config.get('python-venv')
      if (location !== undefined) {
        const filename = ExtensionContextStore.getLocalFileFromUri(usbDeviceFile.uri)
        fs.unlink(path.join(location, filename)).then(() => {
          ExtensionContextStore.inform('File deleted', false)
        }).catch((error: unknown) => {
          console.error('Error Deleting File', error)
        })
      }
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
    return await Promise.reject(error)
  } finally {
    ExtensionContextStore.unmute()
  }
}
