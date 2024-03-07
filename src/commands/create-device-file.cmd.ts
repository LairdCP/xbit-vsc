import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function CreateDeviceFileCommand (parentNode: UsbDevice | UsbDeviceFolder): Promise<null | Error> {
  let usbDevice: UsbDevice
  let basePath = '/'
  if (parentNode instanceof UsbDevice) {
    usbDevice = parentNode
  } else {
    usbDevice = parentNode.parentDevice
    basePath = parentNode.devPath
  }

  if (!usbDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDevice)
  }

  if (usbDevice.filesystem === null) {
    throw new Error('Device File System Not Found')
  }

  if (usbDevice.filesystem.opLock !== false) {
    throw new Error(usbDevice.filesystem.opLock as string)
  }

  // create a new file object with unamed file
  let fileName = await vscode.window.showInputBox({
    validateInput: text => {
      if (basePath.length + text.length > 48) {
        return 'File path too long'
      } else {
        return null
      }
    }
  })

  // check if the file already exists with the same filename.
  // If it does, append a number to the filename?
  // create a new file object with named file
  if (fileName !== undefined) {
    try {
      fileName = basePath + '/' + fileName
      fileName = fileName.replace(/\/+/g, '/')
      ExtensionContextStore.mute()
      await usbDevice.createFile(fileName)
      ExtensionContextStore.provider?.refresh()
      ExtensionContextStore.inform(`Created New File: ${fileName}`)
      return await Promise.resolve(null)
    } catch (error: unknown) {
      ExtensionContextStore.error(`Error creating new file: ${fileName}`, error, true)
      return await Promise.reject(error)
    } finally {
      ExtensionContextStore.unmute()
    }
  }
  // cancelled?
  return await Promise.resolve(null)
}
