const vscode = require('vscode')
const { SerialPort } = require('serialport')
const async = require('async')

const UsbDevice = require('../lib/usb-device.class')

class UsbDevicesProvider {
  constructor (context, ifc) {
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    // this.connected = false
    this.usbDeviceNodes = []
    this.hiddenUsbDeviceNodes = [] // connected USB devices that don't response to serial query are put here
    // this.serialPort = null
    this.parser = null
    this.lastSentHex = null
    // this.resultBuffer = ''
    this.treeCache = {} // cache the file tree for each device and sub folder. Key is the device.path/folder/...

    this.pyocdInterface = ifc
  }

  get onDidChangeTreeData () {
    return this._onDidChangeTreeData.event
  }

  refresh () {
    // appears to be a race condition with the treeview
    // where the first time clicked, the emitted event is empty
    setTimeout(() => {
      this._onDidChangeTreeData.fire()
    }, 100)
  }

  disconnectAll () {
    this.usbDeviceNodes.forEach((usbDevice) => {
      usbDevice.disconnect().catch((error) => {
        console.log('error disconnecting', error)
      })
    })
  }

  // Connect to a port, execute a command, disconnect and return the result
  // This is used for commands that don't require a persistant connection to the device
  // params:
  // port is the UsbDeviceClass Instance
  // ----------------------------
  connectAndExecute (port, command) {
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

  getTreeItem (element) {
    return element
  }

  // list the connected parent nodes (USB Devices)
  // returns a promise
  // ----------------------------
  _getUsbDevices () {
    return new Promise((resolve, reject) => {
      // Pyocd.exec(['--list']).then((result) => {
      let ports
      const devices = []
      const devicesDict = {}
      SerialPort.list().then((result) => {
        ports = result
        return this.pyocdInterface.listDevices()
      }).then((result) => {
        result.forEach((p) => {
          devices.push(...p._ports)
          devicesDict[p._id] = {
            _id: p._id,
            _probed: true, // if the device was probed by pyocd
            _ports: p._ports
          }
        })

        // for each device
        ports.forEach((device) => {
          // check if the port is already known
          if (!devicesDict[device.serialNumber] && device.serialNumber) {
            devicesDict[device.serialNumber] = {
              _id: device.serialNumber,
              _probed: false,
              _ports: [device]
            }
            devices.push(device)
          }
        })

        console.log('devices', devices)

        // for each port, check if it's already known.
        // if not, connect and detect if repl capable
        async.eachSeries(devices, (port, next) => {
          // create a uri from the path
          port.path = port.path || port.device
          port.serialNumber = port.serialNumber || port.serial_number || port._id
          // memfs:/serial/dev/tty.usbmodem1411
          // memfs:/serial/COM3
          const uri = vscode.Uri.parse(`memfs:/serial/${port.serialNumber}${port.path}`)

          if (this.hiddenUsbDeviceNodes.indexOf(uri.toString()) > -1) {
            return next()
          }

          // check if the port is already known
          for (let idx = 0; idx < this.usbDeviceNodes.length; idx++) {
            if (this.usbDeviceNodes[idx].uriString === uri.toString()) {
              return next()
            }
          }

          // if no target_board_name, fallback to serial port query
          // if not, connect and detect if repl capable
          this.connectAndExecute(port, '\r\n').then((result) => {
            // if data is >>> it is a repl capable device
            if (result.indexOf('>>>') > -1) {
              const portItem = new UsbDevice(uri, port, vscode.TreeItemCollapsibleState.Collapsed, 'repl')
              this.usbDeviceNodes.push(portItem)
            } else if (result.indexOf('uart:~$') > -1) {
              const portItem = new UsbDevice(uri, port, vscode.TreeItemCollapsibleState.Collapsed, 'uart')
              this.usbDeviceNodes.push(portItem)
            } else if (result) {
              const portItem = new UsbDevice(uri, port, vscode.TreeItemCollapsibleState.Collapsed, false)
              this.usbDeviceNodes.push(portItem)
            } else {
              // if no data, it's probably not a serial device we can use
              // hide it so it doesn't get queried everytime
              this.hiddenUsbDeviceNodes.push(uri.toString())
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
          resolve(this.usbDeviceNodes)
        })
      })
    })
  }

  getChildren (usbDevice) {
    if (usbDevice) {
      return new Promise((resolve, reject) => {
        if (this.treeCache[usbDevice.uri.toString()]) {
          return resolve(this.treeCache[usbDevice.uri.toString()])
        }
        return usbDevice.getUsbDeviceFolder().then((result) => {
          this.treeCache[usbDevice.uri.toString()] = result
          resolve(result)
        }).catch((error) => {
          reject(error)
        }).finally(() => {
          this.refresh()
        })
      })
    } else {
      // pyocd query
      return this._getUsbDevices()
    }
  }

  createFile (usbDevice, filePath) {
    return usbDevice.createFile(filePath)
      .then(() => {
        vscode.window.showInformationMessage(`Created New File: ${filePath}`)
      }).catch((error) => {
        vscode.window.showInformationMessage(`Error Creating File: ${error.message}`)
      }).finally(() => {
        // remove from MemFS cache
        delete this.treeCache[usbDevice.uri.toString()]

        this.refresh()
      })
  }

  deleteFile (usbDeviceFile) {
    // const dirPath = path.dirname(filePath)
    return usbDeviceFile.parentDevice.deleteFile(usbDeviceFile.devPath)
      .then(() => {
        vscode.window.showInformationMessage(`Deleted File: ${usbDeviceFile.uri.toString()}`)
      }).catch((error) => {
        vscode.window.showInformationMessage(`Error Deleting File: ${error.message}`)
      }).finally(() => {
        // remove from MemFS cache
        delete this.treeCache[usbDeviceFile.parentDevice.uri.toString()]
        console.log('refreshing')
        this.refresh()
      })
  }

  renameFile (usbDeviceFile, newFilePath) {
    const oldFilePath = usbDeviceFile.devPath.split('/').pop()
    newFilePath = newFilePath.split('/').pop()

    return usbDeviceFile.parentDevice.renameFile(oldFilePath, newFilePath)
      .then(() => {
        vscode.window.showInformationMessage(`Renamed File: ${newFilePath}`)
      }).catch((error) => {
        vscode.window.showInformationMessage(`Error Renaming File: ${error.message}`)
      }).finally(() => {
        // remove from MemFS cache
        delete this.treeCache[usbDeviceFile.parentDevice.uri.toString()]
        delete this.treeCache[usbDeviceFile.parentDevice.uri.toString()]
        this.refresh()
      })
  }
}

module.exports = UsbDevicesProvider
