import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'
const config = vscode.workspace.getConfiguration('xbit-vsc')

interface Message {
  baudRate: number
  name: string
}

export async function UpdateUsbDeviceSettingsCommand (usbDevice: UsbDevice, message: Message): Promise<null | Error> {
  // save
  if (usbDevice !== undefined && usbDevice !== null) {
    const deviceConfigurations: any = config.get('device-configurations')
    const key = `${usbDevice.serialNumber}.${String(usbDevice.label)}`

    deviceConfigurations[key] = {
      baudRate: message.baudRate,
      name: message.name === '' ? usbDevice.options.board_name : message.name
    }

    await config.update('device-configurations', deviceConfigurations, vscode.ConfigurationTarget.Global)
    usbDevice.name = deviceConfigurations[key].name
    usbDevice.baudRate = message.baudRate
    ExtensionContextStore.provider?.refresh()
    // refresh?devPath
  }
  return await Promise.resolve(null)
}
