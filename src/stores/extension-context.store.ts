import * as vscode from 'vscode'
import { UsbDevicesProvider } from '../providers/usb-devices.provider'
import { PyocdInterface } from '../lib/pyocd'
import { MemFS } from '../providers/file-system.provider'
import { EventEmitter } from 'events'

class ExtensionContextStore extends EventEmitter {
  context: vscode.ExtensionContext | undefined
  provider: UsbDevicesProvider | undefined
  pyocdInterface: PyocdInterface | undefined
  outputChannel: vscode.OutputChannel
  memFs = new MemFS()

  constructor () {
    super()
    this.memFs.createDirectory(vscode.Uri.parse('memfs:/serial/'))
    this.outputChannel = vscode.window.createOutputChannel('xbitVsc')
  }

  init (
    context: vscode.ExtensionContext
  ): void {
    this.pyocdInterface = new PyocdInterface(context, this.outputChannel)
    this.provider = new UsbDevicesProvider(context, this.pyocdInterface)
    this.context = context
    vscode.window.registerTreeDataProvider('xbitVsc', this.provider)
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', this.memFs, { isCaseSensitive: true }))
  }
}

export default new ExtensionContextStore()
