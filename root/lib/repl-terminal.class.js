const vscode = require('vscode')

class ReplTerminal {
  constructor (context, opts = {}) {
    this.writeEmitter = new vscode.EventEmitter()
    this.name = opts.name || 'REPL'
    this.inputCallback = null
    this.terminal = null

    let line = ''
    const pty = {
      onDidWrite: this.writeEmitter.event,
      open: () => this.writeEmitter.fire('Hello\r\n'),
      close: () => { /* noop */ },
      handleInput: (data) => {
        if (this.inputCallback) {
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

  onInput (callback) {
    this.inputCallback = callback
  }

  write (data) {
    // some terminals will echo writes, so ignore it
    this.writeEmitter.fire(data)
  }

  _write (data) {
    this.writeEmitter.fire(data)
  }

  remove () {
    this.terminal.dispose()
  }
}

module.exports = ReplTerminal
