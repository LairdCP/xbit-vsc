import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function OpenDeviceFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  // e.command.arguments[0].label is the file selected
  // e.command.arguments[1].main is the device selected
  const memFs = ExtensionContextStore.memFs
  ExtensionContextStore.inform(`Opening File ${usbDeviceFile.label}`)
  try {
    // if file exists in cache, switch to it
    memFs.stat(usbDeviceFile.uri)
    await vscode.window.showTextDocument(usbDeviceFile.uri)
    ExtensionContextStore.inform(`Show File ${usbDeviceFile.name}`)
    return await Promise.resolve(null)
  } catch (error: unknown) {
    ExtensionContextStore.warn('File Does Not Exist Yet')
  }

  // if not connected, connect
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  ExtensionContextStore.inform(`Ensuring Path Exists ${usbDeviceFile.parentDevice.uri.path}`)
  const pathParts = usbDeviceFile.parentDevice.uri.path.split('/')
  let pathToCreate = ''
  while (pathParts.length !== 0) {
    const nextPath = pathParts.shift()
    if (nextPath !== undefined) {
      pathToCreate = pathToCreate + '/' + nextPath
      const pathUri = vscode.Uri.parse('memfs:/' + pathToCreate)
      try {
      // check if directory exists in memfs
        memFs.stat(pathUri)
      } catch (error) {
        ExtensionContextStore.inform(`Creating Path ${pathToCreate}`)
        memFs.createDirectory(pathUri)
      }
    }
  }

  // open file
  try {
    ExtensionContextStore.inform(`Reading File ${usbDeviceFile.name}`)
    ExtensionContextStore.mute()
    // const result: string = await usbDeviceFile.readFileFromDevice()
    const result: string = await usbDeviceFile.parentDevice.filesystem.readFile(usbDeviceFile)
    const fileData = Buffer.from(result, 'ascii')

    memFs.writeFile(usbDeviceFile.uri, fileData, { create: true, overwrite: true })
    await vscode.window.showTextDocument(usbDeviceFile.uri)
    ExtensionContextStore.inform(`Opened File ${usbDeviceFile.name}\n`)
    return await Promise.resolve(null)
  } catch (error: unknown) {
    return await Promise.reject(error)
  } finally {
    ExtensionContextStore.unmute()
  }
}
