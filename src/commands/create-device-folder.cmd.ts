
import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
// import { ConnectUsbDeviceCommand } from './connect-usb-device.cmd'
import ExtensionContextStore from '../stores/extension-context.store'

export async function CreateDeviceFolderCommand (parentNode: UsbDevice | UsbDeviceFolder): Promise<null | Error> {
  let usbDevice: UsbDevice
  let basePath = '/'
  if (parentNode instanceof UsbDevice) {
    usbDevice = parentNode
  } else {
    usbDevice = parentNode.parentDevice
    basePath = parentNode.devPath
  }

  // create a new file object with unamed file
  console.log('showInputBox')
  let fileName = await vscode.window.showInputBox()

  if (!usbDevice.connected) {
    console.log('connecting')
    // await usbDevice.connect()
    // await ConnectUsbDeviceCommand(usbDevice)
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDevice)
  }

  console.log('filesystem')
  if (usbDevice.filesystem === null) {
    throw new Error('Device File System Not Found')
  }

  if (usbDevice.filesystem.opLock !== false) {
    throw new Error(usbDevice.filesystem.opLock as string)
  }

  // check if the file already exists with the same filename.
  // If it does, append a number to the filename?
  // create a new file object with named file
  if (fileName !== undefined) {
    try {
      if (/^\//.test(fileName)) {
        fileName = basePath + fileName
      } else {
        fileName = basePath + '/' + fileName
      }
      ExtensionContextStore.mute()
      await usbDevice.createFolder(fileName)
      ExtensionContextStore.provider?.refresh()
      ExtensionContextStore.inform(`Created New Folder: ${fileName}`)
      return await Promise.resolve(null)
    } catch (error: unknown) {
      return await Promise.reject(error)
    } finally {
      ExtensionContextStore.unmute()
    }
  }
  console.log('resolve')
  // cancelled?
  return await Promise.resolve(null)
}
