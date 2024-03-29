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

    let dataToWrite: Buffer = await usbDevice.readFile(usbDeviceFile)
    await usbDevice.ifc.sendEnterRawMode()
    while (dataToWrite.length > 0) {
      const data = dataToWrite.slice(0, 255)
      dataToWrite = dataToWrite.slice(255)
      await usbDevice.ifc.write(data)
    }
    const result = await usbDevice.ifc.sendExecuteRawMode()
    await usbDevice.ifc.sendExitRawMode()
    ExtensionContextStore.inform('File Executed:' + usbDeviceFile.name)
    ExtensionContextStore.outputChannel.appendLine(result.toString().trim())

    return await Promise.resolve(null)
  } catch (error: unknown) {
    ExtensionContextStore.error('File Not Executed:' + usbDeviceFile.name, error, true)
    console.error('RunPythonCommand', error)
    return await Promise.reject(error)
  }
}
