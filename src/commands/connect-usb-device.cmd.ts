import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function ConnectUsbDeviceCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (usbDevice === undefined) {
    return await Promise.reject(new Error('usbDevice is undefined'))
  }

  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) {
    return await Promise.reject(new Error('ExtensionContextStore is not yet inited'))
  }

  const usbDevicesProvider = ExtensionContextStore.provider

  if (usbDevice.connected) {
    return await Promise.resolve(null)
  }

  ExtensionContextStore.inform(`connecting to device ${String(usbDevice.name)}\n`)
  try {
    await usbDevice.connect()
    await usbDevice.createTerminal(ExtensionContextStore.context)
    usbDevice.setIconPath()
    usbDevicesProvider.refresh()
    ExtensionContextStore.emit('connectUsbDevice', usbDevice)
    await usbDevice.ifc.sendBreak()
    ExtensionContextStore.inform('Connected')
    return await Promise.resolve(null)
  } catch (error: unknown) {
    ExtensionContextStore.error('Error Opening Port', error, true)
    return await Promise.reject(error)
  }
}
