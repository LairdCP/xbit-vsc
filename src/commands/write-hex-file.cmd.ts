import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function WriteHexFileCommand (usbDevice: UsbDevice): Promise<null | Error> {
  const outputChannel = ExtensionContextStore.outputChannel
  const pyocdInterface = ExtensionContextStore.pyocdInterface

  await vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', usbDevice)

  if (pyocdInterface === undefined) {
    throw new Error('pyocdInterface undefined')
  }

  // if (usbDevice.targetType === 'nrf52833') {
  outputChannel.show()
  outputChannel.appendLine(`write hex file ${usbDevice.name}\n`)
  const onFulfilled = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFolders: false,
    canSelectFiles: true,
    title: 'Select HEX file to write',
    openLabel: 'Select'
  })

  if (onFulfilled !== null && onFulfilled !== undefined && onFulfilled.length > 0) {
    try {
      return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Loading ${onFulfilled[0].fsPath}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Erasing Flash...' })
        // bt510 is 'nrf52840'
        const pyocdCommand = ['flash', '--target=nrf52833', '-u', usbDevice.serialNumber, '-e', 'chip', onFulfilled[0].fsPath]
        pyocdInterface.mute()
        await pyocdInterface.runCommand('pyocd', pyocdCommand, (data: string) => {
          // on progress
          if (data === '=') {
            progress.report({ increment: 2.5, message: 'Loading File...' })
          }
          if (data === '=]') {
            // done
            progress.report({ increment: 2.5, message: 'Complete' })
          }
        })
        return await Promise.resolve(null)
      })
    } catch (error: unknown) {
      ExtensionContextStore.error('Error Writing File', error, true)
      return await Promise.reject(error)
    } finally {
      pyocdInterface.unmute()
    }
  } else {
    // cancelled
    // throw new Error('No file selected')
    return await Promise.resolve(null)
  }
}
