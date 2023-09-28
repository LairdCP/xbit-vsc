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
      ExtensionContextStore.memFs.rename(usbDeviceFile.uri, newUri, { overwrite: true })

      ExtensionContextStore.provider.treeCache.delete(key)
      ExtensionContextStore.provider.refresh()

      // close and reopend the renamed file
      await vscode.window.showTextDocument(usbDeviceFile.uri)
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
      await vscode.window.showTextDocument(newUri)
      void vscode.window.showInformationMessage(`Renamed File: ${newFileName ?? ''}`)
      ExtensionContextStore.outputChannel.appendLine(`Renamed File ${usbDeviceFile.label} to ${newFileName}\n`)
      return await Promise.resolve(null)
    } catch (error: any) {
      void vscode.window.showInformationMessage('Error Renaming File')
      ExtensionContextStore.outputChannel.appendLine(`Error Renaming File ${String(error.message)}\n`)
      return await Promise.reject(error)
    }
  }
  return await Promise.resolve(null)
}
