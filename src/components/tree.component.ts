import * as vscode from 'vscode'
import { UsbDevice } from '../lib/usb-device.class'
import { ExtensionContextStore } from '../stores/extension-context.store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SetupTree (ExtensionContextStore: ExtensionContextStore): vscode.TreeView<any> {
  if (ExtensionContextStore.provider === undefined || ExtensionContextStore.context === undefined) throw new Error('Provider not initialized')

  const options = {
    treeDataProvider: ExtensionContextStore.provider,
    dragAndDropController: ExtensionContextStore.provider,
    canSelectMany: false,
    showCollapseAll: true
  }
  vscode.window.registerTreeDataProvider('xbitVsc', ExtensionContextStore.provider)
  const tree = vscode.window.createTreeView('xbitVsc', options)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree.onDidChangeSelection(async (e: vscode.TreeViewSelectionChangeEvent<any>) => {
    // console.log('onDidChangeSelection', e) // breakpoint here for debug

    if (e.selection.length > 0) {
      ExtensionContextStore.emit('selectedDevice', e.selection[0])
      const usbDevice = e.selection[0]
      if (usbDevice instanceof UsbDevice) {
        if (usbDevice.connected) {
          // if connected, show the terminal
          await usbDevice.showTerminal()
        }
      }
    } else {
      ExtensionContextStore.emit('deselectedDevice')
    }
  })

  tree.onDidCollapseElement(e => {
    // console.log('onDidCollapseElement', e) // breakpoint here for debug
  })

  tree.onDidChangeVisibility(e => {
    // console.log('onDidChangeVisibility', e) // breakpoint here for debug
  })

  tree.onDidExpandElement(e => {
    // console.log('onDidExpandElement', e) // breakpoint here for debug
  })

  // tree is a disposable object so we need to push it to subscriptions
  ExtensionContextStore.context.subscriptions.push(tree)
  return tree
}
