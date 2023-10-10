import ExtensionContextStore from '../stores/extension-context.store'
import { UsbDevice } from '../lib/usb-device.class'

export async function RefreshDeviceFilesCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider !== undefined) {
    const key = usbDevice.uri.path
    ExtensionContextStore.provider?.treeCache.delete(key)
    // trigger a refresh of the tree view
    ExtensionContextStore.provider?.refresh()
    return await Promise.resolve(null)
  } else {
    return await Promise.reject(new Error('ExtensionContextStore.provider is undefined'))
  }
}
