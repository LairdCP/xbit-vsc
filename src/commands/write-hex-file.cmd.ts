import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import ExtensionContextStore from '../stores/extension-context.store'

export async function WriteHexFileCommand (usbDevice: UsbDevice): Promise<null | Error> {
  const outputChannel = ExtensionContextStore.outputChannel
  const pyocdInterface = ExtensionContextStore.pyocdInterface

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
      let _progress: any = null
      let _increment = 0
      void vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Loading ${onFulfilled[0].fsPath}`,
        cancellable: false
      }, async (progress) => {
        _progress = progress
        _progress.report({ increment: _increment, message: 'Loading File...' })
      })

      const pyocdCommand = ['flash', '--target=nrf52833', '-u', usbDevice.serialNumber, '-e', 'chip', onFulfilled[0].fsPath]
      await pyocdInterface.runCommand('pyocd', pyocdCommand, (data: string) => {
        if (_progress === null) {
          _increment = _increment + 2.5
          return
        }
        // on progress
        if (data === '=') {
          _progress.report({ increment: 2.5, message: 'Loading File...' })
        }
        if (data === '=]') {
          // done
          _progress.report({ increment: 2.5, message: 'Complete' })
        }
      })

      return await Promise.resolve(null)
    } catch (error: any) {
      console.error('error', error)
      outputChannel.appendLine(`Error Writing File ${String(error.message)}\n`)
      await vscode.window.showErrorMessage(`Error writing file: ${String(error.message)}`)
      return await Promise.reject(error)
    }
  } else {
    // cancelled
    // throw new Error('No file selected')
    return await Promise.resolve(null)
  }
}
