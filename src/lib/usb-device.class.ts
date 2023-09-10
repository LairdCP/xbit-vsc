import * as path from 'path'
import * as vscode from 'vscode'

// const UsbDeviceFile = require('../lib/usb-device-file.class')
import { UsbDeviceFile } from './usb-device-file.class'
import { UsbDeviceInterface } from './usb-device-interface.class'
import { ProbeInfo } from '../providers/hardware-probe-info'
import { ReplTerminal } from './repl-terminal.class'

const config = vscode.workspace.getConfiguration('xbit-vsc')

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
  terminal: any = null
  lastSentHex: any
  targetType?: string

  // overrides
  public iconPath: any
  public description?: string

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
    this.serialNumber = this.options.serialNumber
    this.baudRate = 115200
    this.name = this.options.name

    if (this.options.board_name !== 'Unknown') {
      this.name = this.options.board_name
    }
    this.description = this.options.path

    // if has serialPort
    this.ifc = new UsbDeviceInterface({
      path: this.options.path,
      baudRate: this.baudRate
    })

    // expose serial port methods
    this.connect = this.ifc.connect.bind(this.ifc)
    this.disconnect = this.ifc.disconnect.bind(this.ifc)
    this.write = this.ifc.write.bind(this.ifc)

    // TODO this is hacky, but it works
    // Set any custom configuration for this device
    const deviceConfigurations: any = config.get('device-configurations')
    const key = `${this.serialNumber}.${String(this.label)}`
    if (deviceConfigurations !== undefined) {
      if (deviceConfigurations[key] !== undefined) {
        if (deviceConfigurations[key]?.baudRate !== undefined) {
          this.baudRate = deviceConfigurations[key].baudRate
        }
        this.name = deviceConfigurations[key]?.name === '' ? this.name : deviceConfigurations[key]?.name
      }
    }
    this.setIconPath()
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
    // if no terminal, it's a temporary connection
    return this.ifc.connected === true && this.terminal !== null
  }

  get dvkProbe (): boolean {
    return this.options.board_name !== 'Unknown'
  }

  setIconPath (): void {
    let type = 'usb'
    let connected = ''

    if (this.connected) {
      connected = '-connected'
    }

    if (this.type === 'repl') {
      type = 'repl'
    }

    if (this.type === 'uart') {
      type = 'uart'
    }

    this.iconPath = {
      light: path.join(__filename, '../../..', 'resources', 'light', `${type}-device${connected}.svg`),
      dark: path.join(__filename, '../../..', 'resources', 'dark', `${type}-device${connected}.svg`)
    }
  }

  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  async readDirFromDevice (dirPath: string): Promise<any[]> {
    const timeout = async (ms: number): Promise<void> => {
      return await new Promise(resolve => setTimeout(resolve, ms))
    }
    let tempConnection = false
    if (!this.replCapable) {
      return await Promise.resolve([])
    }
    if (!this.connected) {
      tempConnection = true
      await this.connect()
    }
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

    for (const i of lsFunction) {
      const drain = await this.ifc.write(i)
      if (drain === false) {
        console.log('wait for drain', drain)
      }
      await timeout(100)
    }

    await this.ifc.writeWait('\r', 1000)
    const result = await this.ifc.writeWait(`ls('${dirPath}')\r`, 1000)
    const resultMap = result.split(',')
      .map((r: string) => r.trim()
        .split(' ')
      )
      .filter((r: string) => {
        return r.length > 1
      })

    const fileResult = []
    for (let i = 0; i < resultMap.length; i++) {
      const element: Array<string | number> = resultMap[i]
      if (element[1] === '32768') {
        element[1] = 'file'
      } else if (element[1] === '16384') {
        element[1] = 'dir'
      }
      if (typeof element[2] === 'string') {
        element[2] = parseInt(element[2], 10)
      }
      fileResult.push(element)
    }
    if (tempConnection) {
      await this.disconnect()
    }
    return await Promise.resolve(fileResult)
  }

  // list the child nodes (files) on the USB Device
  async getUsbDeviceFolder (dir = '/'): Promise<any[]> {
    if (!this.replCapable) {
      return await Promise.resolve([])
    }
    try {
      const files: File[] = await this.readDirFromDevice(dir)

      const treeNodes: UsbDeviceFile[] = []
      files.forEach((file: File) => {
        const [path, type, size] = file
        // populate tree items from the read file information
        let treeNode

        // memfs:/serial/id/tty.usbmodem1411/blink.py
        const uri = vscode.Uri.parse('memfs:' + this.uri.path + path)
        //
        // Omit folders from the tree for now
        // if (type === 'dir') {
        // treeNode = new UsbDeviceFolder(uri)
        // command will be handled by the tree provider, getChildren
        // treeNode.parentDevice = element.parentDevice
        // } else
        if (type === 'file') {
          treeNode = new UsbDeviceFile(uri, type, size, this)
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

  async createFile (filePath: string): Promise<string> {
    console.log('createFile2', filePath)
    try {
      await this.ifc.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
      await this.ifc.writeWait('f.close()\r', 1000)
      return await Promise.resolve('ok')
    } catch (error) {
      return await Promise.reject(error)
    }
  }

  async deleteFile (filePath: string): Promise<void> {
    // write import os
    return this.ifc.writeWait(`import os\ros.unlink('${filePath}')\r`, 1000)
  }

  async renameFile (oldFilePath: string, newFilePath: string): Promise<void> {
    // write import os
    return this.ifc.writeWait(`import os\ros.rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
  }

  private _handleTerminalData (data: Buffer): void {
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
    // when disconnected, the listener is not removed
    this.ifc.on('data', this._handleTerminalData.bind(this))
  }

  async destroyTerminal (): Promise<void> {
    if (this.terminal !== null) {
      this.terminal.remove()
      this.terminal = null
    }
    this.ifc.removeAllListeners('data')
  }
}
