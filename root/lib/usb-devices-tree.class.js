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
  constructor(
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    manufacturer,
    collapsibleState,
    type,
    command,
      ) {
    super(label, collapsibleState)
    this.path = label
    this.baudRate = 115200
    this.tooltip = `${this.label}`
    this.description = this.manufacturer || ''
    this.command = command // default vs code command when clicking on item
    this.replCapable = type === 'repl'
    this.type = type
    this.contextValue = 'usbDevice'
    
    // this.serialPort = new UsbDeviceInterface({
    //   path: this.path,
    //   baudRate: 115200,
    // })
  }

  get parentDevice () {
    return this
  }

  get iconPath() {
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

  get connected() {
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
  constructor(
    label,
    size,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    command,
      ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.path = label
    this.tooltip = `${this.label}`;
    this.command = command;
    this.contextValue = 'usbDeviceFile';
    this.size = size
    // this.iconPath = iconPath;
    // this.children = children;
  }
  get iconPath() {
    return {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-file.svg')
    }
  } 
}

class UsbDeviceFolder extends vscode.TreeItem {
  constructor(
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    command,
      ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.path = label
    this.tooltip = `${this.label}`;
    this.command = command;
    this.contextValue = 'usbDeviceFolder';
    // this.iconPath = iconPath;
    // this.children = children;
  }
  get iconPath() {
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
