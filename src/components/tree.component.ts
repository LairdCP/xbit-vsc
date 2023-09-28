import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'

export function SetupTree (ExtensionContextStore: any): vscode.TreeView<any> {
  const options = {
    treeDataProvider: ExtensionContextStore.provider,
    showCollapseAll: true
  }
  const tree = vscode.window.createTreeView('xbitVsc', options)

  tree.onDidChangeSelection(async (e: vscode.TreeViewSelectionChangeEvent<any>) => {
    console.log('onDidChangeSelection', e) // breakpoint here for debug
    if (ExtensionContextStore.provider.webview !== undefined) {
      if (e.selection.length > 0) {
        await ExtensionContextStore.provider.onSelected(e.selection[0])
      } else {
        await ExtensionContextStore.provider.onDeselected()
      }
    }

    if (e.selection.length > 0) {
      const usbDevice = e.selection[0]
      if (usbDevice instanceof UsbDevice) {
        if (usbDevice.connected) {
          // if connected, show the terminal
          await usbDevice.showTerminal()
        }
      }
    }
  })

  tree.onDidCollapseElement(e => {
    console.log('onDidCollapseElement', e) // breakpoint here for debug
  })

  tree.onDidChangeVisibility(e => {
    console.log('onDidChangeVisibility', e) // breakpoint here for debug
  })

  tree.onDidExpandElement(e => {
    console.log('onDidExpandElement', e) // breakpoint here for debug
  })
  return tree
}
