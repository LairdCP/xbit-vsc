import * as vscode from 'vscode'
import * as path from 'path'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import ExtensionContextStore from '../stores/extension-context.store'
import * as fs from 'fs/promises'
import { UsbDeviceFolder } from '../lib/usb-device-folder.class'

export async function RenameDeviceFileCommand (usbDeviceFile: UsbDeviceFile | UsbDeviceFolder): Promise<null | Error> {
  if (!usbDeviceFile.parentDevice.connected) {
    await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', usbDeviceFile.parentDevice)
  }

  const config = vscode.workspace.getConfiguration('xbit-vsc')

  // create a new file object with unamed file
  const newFileName = await vscode.window.showInputBox({
    value: usbDeviceFile.label
  })

  if (newFileName !== undefined && ExtensionContextStore.provider !== undefined) {
    try {
      if (usbDeviceFile.parentDevice.filesystem === null) {
        throw new Error('Device File System Not Found')
      }
      if (usbDeviceFile.parentDevice.filesystem.opLock !== false) {
        throw new Error(usbDeviceFile.parentDevice.filesystem.opLock as string)
      }

      // rename the file on the device
      // /test-one/file001
      const oldFilePath = usbDeviceFile.devPath

      // file001
      const oldFileName = oldFilePath.split('/').pop() ?? ''

      // /test-one/file002
      const newFilePath = oldFilePath.replace(oldFileName, newFileName)

      if (oldFilePath === '' || newFilePath === '') {
        throw new Error('invalid file path for rename')
      }
      // /serial/F1924F836EF168E9/dev/tty.usbmodem3201
      // const key = usbDeviceFile.parentDevice.uri.path
      await usbDeviceFile.parentDevice.renameFile(oldFilePath, newFilePath)

      // rename in MemFS cache
      const newPath = path.dirname(usbDeviceFile.uri.path) + '/' + newFileName

      ExtensionContextStore.provider.treeCache.delete(usbDeviceFile.uri.path)
      const newUri = usbDeviceFile.uri.with({ path: vscode.Uri.parse(newPath).path })
      try {
        ExtensionContextStore.memFs.rename(usbDeviceFile.uri, newUri, { overwrite: true })
      } catch (ex) {
        console.error('Error renaming file in MemFS cache', ex)
        // can't rename file as it's not been loaded
        // OK
      }
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

      if (usbDeviceFile instanceof UsbDeviceFile) {
        const location: string | undefined = config.get('python-venv')
        if (location !== undefined) {
          const oldFilename = ExtensionContextStore.getLocalFileFromUri(usbDeviceFile.uri)
          const newFilename = ExtensionContextStore.getLocalFileFromUri(newUri)

          await fs.rename(path.join(location, oldFilename), path.join(location, newFilename))
          ExtensionContextStore.inform('File Renamed', false)
        }
      }
      ExtensionContextStore.inform(`Renamed File ${oldFileName} to ${newFileName}\n`)
      return await Promise.resolve(null)
    } catch (error: unknown) {
      return await Promise.reject(error)
    }
  }
  return await Promise.resolve(null)
}
