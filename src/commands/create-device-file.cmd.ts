
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
      await usbDevice.createFile(fileName)
      void vscode.window.showInformationMessage(`Created New File: ${fileName}`)
      // await usbDevicesProvider.createFile(usbDevice, fileName)
      ExtensionContextStore.provider?.treeCache.delete(key)
      ExtensionContextStore.provider?.refresh()
      return await Promise.resolve(null)
    } catch (error) {
      void vscode.window.showInformationMessage('Error Creating File')
      return await Promise.reject(error)
    }
  }
  // cancelled?
  return await Promise.resolve(null)
}
