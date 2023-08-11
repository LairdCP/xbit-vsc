// extends EventEmitter
// emits 'data', 'error', 'close', 'open'

// class UsbDeviceInterface extends EventEmitter {
//   // create a new UsbDevice
//   constructor(options) {
//     super()
//     this.path = options.path
//     this.baudRate = options.baudRate || 115200
//     this.connected = false

//     // connect and query device, then disconnect

//   }
//   //// methods
//   // connect
//   connect() {
//     return new Promise((resolve, reject) => {

//       this._serialPort = new SerialPort({
//         path: this.path,
//         baudRate: this.baudRate
//       })

//     })
//   }
//   // disconnect

//   // break

//   // write

//   // writeWait

//   // writeWaitFor

//   // readWait

// }

const path = require('path')
const vscode = require('vscode')

class UsbDevice extends vscode.TreeItem {
  constructor (
    uri,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    port,
    collapsibleState,
    type,
    command
  ) {
    super(uri.path, collapsibleState)
    this.uri = uri
    this.port = port
    this.baudRate = 115200
    this.tooltip = `${this.label}`
    this.command = command // default vs code command when clicking on item
    this.type = type
    this.contextValue = 'usbDevice'

    // this.serialPort = new UsbDeviceInterface({
    //   path: this.path,
    //   baudRate: 115200,
    // })
  }

  get uriString () {
    return this.uri.toString()
  }

  get path () {
    return this.port.path
  }

  get parentDevice () {
    return this
  }

  get description () {
    return this.port.manufacturer || ''
  }

  get replCapable () {
    return this.type === 'repl'
  }

  get iconPath () {
    if (this.replCapable) {
      return {
        light: path.join(__filename, '../../..', 'resources', 'light', 'repl-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'repl-device.svg')
      }
    } else if (this.type === 'uart') {
      return {
        light: path.join(__filename, '../../..', 'resources', 'light', 'uart-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'uart-device.svg')
      }
    } else {
      return {
        light: path.join(__filename, '../../..', 'resources', 'light', 'usb-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'usb-device.svg')
      }
    }
  }

  get connected () {
    return false
    // return this.serialPort.connected
  }

  // connect() {
  //   return new Promise((resolve, reject) => {
  //     this.serialPort.connect()
  //     .then(() => {
  //       vscode.window.showInformationMessage(`Port Connected: ${this.connected}`);
  //       resolve()
  //     })
  //     .catch((error) => {
  //       vscode.window.showInformationMessage(`Error opening port: ${error.message}`);
  //       reject(error)
  //     })
  //   })
  // }
}

class UsbDeviceFile extends vscode.TreeItem {
  constructor (
    uri,
    type,
    size,
    command
  ) {
    const label = uri.path.split('/').pop()
    super(label, vscode.TreeItemCollapsibleState.None)
    this.uri = uri
    this.size = size
    this.type = type
    this.command = command
  }

  // full fs path
  get dir () {
    return path.dirname(this.uri.path)
  }

  // file system provider.readFile will figure this out
  get devPath () {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }

  get tooltip () {
    return this.uri.path
  }

  get contextValue () {
    return this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
  }

  get iconPath () {
    return {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-file.svg')
    }
  }
}

class UsbDeviceFolder extends vscode.TreeItem {
  constructor (
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    command
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed)
    this.path = label
    this.tooltip = `${this.label}`
    this.command = command
    this.contextValue = 'usbDeviceFolder'
    // this.iconPath = iconPath;
    // this.children = children;
  }

  get iconPath () {
    return {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-folder.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-folder.svg')
    }
  }
}
module.exports = {
  UsbDevice,
  UsbDeviceFile,
  UsbDeviceFolder
}
