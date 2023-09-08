import * as vscode from 'vscode'

interface ReplOptions {
  name?: string
}

export class ReplTerminal {
  writeEmitter: vscode.EventEmitter<string>
  name: string
  history: string[] = []
  inputCallback: (data: string) => void
  private readonly terminal: vscode.Terminal | null

  constructor (context: vscode.ExtensionContext, opts: ReplOptions = {}) {
    this.writeEmitter = new vscode.EventEmitter()
    this.name = opts.name ?? 'REPL'
    this.inputCallback = () => { /* noop */ }
    this.terminal = null

    let line = ''
    const pty = {
      onDidWrite: this.writeEmitter.event,
      open: () => {
        setTimeout(() => {
          this.writeEmitter.fire('Terminal Connected, Press Enter to Interact:\r\n')
        }
        , 100)
      },
      close: () => { /* noop */ },
      handleInput: (data: string) => {
        if (this.inputCallback !== null) {
          // this callback is set by the UsbDevicesProvider
          // it writes the input to the serial port for the usb device
          this.inputCallback(data)
        }
        if (data === '\r') { // Enter
          this.history.unshift(line)
          if (this.history.length > 100) {
            this.history.pop()
          }
          line = ''
        }
        if (data === '\x7f') { // Backspace
          if (line.length === 0) {
            return
          }
          line = line.substring(0, line.length - 1)
          return
        }
        line += data
      }
    }
    this.terminal = vscode.window.createTerminal({ name: this.name, pty })
    this.terminal.show()
  }

  onInput (callback: () => void): void {
    this.inputCallback = callback
  }

  write (data: string): void {
    // some terminals will echo writes, so ignore it
    this.writeEmitter.fire(data)
  }

  _write (data: string): void {
    this.writeEmitter.fire(data)
  }

  remove (): void {
    if (this.terminal !== null) {
      this.terminal.dispose()
    }
  }
}
