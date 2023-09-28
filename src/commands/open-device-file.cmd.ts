import * as vscode from 'vscode'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function OpenDeviceFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  // e.command.arguments[0].label is the file selected
  // e.command.arguments[1].main is the device selected
  const outputChannel = ExtensionContextStore.outputChannel
  const memFs = ExtensionContextStore.memFs
  outputChannel.appendLine(`Opening File ${usbDeviceFile.label}\n`)

  try {
    // if file exists in cache, switch to it
    memFs.stat(usbDeviceFile.uri)
    await vscode.window.showTextDocument(usbDeviceFile.uri)
    outputChannel.appendLine(`Show File ${usbDeviceFile.name}\n`)
    return await Promise.resolve(null)
  } catch (error: any) {
    outputChannel.appendLine(`File Does Not Exist Yet ${String(error.message)}\n`)
  }

  // if not connected, connect
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  outputChannel.appendLine('Ensuring Path Exists\n')
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
        outputChannel.appendLine(`Creating Path ${pathToCreate}`)
        memFs.createDirectory(pathUri)
      }
    }
  }

  // open file
  try {
    outputChannel.appendLine('Reading file from device ... \n')
    const result: string = await usbDeviceFile.readFileFromDevice()
    const fileData = Buffer.from(result, 'ascii')

    memFs.writeFile(usbDeviceFile.uri, fileData, { create: true, overwrite: true })
    await vscode.window.showTextDocument(usbDeviceFile.uri)
    outputChannel.appendLine(`Opened File ${usbDeviceFile.name}\n`)
    return await Promise.resolve(null)
  } catch (error: any) {
    console.error('error', error)
    outputChannel.appendLine(`Error Opening File ${String(error.message)}\n`)
    await vscode.window.showErrorMessage(`Error opening file: ${String(error.message)}`)
    return await Promise.reject(error)
  }
}
