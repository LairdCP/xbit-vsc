const path = require('path')
const vscode = require('vscode')

const UsbDeviceFile = require('./usb-device-file.class')
const UsbDeviceInterface = require('./usb-device-interface.class')

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
    this.baudRate = 115200
    this.tooltip = `${this.label}`
    this.command = command // default vs code command when clicking on item
    this.type = type
    this.port = port
    this.probe = null

    // if has serialPort
    this.ifc = new UsbDeviceInterface({
      port,
      baudRate: this.baudRate
    })
    // expose serial port methods
    this.connect = this.ifc.connect.bind(this.ifc)
    this.disconnect = this.ifc.disconnect.bind(this.ifc)
    this.write = this.ifc.write.bind(this.ifc)
  }

  get contextValue () {
    return this.ifc && this.ifc.connected ? 'usbDeviceConnected' : 'usbDevice'
  }

  get uriString () {
    return this.uri.toString()
  }

  get path () {
    return this.port.path
  }

  get name () {
    return this.port.path.split('/').pop()
  }

  get parentDevice () {
    return this
  }

  get description () {
    if (this.ifc) {
      return this.ifc.port.manufacturer || ''
    } else {
      return ''
    }
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
    return this.ifc.connected
  }

  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  readDirFromDevice (dirPath) {
    console.log('readDirFromDevice', dirPath)
    return new Promise((resolve, reject) => {
      this.connect().then(() => {
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
          this.ifc.write(lsFunction.shift())
          if (lsFunction.length === 0) {
            clearInterval(writeInterval)
            // press enter to complete the function and return to >>>
            this.ifc.writeWait('\r', 1000).then(() => {
              // call the function with our current dir
              return this.ifc.writeWait(`ls('${dirPath}')\r`, 1000)
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
    })
  }

  // list the child nodes (files) on the USB Device
  getUsbDeviceFolder (dir = '/') {
    return new Promise((resolve, reject) => {
      if (this.replCapable) {
        let files = []
        return this.readDirFromDevice(dir)
          .then((result) => {
            files = result

            const treeNodes = []
            files.forEach((file) => {
              const [path, type, size] = file
              // populate tree items from the read file information
              let treeNode

              // memfs://tty.usbmodem1411/blink.py
              const uri = vscode.Uri.parse(`${this.uri._formatted}${path}`)

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
                treeNode.parentDevice = this
              } else {
                return
              }
              treeNodes.push(treeNode)
            })
            // cache the result
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

  createFile (filePath) {
    return this.ifc.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
      .then(() => {
        return this.ifc.writeWait('f.close()\r', 1000)
      })
  }

  deleteFile (filePath) {
    return this.ifc.writeWait(`unlink('${filePath}')\r`, 1000)
  }

  renameFile (oldFilePath, newFilePath) {
    return this.ifc.writeWait(`rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
  }
}

module.exports = UsbDevice
