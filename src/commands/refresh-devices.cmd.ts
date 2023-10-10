// import * as vscode from 'vscode'
import ExtensionContextStore from '../stores/extension-context.store'

export async function RefreshDevicesCommand (): Promise<null | Error> {
  if (ExtensionContextStore.provider !== undefined) {
    // clear the cached devices list to hard refresh
    // for (const usbDevice of ExtensionContextStore.provider.usbDeviceNodes) {
    //   await vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', usbDevice)
    //   usbDevice.ifc.removeAllListeners('data')
    // }
    // ExtensionContextStore.provider.usbDeviceNodes.length = 0
    // ExtensionContextStore.provider.hiddenUsbDeviceNodes.length = 0
    ExtensionContextStore.provider.refresh()
    return await Promise.resolve(null)
  } else {
    return await Promise.reject(new Error('ExtensionContextStore.provider is undefined'))
  }
}
