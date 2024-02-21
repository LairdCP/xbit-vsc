import ExtensionContextStore from '../stores/extension-context.store'
import { UsbDevice } from '../lib/usb-device.class'

export async function RefreshDeviceFilesCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider !== undefined) {
    const key = usbDevice.uri.path

    if (usbDevice.filesystem === null) {
      throw new Error('Device File System Not Found')
    }

    if (usbDevice.filesystem.opLock !== false) {
      throw new Error(usbDevice.filesystem.opLock as string)
    }

    // for each open file
    // if the file is in the tree cache path
    // warn the user that the file will be closed?
    // mark the file as dirty?

    if (ExtensionContextStore.provider !== undefined) {
      const files = ExtensionContextStore.provider?.treeCache.get(key)?.map((file) => {
        return { path: file.uri.path, size: file.size }
      })
      if (files !== undefined) {
        ExtensionContextStore.provider.staleTreeCache.set(key, files)
      }
      ExtensionContextStore.provider.treeCache.delete(key)
      // trigger a refresh of the tree view
      ExtensionContextStore.provider.refresh()
    }
    return await Promise.resolve(null)
  } else {
    return await Promise.reject(new Error('ExtensionContextStore.provider is undefined'))
  }
}
