
import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function CreateDeviceFileCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (!usbDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDevice)
  }

  // create a new file object with unamed file
  const fileName = await vscode.window.showInputBox()
  // check if the file already exists with the same filename.
  // If it does, append a number to the filename?
  // create a new file object with named file
  if (fileName !== undefined) {
    const key = usbDevice.parentDevice.uri.path
    try {
      ExtensionContextStore.mute()
      await usbDevice.createFile(fileName)
      ExtensionContextStore.provider?.treeCache.delete(key)
      ExtensionContextStore.provider?.refresh()
      ExtensionContextStore.inform(`Created New File: ${fileName}`)
      return await Promise.resolve(null)
    } catch (error: unknown) {
      ExtensionContextStore.error('Error Creating File', error, true)
      return await Promise.reject(error)
    } finally {
      ExtensionContextStore.unmute()
    }
  }
  // cancelled?
  return await Promise.resolve(null)
}
