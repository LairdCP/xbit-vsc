import * as vscode from 'vscode'
import * as path from 'path'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function RenameDeviceFileCommand (usbDeviceFile: UsbDeviceFile): Promise<null | Error> {
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  // create a new file object with unamed file
  const newFilePath = await vscode.window.showInputBox({
    value: usbDeviceFile.label
  })
  if (newFilePath !== undefined && ExtensionContextStore.provider !== undefined) {
    try {
      // rename the file on the device
      const oldFilePath = usbDeviceFile.devPath.split('/').pop() ?? ''
      const newFileName = newFilePath.split('/').pop() ?? ''
      if (oldFilePath === '' || newFileName === '') {
        throw new Error('invalid file path for rename')
      }
      const key = usbDeviceFile.parentDevice.uri.path
      await usbDeviceFile.parentDevice.renameFile(oldFilePath, newFileName)

      // rename in MemFS cache
      const newPath = path.dirname(usbDeviceFile.uri.path) + '/' + newFileName
      const newUri = usbDeviceFile.uri.with({ path: vscode.Uri.parse(newPath).path })
      try {
        ExtensionContextStore.memFs.rename(usbDeviceFile.uri, newUri, { overwrite: true })
      } catch (ex) {
        // can't rename file as it's not been loaded
        // OK
      }
      ExtensionContextStore.provider.treeCache.delete(key)
      ExtensionContextStore.provider.refresh()

      // close and reopend the renamed file
      try {
        await vscode.window.showTextDocument(usbDeviceFile.uri)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
        await vscode.window.showTextDocument(newUri)
      } catch (ex) {
        // can't open file as it's not been loaded
        // OK
      }
      ExtensionContextStore.inform(`Renamed File ${usbDeviceFile.label} to ${newFileName}\n`)
      return await Promise.resolve(null)
    } catch (error: unknown) {
      console.log(error)
      ExtensionContextStore.error('Error Renaming File', error, true)
      return await Promise.reject(error)
    }
  }
  return await Promise.resolve(null)
}
