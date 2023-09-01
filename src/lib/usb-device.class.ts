import * as path from 'path'
import * as vscode from 'vscode'

// const UsbDeviceFile = require('../lib/usb-device-file.class')
import { UsbDeviceFile } from './usb-device-file.class'
import { UsbDeviceInterface } from './usb-device-interface.class'
import { ProbeInfo } from '../providers/hardware-probe-info'
import { ReplTerminal } from './repl-terminal.class'

type File = [string, string, number]

export class UsbDevice extends vscode.TreeItem {
  uri: vscode.Uri
  options: ProbeInfo
  baudRate: number
  command: any
  type: string
  ifc: any
  connect: any
  disconnect: any
  write: any
  name = 'Unknown'
  serialNumber: string
  terminal: any
  lastSentHex: any

  // overrides
  public readonly iconPath: any
  public readonly description?: string

  constructor (
    uri: vscode.Uri,
    collapsibleState: any,
    options: ProbeInfo,
    type: string,
    command?: any
  ) {
    super(options.name, collapsibleState)
    this.uri = uri
    this.options = options
    // this.tooltip = this.label
    this.type = type
    this.command = command // default vs code command when clicking on item
    this.baudRate = 115200

    this.name = this.options.name
    // if has serialPort
    this.ifc = new UsbDeviceInterface({
      path: this.options.path,
      baudRate: this.baudRate
    })

    this.serialNumber = this.options.serialNumber

    // expose serial port methods
    this.connect = this.ifc.connect.bind(this.ifc)
    this.disconnect = this.ifc.disconnect.bind(this.ifc)
    this.write = this.ifc.write.bind(this.ifc)

    if (this.type === 'repl') {
      this.iconPath = {
        light: path.join(__filename, '../../..', 'resources', 'light', 'repl-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'repl-device.svg')
      }
    } else if (this.type === 'uart') {
      this.iconPath = {
        light: path.join(__filename, '../../..', 'resources', 'light', 'uart-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'uart-device.svg')
      }
    } else {
      this.iconPath = {
        light: path.join(__filename, '../../..', 'resources', 'light', 'usb-device.svg'),
        dark: path.join(__filename, '../../..', 'resources', 'dark', 'usb-device.svg')
      }
    }
    console.log(this)
  }

  get uriString (): string {
    return this.uri.toString()
  }

  get parentDevice (): UsbDevice {
    return this
  }

  get replCapable (): boolean {
    return this.type === 'repl'
  }

  get connected (): boolean {
    return this.ifc.connected
  }

  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  async readDirFromDevice (dirPath: string): Promise<any[]> {
    return await new Promise((resolve, reject) => {
      this.connect().then(() => {
        // make sure there is a trailing /
        if (!(/\/$/.test(dirPath))) {
          dirPath = `${dirPath}/`
        }
        const lsFunction = [
          'import os\r',
          'def ls(path:str):\r',
          '    for f in os.listdir(path):\r',
          '        full_name = path + f\r',
          '        s = os.stat(full_name)\r',
          '        print(full_name, s[0], s[5], ",")\r'
        ]

        /*
        s[0] octals
        S_IFDIR  = 0o040000  # directory
        S_IFCHR  = 0o020000  # character device
        S_IFBLK  = 0o060000  # block device
        S_IFREG  = 0o100000  # regular file
        S_IFIFO  = 0o010000  # fifo (named pipe)
        S_IFLNK  = 0o120000  # symbolic link
        S_IFSOCK = 0o140000  # socket file
        */

        const writeInterval = setInterval(() => {
          //
          this.ifc.write(lsFunction.shift())
          if (lsFunction.length === 0) {
            clearInterval(writeInterval)
            // press enter to complete the function and return to >>>
            this.ifc.writeWait('\r', 1000).then(() => {
              // call the function with our current dir
              return this.ifc.writeWait(`ls('${dirPath}')\r`, 1000)
            }).then((result: string) => {
              // split the result into lines
              const resultMap = result.split(',')
                .map(r => r.trim()
                  .split(' '))
                .filter(r => r.length > 1)
              // result = [
              //   ['/boot.py', 'file', '131'],
              //   ['/main.py', 'file', '7271'],
              //   ['/pikascript-api', 'dir', '0']
              // ]
              resolve(resultMap)
            }).catch((error: Error) => {
              console.log('error', error)
              reject(error)
            })
          }
        }, 100)
      })
    })
  }

  // list the child nodes (files) on the USB Device
  async getUsbDeviceFolder (dir = '/'): Promise<any[]> {
    if (!this.replCapable) {
      return await Promise.resolve([])
    }
    try {
      const files = await this.readDirFromDevice(dir)

      const treeNodes: UsbDeviceFile[] = []
      files.forEach((file: File) => {
        const [path, type, size] = file
        // populate tree items from the read file information
        let treeNode

        // memfs://tty.usbmodem1411/blink.py
        const uri = vscode.Uri.parse(this.uri.path + path)

        //
        // Omit folders from the tree for now
        // if (type === 'dir') {
        // treeNode = new UsbDeviceFolder(uri)
        // command will be handled by the tree provider, getChildren
        // treeNode.parentDevice = element.parentDevice
        // } else
        if (type === 'file') {
          treeNode = new UsbDeviceFile(uri, type, size, {
            command: 'usbDevices.openDeviceFile',
            arguments: [treeNode]
          })
          treeNode.parentDevice = this
        } else {
          return
        }
        treeNodes.push(treeNode)
      })
      return await Promise.resolve(treeNodes)
    } catch (error) {
      return await Promise.reject(error)
    }
  }

  async createFile (filePath: string): Promise<void> {
    try {
      await this.ifc.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
      await this.ifc.writeWait('f.close()\r', 1000)
      return await Promise.resolve()
    } catch (error) {
      return await Promise.reject(error)
    }
  }

  async deleteFile (filePath: string): Promise<void> {
    return this.ifc.writeWait(`unlink('${filePath}')\r`, 1000)
  }

  async renameFile (oldFilePath: string, newFilePath: string): Promise<void> {
    return this.ifc.writeWait(`rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
  }

  async createTerminal (context: vscode.ExtensionContext): Promise<void> {
    this.terminal = new ReplTerminal(context, {
      name: this.options.path
    })
    this.terminal.onInput((data: string) => {
      // send line to the serial port
      if (this.connected) {
        this.lastSentHex = Buffer.from(data).toString('hex')
        this.write(data)
      }
    })
    this.ifc.on('data', (data: Buffer) => {
      if (this.terminal !== null) {
        const hex = data.toString('hex')
        if (/^7f20/.test(hex)) {
          // Move cursor backward
          this.terminal.write('\x1b[D')
          // Delete character
          this.terminal.write('\x1b[P')
        }

        if (this.terminal !== null) {
          this.terminal.write(data.toString())
        }
      }
    })
  }
}
