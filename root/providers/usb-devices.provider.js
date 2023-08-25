const vscode = require('vscode')
const { SerialPort } = require('serialport')
const async = require('async')

const UsbDevice = require('../lib/usb-device.class')
const { getDevices } = require('../lib/pyocd')

class UsbDevicesProvider {
  constructor (workspaceRoot, context) {
    this.workspaceRoot = workspaceRoot
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
  }

  get onDidChangeTreeData () {
    return this._onDidChangeTreeData.event
  }

  refresh () {
    this._onDidChangeTreeData.fire()
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
    if (this.connected === port.path) {
      this.disconnect(port, { skipRefresh: true })
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

  getTreeItem (element) {
    return element
  }

  // list the connected parent nodes (USB Devices)
  // returns a promise
  // ----------------------------
  _getUsbDevices () {
    return new Promise((resolve, reject) => {
      // Pyocd.exec(['--list']).then((result) => {

      SerialPort.list().then((ports) => {
        // mark devices as pending. If they are not in the list after the scan, remove them
        this.usbDeviceNodes.forEach((item) => {
          item.pending = true
        })

        // for each port, check if it's already known.
        // if not, connect and detect if repl capable
        async.eachSeries(ports, (port, next) => {
          // create a uri from the path

          // memfs:/serial/dev/tty.usbmodem1411
          // memfs:/serial/COM3
          const uri = vscode.Uri.parse(`memfs:/serial${port.path}`)

          if (this.hiddenUsbDeviceNodes.indexOf(uri.toString()) > -1) {
            return next()
          }

          // check if the port is already known
          for (let idx = 0; idx < this.usbDeviceNodes.length; idx++) {
            if (this.usbDeviceNodes[idx].uriString === uri.toString()) {
              delete this.usbDeviceNodes[idx].pending
              return next()
            }
          }

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
          console.log('usbDeviceNodes', this.usbDeviceNodes)
          resolve(this.usbDeviceNodes)
        })
      })
    })
  }

  getChildren (usbDevice) {
    if (usbDevice) {
      if (this.treeCache[usbDevice.uri.toString()]) {
        return Promise.resolve(this.treeCache[usbDevice.uri.toString()])
      }
      return usbDevice.getUsbDeviceFolder().then((result) => {
        this.treeCache[usbDevice.uri.toString()] = result
        this.refresh()
        return result
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
