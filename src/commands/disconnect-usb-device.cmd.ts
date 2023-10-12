import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function DisconnectUsbDeviceCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) {
    return await Promise.reject(new Error('ExtensionContextStore is not yet inited'))
  }

  // clean up files from the  and the memFS
  const key = usbDevice.uri.path
  const deviceFiles = ExtensionContextStore.provider?.treeCache.get(key)
  // would like to collapse the tree here, but it there is no api for it
  // unless I want to collapse all tree views
  usbDevice.id = Date.now().toString()
  try {
    await ExtensionContextStore.tree?.reveal(usbDevice, { select: false, focus: false, expand: false })
    ExtensionContextStore.provider?.treeCache.delete(key)
  } catch (error: unknown) {
    // ignore, item was never selected
    console.log(error)
  }
  deviceFiles?.forEach((file) => {
    try {
      ExtensionContextStore.memFs.delete(vscode.Uri.parse(`memfs:${file.uri.path}`))
    } catch (error) {
      // ignore, file was never loaded
    }
  })
  // removing the cache triggers a reload and reconnect when the item is selected
  if (!usbDevice.connected) {
    return await Promise.resolve(null)
  }

  ExtensionContextStore.inform(`Disconnecting From Device ${usbDevice.name}`)
  try {
    await usbDevice.destroyTerminal()
  } catch (error: unknown) {
    console.log(error)
    ExtensionContextStore.error('Error Closing Terminal', error)
  }

  try {
    await usbDevice.disconnect()
    ExtensionContextStore.emit('disconnectUsbDevice', usbDevice)
    ExtensionContextStore.inform('Disconnected')
  } catch (error: unknown) {
    console.log(error)
    ExtensionContextStore.error('Error Closing Port', error)
    return await Promise.reject(error)
  }
  usbDevice.setIconPath()
  ExtensionContextStore.provider.refresh()
  return await Promise.resolve(null)
}
