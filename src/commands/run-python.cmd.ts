// import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function RunPythonCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  try {
    const usbDevice = usbDeviceFile.parentDevice
    ExtensionContextStore.outputChannel.appendLine('Running Python File')

    let dataToWrite = await usbDeviceFile.readFileFromDevice()
    await usbDevice.ifc.sendEnterRawMode()
    while (dataToWrite.length > 0) {
      const data = dataToWrite.slice(0, 255)
      dataToWrite = dataToWrite.slice(255)
      usbDevice.ifc.write(data)
    }
    const result = await usbDevice.ifc.sendExecuteRawMode()
    await usbDevice.ifc.sendExitRawMode()
    ExtensionContextStore.inform('File Executed:' + usbDeviceFile.name)
    ExtensionContextStore.outputChannel.appendLine(result.trim())

    return await Promise.resolve(null)
  } catch (error: unknown) {
    return await Promise.reject(error)
  }
}
