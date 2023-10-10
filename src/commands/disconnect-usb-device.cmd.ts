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
    await usbDevice.destroyTerminal()
  } catch (error: unknown) {
    console.log(error)
    ExtensionContextStore.error('Error Closing Terminal', error)
  }

  try {
    await usbDevice.disconnect()
    usbDevice.setIconPath()
    usbDevicesProvider.refresh()
    ExtensionContextStore.emit('disconnectUsbDevice', usbDevice)
    ExtensionContextStore.inform('Disconnected')
    return await Promise.resolve(null)
  } catch (error: unknown) {
    console.log(error)
    ExtensionContextStore.error('Error Closing Port', error)
    return await Promise.reject(error)
  }
}
