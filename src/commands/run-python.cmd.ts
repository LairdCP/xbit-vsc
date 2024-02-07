// import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function RunPythonCommand (usbDeviceFile: UsbDeviceFile, reset: boolean): Promise<null | Error> {
  try {
    const usbDevice = usbDeviceFile.parentDevice
    ExtensionContextStore.outputChannel.appendLine('Running Python File')

    // reboot device - this can take a few seconds
    if (reset) {
      await usbDevice.ifc.sendEof()
    }

    let dataToWrite = await usbDeviceFile.readFileFromDevice()
    await usbDevice.ifc.sendEnterRawMode()
    while (dataToWrite.length > 0) {
      const data = dataToWrite.slice(0, 255)
      dataToWrite = dataToWrite.slice(255)
      await usbDevice.ifc.write(data)
    }
    const result = await usbDevice.ifc.sendExecuteRawMode()
    await usbDevice.ifc.sendExitRawMode()
    ExtensionContextStore.inform('File Executed:' + usbDeviceFile.name)
    ExtensionContextStore.outputChannel.appendLine(result.trim())

    return await Promise.resolve(null)
  } catch (error: unknown) {
    console.log('RunPythonCommand', error)
    return await Promise.reject(error)
  }
}
