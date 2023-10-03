import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function DisconnectUsbDeviceCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) {
    return await Promise.reject(new Error('ExtensionContextStore is not yet inited'))
  }

  const usbDevicesProvider = ExtensionContextStore.provider

  if (!usbDevice.connected) {
    return await Promise.resolve(null)
  }

  ExtensionContextStore.inform(`Disconnecting From Device ${usbDevice.name}`)
  try {
    await usbDevice.disconnect()
    await usbDevice.destroyTerminal()
    usbDevice.setIconPath()
    usbDevicesProvider.refresh()
    ExtensionContextStore.emit('disconnectUsbDevice', usbDevice)
    ExtensionContextStore.inform('Disconnected')
    return await Promise.resolve(null)
  } catch (error: unknown) {
    ExtensionContextStore.error('Error Closing Port', error)
    return await Promise.reject(error)
  }
}
