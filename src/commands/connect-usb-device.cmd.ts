import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function ConnectUsbDeviceCommand (usbDevice: UsbDevice): Promise<null | Error> {
  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) {
    return await Promise.reject(new Error('ExtensionContextStore is not yet inited'))
  }

  const outputChannel = ExtensionContextStore.outputChannel
  const usbDevicesProvider = ExtensionContextStore.provider

  if (usbDevice.connected) {
    return await Promise.resolve(null)
  }

  outputChannel.appendLine(`connecting to device ${String(usbDevice.name)}\n`)
  try {
    await usbDevice.connect()
    await usbDevice.createTerminal(ExtensionContextStore.context)
    usbDevice.setIconPath()
    usbDevicesProvider.refresh()
    ExtensionContextStore.emit('command', 'connectUsbDevice', usbDevice)
    void vscode.window.showInformationMessage(`Port Connected: ${String(usbDevice.options.path)}`)
    usbDevice.ifc.sendBreak()
    return await Promise.resolve(null)
  } catch (error: any) {
    void vscode.window.showErrorMessage(`Error Connecting to Port: ${String(error.message)}`)
    return await Promise.reject(error)
  }
}
