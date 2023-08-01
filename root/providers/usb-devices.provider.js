const vscode = require('vscode')
const fs  = require('fs')
const path = require('path');
const { SerialPort, ReadlineParser } = require('serialport')
const async = require('async')
const ReplTerminal = require('../lib/repl-terminal.class')

class UsbDevicesProvider {
  constructor(workspaceRoot, context) {
    this.workspaceRoot = workspaceRoot
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.connected = false
    this.items = []
    this.serialPort = null
    this.parser = null
    this.lastSentHex = null
    this.resultBuffer = ''
  }

  get onDidChangeTreeData () {
    return this._onDidChangeTreeData.event
  }

  refresh() {
		this._onDidChangeTreeData.fire();
	}

  connect (element) {
    return new Promise((resolve, reject) => {
      if (element.path === this.connected) {
        return resolve()
      } else if (this.connected) {
        this.disconnect()
      }

      this.connected = element.path
      this.serialPort = new SerialPort({
        path: element.path,
        baudRate: element.baudRate || 115200
      }, (error) => {
        if (error) {
          // notify user of error
          vscode.window.showInformationMessage(`Error opening port: ${error.message}`);
          reject(error)
        } else {
          vscode.window.showInformationMessage(`Port Connected: ${this.connected}`);
          this.refresh()

          // open terminal
          this.terminal = new ReplTerminal(this.context)
          this.terminal.onInput((data) => {
            // send line to the serial port
            const hex = Buffer.from(data).toString('hex')
            this.lastSentHex = hex
            // console.log('write to serial', hex, data)
            this.serialPort.write(data)
          })
          resolve()
        }
      })

      this.serialPort.on('data', (data) => {
        this.resultBuffer += data.toString()
        if (this.terminal) {
          // for terminal interfaces that echo the input
          if (this.lastSentHex + '0a' === data.toString('hex') 
            || this.lastSentHex === data.toString('hex')) {
            return this.terminal.write('\n\r')
          }
          this.terminal.write(data.toString())
        }
      })
    })
  }

  connectAndExecute (port, command, callback) {
    let timedOut = false
    const portTimeout = setTimeout(() => {
      timedOut = true
      closePort()
    }, 1000)

    const tempPort = new SerialPort({
      path: port.path,
      baudRate: 115200
    }, (error) => {
      if (error) {
        closePort()
      }
    })

    const closePort = (error) => {
      clearTimeout(portTimeout)
      tempPort.removeAllListeners()
      try {
        tempPort.close()
      } catch (error) {
        console.log('error closing port', error)
      }
      callback(error, receivedData)
    }

    let receivedData = ''
    tempPort.on('data', (data) => {
      // console.log('data', data.toString())
      receivedData += data.toString()
    })

    tempPort.on('open', () => {
      tempPort.write(command)
      setTimeout(() => {
        closePort()
      }, 100)
    })

    tempPort.on('error', (error) => {
      if (timedOut) return
      closePort(error)
    })
  }


  disconnect () {
    this.connected = false
    try {
      if (this.serialPort && this.serialPort.port) {
        this.serialPort.close()
        this.serialPort = null
        this.terminal.remove()
        this.refresh()
        vscode.window.showInformationMessage('Port Disconnected');
      }
    } catch (error) {
      console.log('error closing port', error)
      vscode.window.showInformationMessage(`Error closing port: ${error.message}`);
    }
  }

  getTreeItem(element) {
    console.log('getTreeItem', element.path, this.connected)
    if (element.path === this.connected) {
      element.contextValue = 'usbDeviceConnected'
    } else if (element.contextValue !== 'usbDeviceFile') {
      element.contextValue = 'usbDevice'
    }
    return element
  }
  
  getChildren(element) {
    console.log('getChildren', element)

    // element is the parent tree item
    // workspaceRoot is falsey if not currently in a workspace, otherwise it's the path
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      // connect to device by path and query device files
      // populate tree items
      const boot = new UsbDeviceFile('boot.py')
      const main = new UsbDeviceFile('main.py')

      boot.command = {
        command: 'usbDevices.openDeviceFile',
        arguments: [boot, element]
      }

      main.command = {
        command: 'usbDevices.openDeviceFile',
        arguments: [main, element]
      }

      return Promise.resolve([
        boot,
        main
      ])
    } else {
      return new Promise((resolve, reject) => {
        SerialPort.list().then((ports) => {
          console.log(ports)
          // mark devices as pending. If they are not in the list after the scan, remove them
          this.items.forEach((item) => {
            item.pending = true
          })

          // for each port, check if it's already known.
          // if not, connect and detect if repl capable
          async.eachSeries(ports, (port, next) => {

            for (let idx = 0; idx < this.items.length; idx++) {
              if (this.items[idx].path === port.path) {
                /// already in list
                delete this.items[idx].pending
                return next()
              }
            }

            this.connectAndExecute(port, '\r\n', (error, result) => {
              // if data is >>> it is a repl capable device
              if (result.indexOf('>>>') > -1) {
                let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, 'repl')
                this.items.push(portItem )
              } else if (result.indexOf('uart:~$') > -1) {
                let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, 'uart')
                this.items.push(portItem )
              } else if (result) {
                let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, false)
                this.items.push(portItem )
              }
              next(error)
            })

          }, (error) => {
            if (error) {
              reject(error)
            }
            // remove items that are no longer in the list
            this.items = this.items.filter((item) => {
              return !item.pending
            })
            resolve(this.items)
          })
        })
      })
    }
  }

  ls(element) {
    if (this.connected === element.path) {

    } else {

    }
  }

  writeWait(command, wait = 10, timeout = 1000) {
    return new Promise((resolve, reject) => {
      this.resultBuffer = ''
      this.serialPort.write(command)
      let waiting = setInterval(() => {
        if (this.resultBuffer.indexOf('>>>') > -1) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          resolve(this.resultBuffer)
          this.resultBuffer = ''
        }

        if (this.resultBuffer.indexOf('Error') > -1) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          reject(this.resultBuffer)
          this.resultBuffer = ''
        }
      }, wait)

      let timeouting = setTimeout(() => {
        clearInterval(waiting)
        reject('timeout')
      }, timeout)
    })
  }
}

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
    this.command = command
    this.replCapable = type === 'repl'
    this.type = type
    this.contextValue = 'usbDevice'
    // this.iconPath = iconPath;
    // this.children = children;
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
}

class UsbDeviceFile extends vscode.TreeItem {
  constructor(
    label,
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon,
    command,
      ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.path = label
    this.tooltip = `${this.label}`;
    this.command = command;
    this.contextValue = 'usbDeviceFile';
    // this.iconPath = iconPath;
    // this.children = children;
  }
  get iconPath() {
    return {
      light: path.join(__filename, '..', '..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '..', '..', 'resources', 'dark', 'gen-file.svg')
    }
  }


}

module.exports = UsbDevicesProvider;