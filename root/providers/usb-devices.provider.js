const vscode = require('vscode')
const path = require('path')
const { SerialPort } = require('serialport')
const async = require('async')
const ReplTerminal = require('../lib/repl-terminal.class')

const {
  UsbDevice,
  // UsbDeviceFolder
  UsbDeviceFile
} = require('../lib/usb-devices-tree.class')

class UsbDevicesProvider {
  constructor (workspaceRoot, context) {
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

  refresh () {
    this._onDidChangeTreeData.fire()
  }

  connect (element, opts = {}) {
    return new Promise((resolve, reject) => {
      if (element.path === this.connected) {
        return resolve()
      } else if (this.connected) {
        this.disconnect(element)
      }

      this.connected = element.path
      this.serialPort = new SerialPort({
        path: element.path,
        baudRate: element.baudRate || 115200
      }, (error) => {
        if (error) {
          // notify user of error
          vscode.window.showInformationMessage(`Error opening port: ${error.message}`)
          reject(error)
        } else {
          element.contextValue = 'usbDeviceConnected'
          vscode.window.showInformationMessage(`Port Connected: ${this.connected}`)
          if (!opts.skipRefresh) {
            this.refresh()
          }

          // open terminal
          this.terminal = new ReplTerminal(this.context)
          this.terminal.onInput((data) => {
            // send line to the serial port
            this.lastSentHex = Buffer.from(data).toString('hex')
            this.serialPort.write(data)
          })
          resolve()
        }
      })

      this.serialPort.on('data', (data) => {
        const hex = data.toString('hex')
        if (/^7f20/.test(hex)) {
          // Move cursor backward
          this.terminal.write('\x1b[D')
          // Delete character
          this.terminal.write('\x1b[P')
        } else {
          this.resultBuffer += data.toString()
        }

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
      }
      this.serialPort = null
      if (this.terminal) {
        this.terminal.remove()
      }
      if (!opts.skipRefresh) {
        this.refresh()
      }
      element.contextValue = 'usbDevice'
      vscode.window.showInformationMessage('Port Disconnected')
      return Promise.resolve()
    } catch (error) {
      console.log('error closing port', error)
      vscode.window.showInformationMessage(`Error closing port: ${error.message}`)
      return Promise.reject(error)
    }
  }

  disconnectAll () {
    this.usbDeviceNodes.forEach((item) => {
      this.disconnect(item, { skipRefresh: true })
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

  // list the child nodes (files) on the USB Device
  _getUsbDeviceFolder (element) {
    // every element has a deviceNode property
    // which references the parent device

    const dir = '/'
    // if (element.contextValue === 'usbDeviceFolder') {
    //   dir = element.path
    // }

    // if we have cached items, return them
    // connect to device by path and query device files
    //
    // if we have cached items, return them
    if (this.treeCache[element.uri.toString()]) {
      return Promise.resolve(this.treeCache[element.uri.toString()])
    }

    return new Promise((resolve, reject) => {
      if (element.parentDevice.replCapable) {
        let files = []
        return this.connect(element.parentDevice, { skipRefresh: true }).then(() => {
          return this.readDirFromDevice(dir)
        }).then((result) => {
          files = result
          return this.disconnect({ skipRefresh: true })
        }).then(() => {
          const treeNodes = []
          files.forEach((file) => {
            const [path, type, size] = file
            // populate tree items from the read file information
            let treeNode

            // memfs://tty.usbmodem1411/blink.py
            const uri = vscode.Uri.parse(`${element.parentDevice.uri._formatted}${path}`)

            //
            // Omit folders from the tree for now
            // if (type === 'dir') {
            // treeNode = new UsbDeviceFolder(uri)
            // command will be handled by the tree provider, getChildren
            // treeNode.parentDevice = element.parentDevice
            // } else
            if (type === 'file') {
              treeNode = new UsbDeviceFile(uri, type, size)
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
          this.treeCache[element.uri.toString()] = treeNodes
          console.log('>>>', this.treeCache, element.path)

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

  getChildren (element) {
    if (element) {
      return this._getUsbDeviceFolder(element)
    } else {
      return this._getUsbDevices()
    }
  }

  // Must be connected to device
  // Returns a promise
  writeWait (command, timeout = 1000, wait = 10) {
    return new Promise((resolve, reject) => {
      this.resultBuffer = ''
      this.serialPort.write(command)
      const waiting = setInterval(() => {
        // check for Error first as there will also be a >>> at the end
        if (this.resultBuffer.indexOf('Error') > -1) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          reject(this.resultBuffer)
          this.resultBuffer = ''
        } else if (this.resultBuffer.indexOf('>>>') > -1) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          resolve(this.resultBuffer)
          this.resultBuffer = ''
        }
      }, wait)

      const timeouting = setTimeout(() => {
        clearInterval(waiting)
        reject(new Error('timeout: ' + command))
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
          this.writeWait('\r', 1000).then(() => {
            // call the function with our current dir
            return this.writeWait(`ls('${dirPath}')\r`, 1000)
          }).then((result) => {
            // split the result into lines
            result = result.split(',')
            result = result.map(r => r.trim().split(' ')).filter(r => r.length > 1)
            console.log('result', result)
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

  createFile (usbDevice, filePath) {
    // connect
    const dirPath = path.dirname(filePath)
    return this.connect(usbDevice, { skipRefresh: true }).then(() => {
      return this.writeWait(`f = open('${filePath}', 'wb')\r`, 1000)
    }).then(() => {
      return this.writeWait('f.close()\r', 1000)
    }).then(() => {
      vscode.window.showInformationMessage(`Created New File: ${filePath}`)
    }).catch((error) => {
      vscode.window.showInformationMessage(`Error Creating File: ${error.message}`)
    }).finally(() => {
      // remove from MemFS cache
      delete this.treeCache[path.join(usbDevice.path, dirPath)]
      this.disconnect(usbDevice)
    })
  }

  deleteFile (usbDeviceFile) {
    // const dirPath = path.dirname(filePath)
    return this.connect(usbDeviceFile.parentDevice, { skipRefresh: true }).then(() => {
      return this.writeWait(`unlink('${usbDeviceFile.devPath}')\r`, 1000)
    }).then(() => {
      vscode.window.showInformationMessage(`Deleted File: ${usbDeviceFile.uri.toString()}`)
    }).catch((error) => {
      vscode.window.showInformationMessage(`Error Deleting File: ${error.message}`)
    }).finally(() => {
      // remove from MemFS cache
      delete this.treeCache[usbDeviceFile.uri.toString()]
      this.disconnect(usbDeviceFile.parentDevice)
    })
  }

  renameFile (usbDevice, oldFilePath, newFilePath) {
    let newDirPath = path.dirname(newFilePath)
    let oldDirPath = path.dirname(oldFilePath)
    // temporary solution until rename works with paths
    newDirPath = '/'
    oldDirPath = '/'
    return this.connect(usbDevice, { skipRefresh: true }).then(() => {
      return this.writeWait(`rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
    }).then(() => {
      vscode.window.showInformationMessage(`Renamed File: ${newFilePath}`)
    }).catch((error) => {
      vscode.window.showInformationMessage(`Error Renaming File: ${error.message}`)
    }).finally(() => {
      // remove from MemFS cache
      delete this.treeCache[path.join(usbDevice.path, newDirPath)]
      delete this.treeCache[path.join(usbDevice.path, oldDirPath)]
      this.disconnect(usbDevice)
    })
  }
}

module.exports = UsbDevicesProvider
