const vscode = require('vscode')
const fs  = require('fs')
const path = require('path');
const { SerialPort, ReadlineParser } = require('serialport')
const async = require('async')
const ReplTerminal = require('../lib/repl-terminal.class')

const { UsbDevice, UsbDeviceFile, UsbDeviceFolder } = require('../lib/usb-devices-tree.class')

class UsbDevicesProvider {
  constructor(workspaceRoot, context) {
    this.workspaceRoot = workspaceRoot
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.connected = false
    this.usbDeviceNodes = []
    this.hiddenUsbDeviceNodes = [] // connected USB devices that don't response to serial query are put here
    this.serialPort = null
    this.parser = null
    this.lastSentHex = null
    this.resultBuffer = ''
    this.treeCache = {} // cache the file tree for each device and sub folder. Key is the device.path/folder/...
  }

  get onDidChangeTreeData () {
    return this._onDidChangeTreeData.event
  }

  refresh() {
		this._onDidChangeTreeData.fire();
	}

  connect (element, opts = {}) {
    console.log('connect', element, opts)
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
          element.contextValue = 'usbDeviceConnected'
          vscode.window.showInformationMessage(`Port Connected: ${this.connected}`);
          if (!opts.skipRefresh) {
            this.refresh()
          }

          // open terminal
          this.terminal = new ReplTerminal(this.context)
          this.terminal.onInput((data) => {
            // send line to the serial port
            const hex = Buffer.from(data).toString('hex')
            this.lastSentHex = hex
            this.serialPort.write(data)
          })
          resolve()
        }
      })

      this.serialPort.on('data', (data) => {
        this.resultBuffer += data.toString()
        if (this.terminal) {
          this.terminal.write(data.toString())
        }
      })
    })
  }

  disconnect (element, opts = {}) {
    this.connected = false
    try {
      if (this.serialPort && this.serialPort.port) {
        this.serialPort.close()
        this.serialPort = null
        this.terminal.remove()
        if (!opts.skipRefresh) {
          this.refresh()
        }
        element.contextValue = 'usbDevice'
        vscode.window.showInformationMessage('Port Disconnected');
      }
    } catch (error) {
      console.log('error closing port', error)
      vscode.window.showInformationMessage(`Error closing port: ${error.message}`);
    }
  }

  disconnectAll () {
    this.usbDeviceNodes.forEach((item) => {
      this.disconnect(item, { skipRefresh: true })
    })
  }

  // Connect to a port, execute a command, disconnect and return the result
  // This is used for commands that don't require a persistant connection to the device
  connectAndExecute (port, command) {
    if (this.connected === port.path) {
      this.disconnect()
    }

    // if already connected to the port, disconnect first
    return new Promise((resolve, reject) => {
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
        if (error) {
          return reject(error)
        }
        resolve(receivedData.replace(command, '')) // remove the command from the result
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
    })
  }

  getTreeItem(element) {
    return element
  }
  

  // list the connected parent nodes (USB Devices)
  _getUsbDevices() {
    return new Promise((resolve, reject) => {
      SerialPort.list().then((ports) => {
        console.log(ports)
        // mark devices as pending. If they are not in the list after the scan, remove them
        this.usbDeviceNodes.forEach((item) => item.pending = true)

        // for each port, check if it's already known.
        // if not, connect and detect if repl capable
        async.eachSeries(ports, (port, next) => {
          if (this.hiddenUsbDeviceNodes.indexOf(port.path) > -1) {
            return next()
          }
          for (let idx = 0; idx < this.usbDeviceNodes.length; idx++) {
            if (this.usbDeviceNodes[idx].path === port.path) {
              delete this.usbDeviceNodes[idx].pending
              return next()
            }
          }

          this.connectAndExecute(port, '\r\n',).then((result) => {
            console.log(port, result)
            // if data is >>> it is a repl capable device
            if (result.indexOf('>>>') > -1) {
              let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, 'repl')
              this.usbDeviceNodes.push(portItem )
            } else if (result.indexOf('uart:~$') > -1) {
              let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, 'uart')
              this.usbDeviceNodes.push(portItem )
            } else if (result) {
              let portItem = new UsbDevice(port.path, port.manufacturer, vscode.TreeItemCollapsibleState.Collapsed, false)
              this.usbDeviceNodes.push(portItem )
            } else {
              this.hiddenUsbDeviceNodes.push(port.path)
            }
            next()
          }).catch((error) => {
            next(error)
          })

        }, (error) => {
          if (error) {
            reject(error)
          }
          // remove items that are no longer in the list
          this.usbDeviceNodes = this.usbDeviceNodes.filter((item) => {
            return !item.pending
          })
          console.log('usbDeviceNodes', this.usbDeviceNodes)
          resolve(this.usbDeviceNodes)
        })
      })
    })

  }

  // list the child nodes (files) on the USB Device
  _getUsbDeviceFolder(element) {
    // every elemenbt has a deviceNode property
    // which references the parent device

    let dir = '/'
    if (element.contextValue === 'usbDeviceFolder') {
      dir = element.path
    }

    // if we have cached items, return them
    // connect to device by path and query device files
    //
    // if we have cached items, return them
    if (this.treeCache[path.join(element.path, dir)]) {
      return Promise.resolve(this.treeCache[path.join(element.path, dir)])
    }

    return new Promise((resolve, reject) => {
      if (element.parentDevice.replCapable) {
        let files = []
        return this.connect(element.parentDevice, {skipRefresh: true}).then(() => {
          return this.readDirFromDevice(dir)
        }).then((result) => {
          files = result
          return this.disconnect({skipRefresh: true})
        }).then(() => {
          const treeNodes = []
          files.forEach((file) => {
            const [path, type, size] = file
            // populate tree items from the read file information
            let treeNode
            if (type === 'dir') {
              treeNode = new UsbDeviceFolder(path)
              // command will be handled by the tree provider, getChildren
              treeNode.parentDevice = element.parentDevice
            } else if (type === 'file') {
              treeNode = new UsbDeviceFile(path, size)
              treeNode.command = {
                command: 'usbDevices.openDeviceFile',
                arguments: [treeNode]
              }
              treeNode.parentDevice = element.parentDevice
            } else {
              return
            }
            treeNodes.push(treeNode)
          })
          // cache the result
          this.treeCache[path.join(element.path, dir)] = treeNodes
          resolve(treeNodes)
        }).catch((error) => {
          console.log('error', error)
          reject(error)
        })
      } else {
        resolve([])
      }
    })
  }

  getChildren(element) {
    console.log('getChildren of', element)

    // element is the parent tree item
    // workspaceRoot is falsey if not currently in a workspace, otherwise it's the path
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return this._getUsbDeviceFolder(element)
    } else {
      return this._getUsbDevices()
    }
  }

  // Must be connected to device
  // Returns a promise
  writeWait(command, timeout = 1000, wait = 10) {
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
        reject('timeout: ', command)
      }, timeout)
    })
  }

  // Must be connected to device
  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  readDirFromDevice (dirPath) {
    console.log('readDirFromDevice', dirPath)
    return new Promise((resolve, reject) => {
      // make sure there is a trailing /
      if (!(/\/$/.test(dirPath))) {
        dirPath = `${dirPath}/`
      }
      const lsFunction = [
        'def ls(path:str):\r',
        '    for f in listdir(path):\r',
        '        full_name = path + f\r',
        '        s = stat(full_name)\r',
        '        print(full_name, s.type, s.size, ",")\r'
      ]
      const writeInterval = setInterval(() => {
        // 
        this.serialPort.write(lsFunction.shift())
        if (lsFunction.length === 0) {
          clearInterval(writeInterval)
          // press enter to complete the function and return to >>>
          this.writeWait('\r', 1000).then((result) => {
            // call the function with our current dir
            return this.writeWait(`ls('${dirPath}')\r`, 1000)
          }).then((result) => {
            // split the result into lines
            result = result.split(',')
            result = result.map(r => r.trim().split(' ')).filter(r => r.length > 1)

            // result = [
            //   ['/boot.py', 'file', '131'],
            //   ['/main.py', 'file', '7271'],
            //   ['/pikascript-api', 'dir', '0']
            // ]
            resolve(result)
          }).catch((error) => {
            console.log('error', error)
            reject(error)
          })

        }
      }, 100) 
    })
  }
}


module.exports = UsbDevicesProvider;
