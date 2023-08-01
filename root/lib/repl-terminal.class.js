const vscode = require('vscode')

class ReplTerminal {
  constructor(context, opts = {}) {
    this.writeEmitter = new vscode.EventEmitter()
    this.name = opts.name || 'REPL'
    this.inputCallback = null
    this.terminal = null
    this.history = []

    let line = '';
    const pty = {
      onDidWrite: this.writeEmitter.event,
      open: () => this.writeEmitter.fire('Hello\r\n'),
      close: () => { /* noop*/ },
      handleInput: (data) => {
        // if up key
        // erase line
        // write line from history
        // set history index
        
        if (this.inputCallback) {
          // this callback is set by the UsbDevicesProvider
          // it writes the input to the serial port for the usb device
          this.inputCallback(data)
        }
        if (data === '\r') { // Enter
          this.history.unshift(line);
          if (this.history.length > 100) {
            this.history.pop();
          }
          line = '';
        }
        if (data === '\x7f') { // Backspace
          if (line.length === 0) {
            return;
          }
          line = line.substring(0, line.length - 1);
          // Move cursor backward
          this._write('\x1b[D');
          // Delete character
          this._write('\x1b[P');
          return;
        }
        line += data
        //this._write(data)
      }
    };
    this.terminal = vscode.window.createTerminal({ name: this.name, pty });
    this.terminal.show();  
  }

  onInput (callback) {
    this.inputCallback = callback
  }

  write (data) {
    // some terminals will echo writes, so ignore it
    this.writeEmitter.fire(data);
  }

  _write (data) {
    this.writeEmitter.fire(data);
  }

  remove() {
    this.terminal.dispose();
  }

}

module.exports = ReplTerminal