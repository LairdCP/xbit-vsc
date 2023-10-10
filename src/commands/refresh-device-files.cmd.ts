import ExtensionContextStore from '../stores/extension-context.store'
import { UsbDevice } from '../lib/usb-device.class'

export async function RefreshDeviceFilesCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider !== undefined) {
    const key = usbDevice.uri.path
    // for each open file
    // if the file is in the tree cache path
    // warn the user that the file will be closed?
    // mark the file as dirty?

    ExtensionContextStore.provider?.treeCache.delete(key)
    // trigger a refresh of the tree view
    ExtensionContextStore.provider?.refresh()

    return await Promise.resolve(null)
  } else {
    return await Promise.reject(new Error('ExtensionContextStore.provider is undefined'))
  }
}
