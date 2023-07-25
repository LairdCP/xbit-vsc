const vscode = require('vscode')

class ReplTerminal {
  constructor(context, opts = {}) {
    this.writeEmitter = new vscode.EventEmitter()
    this.name = opts.name || 'REPL'
    this.inputCallback = null
    this.terminal = null

    let line = '';
    const pty = {
      onDidWrite: this.writeEmitter.event,
      open: () => this.writeEmitter.fire('Hello\r\n'),
      close: () => { /* noop*/ },
      handleInput: (data) => {
        if (data === '\r') { // Enter
          if (this.inputCallback) {
            this.inputCallback(`${line}\r\n`)
          }  
          line = '';
          return;
        }
        if (data === '\x7f') { // Backspace
          if (line.length === 0) {
            return;
          }
          line = line.substring(0, line.length - 1);
          // Move cursor backward
          this.write('\x1b[D');
          // Delete character
          this.write('\x1b[P');
          return;
        }
        line += data
        this.write(data)
      }
    };
    this.terminal = vscode.window.createTerminal({ name: this.name, pty });
    this.terminal.show();  
  }

  onInput (callback) {
    this.inputCallback = callback
  }

  write (data) {
    this.writeEmitter.fire(data);
  }

  remove() {
    this.terminal.dispose();
  }

}

module.exports = ReplTerminal