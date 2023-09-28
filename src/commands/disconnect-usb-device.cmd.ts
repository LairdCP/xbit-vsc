import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function DisconnectUsbDeviceCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) {
    return await Promise.reject(new Error('ExtensionContextStore is not yet inited'))
  }

  const outputChannel = ExtensionContextStore.outputChannel
  const usbDevicesProvider = ExtensionContextStore.provider

  if (!usbDevice.connected) {
    return await Promise.resolve(null)
  }

  outputChannel.appendLine(`disconnecting from device ${usbDevice.name}\n`)
  try {
    await usbDevice.disconnect()
    await usbDevice.destroyTerminal()
    usbDevice.setIconPath()
    usbDevicesProvider.refresh()
    ExtensionContextStore.emit('command', 'disconnectUsbDevice', usbDevice)
    return await Promise.resolve(null)
  } catch (error: any) {
    await vscode.window.showInformationMessage(`Error closing port: ${String(error.message)}`)
    return await Promise.reject(error)
  }
}
