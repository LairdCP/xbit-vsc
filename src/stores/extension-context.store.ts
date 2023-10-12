import * as vscode from 'vscode'
import { UsbDevicesProvider } from '../providers/usb-devices.provider'
import { PyocdInterface } from '../lib/pyocd'
import { MemFS } from '../providers/file-system.provider'
import { EventEmitter } from 'events'
import { SetupTree } from '../components/tree.component'

export class ExtensionContextStore extends EventEmitter {
  context: vscode.ExtensionContext | undefined
  provider: UsbDevicesProvider | undefined
  pyocdInterface: PyocdInterface | undefined
  outputChannel: vscode.OutputChannel
  memFs = new MemFS()

  showZephyr = false
  constructor () {
    super()
    this.memFs.createDirectory(vscode.Uri.parse('memfs:/serial/'))
    this.outputChannel = vscode.window.createOutputChannel('xbitVsc')

    // initialize the config values
    const config = vscode.workspace.getConfiguration('xbit-vsc')
    this.showZephyr = config.get('show-zephyr', false)

    vscode.workspace.onDidChangeConfiguration(() => {
      const config = vscode.workspace.getConfiguration('xbit-vsc')
      const showZephyrWas = this.showZephyr
      this.showZephyr = config.get('show-zephyr', false)
      if (showZephyrWas !== this.showZephyr) {
        this.provider?.refresh()
      }
    })
  }

  init (
    context: vscode.ExtensionContext
  ): void {
    this.pyocdInterface = new PyocdInterface(context, this.outputChannel)
    this.provider = new UsbDevicesProvider(context, this.pyocdInterface)
    this.context = context
    SetupTree(this)
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', this.memFs, { isCaseSensitive: true }))
  }

  inform (message: string, window = false): void {
    this.outputChannel.appendLine(message)
    if (window) void vscode.window.showInformationMessage(message)
  }

  warn (message: string, window = false): void {
    this.outputChannel.appendLine(message)
    if (window) void vscode.window.showWarningMessage(message)
  }

  error (message: string, error: unknown, window = false): void {
    if (error instanceof Error) {
      this.outputChannel.appendLine(`${message}: ${String(error.message)}`)
      if (window) void vscode.window.showErrorMessage(`${message}: ${String(error.message)}`)
    } else {
      this.outputChannel.appendLine(message)
      if (window) void vscode.window.showErrorMessage(message)
    }
  }
}

export default new ExtensionContextStore()
