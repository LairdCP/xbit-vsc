import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import { DeviceConfigurations, DeviceCommand } from '../lib/util.ifc'
import ExtensionContextStore from '../stores/extension-context.store'

export async function UpdateUsbDeviceSettingsCommand (usbDevice: UsbDevice, message: DeviceCommand): Promise<null | Error> {
  const config = vscode.workspace.getConfiguration('xbit-vsc')

  // save
  if (usbDevice !== undefined && usbDevice !== null) {
    let deviceConfigurations: DeviceConfigurations | undefined = config.get('device-configurations')
    if (deviceConfigurations === undefined) {
      deviceConfigurations = {}
    }
    const key = `${usbDevice.serialNumber}.${String(usbDevice.options.idx)}`

    let baudRate = usbDevice.baudRate
    if ('baudRate' in message.params) {
      baudRate = parseInt(String(message.params.baudRate))
      if (isNaN(baudRate)) {
        return await Promise.reject(new Error('Invalid baud rate'))
      }
    }

    let name = usbDevice.options.board_name
    if ('name' in message.params) {
      name = String(message.params.name)
      if (name.length === 0) {
        name = usbDevice.options.board_name
      }
    }

    deviceConfigurations[key] = {
      baudRate,
      name
    }
    await config.update('device-configurations', deviceConfigurations, vscode.ConfigurationTarget.Global)

    usbDevice.name = name
    usbDevice.baudRate = baudRate
    ExtensionContextStore.provider?.refresh()
    // refresh?devPath
  }
  return await Promise.resolve(null)
}
