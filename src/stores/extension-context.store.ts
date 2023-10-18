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
  tree: vscode.TreeView<unknown> | undefined
  memFs = new MemFS()

  showZephyr = false
  showRepl = false
  muted = false
  initializePending = false

  constructor () {
    super()
    this.memFs.createDirectory(vscode.Uri.parse('memfs:/serial/'))
    this.outputChannel = vscode.window.createOutputChannel('xbitVsc')

    // initialize the config values
    const config = vscode.workspace.getConfiguration('xbit-vsc')
    this.showZephyr = config.get('show-zephyr', false)
    this.showRepl = config.get('show-repl', false)

    vscode.workspace.onDidChangeConfiguration(() => {
      const config = vscode.workspace.getConfiguration('xbit-vsc')
      const showZephyrWas = this.showZephyr
      this.showZephyr = config.get('show-zephyr', false)
      this.showRepl = config.get('show-repl', false)
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

    // check if the workspace settings.json file has the xbit-vsc settings in it
    // if not, ignore
    // else, update stubs
    context.subscriptions.push(vscode.extensions.onDidChange(async () => {
      if (this.initializePending) {
        const installed = vscode.extensions.getExtension('ms-python.vscode-pylance') !== undefined &&
          vscode.extensions.getExtension('ms-python.python') !== undefined

        if (installed) {
          await vscode.commands.executeCommand('xbitVsc.initializeProject', this.initializePending)
          this.initializePending = false
        }
      }
    }))
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

  mute (): void {
    this.muted = true
  }

  unmute (): void {
    // the readble stream from for the tserial interface
    // can be slow sometimes so wait a tick or two before unmuting
    setTimeout(() => {
      this.muted = false
    }, 500)
  }

  get configurationTarget (): vscode.ConfigurationTarget {
    if (vscode.workspace.workspaceFolders !== undefined) {
      return vscode.ConfigurationTarget.Workspace
    }
    return vscode.ConfigurationTarget.Global
  }
}

export default new ExtensionContextStore()
