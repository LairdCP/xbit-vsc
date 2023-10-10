import * as vscode from 'vscode'

// const UsbDeviceFile = require('../lib/usb-device-file.class')
import { UsbDeviceFile } from './usb-device-file.class'
import { UsbDeviceInterface } from './usb-device-interface.class'
import { ProbeInfo } from './hardware-probe-info.class'
import { ReplTerminal } from './repl-terminal.class'
import { InFlightCommand, DeviceCommand, DeviceCommandResponse, TreeItemIconPath, DeviceConfigurations, pythonLsStatElement } from './util.ifc'
import ExtensionContextStore from '../stores/extension-context.store'

// read in the device map
import { DeviceMap } from './device-map'
const deviceMap = new DeviceMap()

let inFlightCommands: InFlightCommand[] = []

export class UsbDevice extends vscode.TreeItem {
  context: vscode.ExtensionContext
  uri: vscode.Uri
  options: ProbeInfo
  baudRate: number
  command: vscode.Command | undefined
  type: string
  ifc: UsbDeviceInterface
  name = 'Unknown'
  serialNumber: string
  terminal: ReplTerminal | null = null
  lastSentHex?: string
  targetType?: string
  enableApplet = false
  receivedLine = ''

  // overrides
  private readonly _dataHandlers: Map<string, (msg: DeviceCommandResponse) => void> = new Map()
  iconPath?: TreeItemIconPath | undefined

  constructor (
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options: ProbeInfo,
    type: string,
    command?: vscode.Command
  ) {
    super(options.name, collapsibleState)
    this.context = context
    this.uri = uri
    this.options = options
    // this.tooltip = this.label
    this.type = type
    this.command = command // default vs code command when clicking on item
    this.serialNumber = this.options.serialNumber
    this.baudRate = 115200
    this.name = this.options.name
    this.receivedLine = ''

    if (this.options.board_name !== 'Unknown') {
      this.name = this.options.board_name
    }
    this.description = this.options.path.replace(/^\//, '')

    // TODO this is hacky, but it works
    // Set any custom configuration for this device
    const config = vscode.workspace.getConfiguration('xbit-vsc')
    const deviceConfigurations: DeviceConfigurations | undefined = config.get('device-configurations')
    const key = `${this.serialNumber}.${String(this.label)}`

    if (deviceConfigurations !== undefined) {
      if (deviceConfigurations[key] !== undefined) {
        if (deviceConfigurations[key]?.baudRate !== undefined) {
          this.baudRate = deviceConfigurations[key].baudRate
        }
        this.name = deviceConfigurations[key]?.name === '' ? this.name : deviceConfigurations[key]?.name
      }
    }

    const map = deviceMap.find(this.options)
    let eofType = 'none'
    let supportsBreak = false
    if (map !== undefined) {
      eofType = map['eof-type']
      supportsBreak = map['supports-break']
    }

    // if has serialPort
    this.ifc = new UsbDeviceInterface({
      path: this.options.path,
      baudRate: this.baudRate,
      eofType,
      supportsBreak
    })

    // when disconnected, the listener is not removed
    // 5. from device, data = '>>>'

    // TODO consume serialData event
    this.ifc.on('data', (data: Buffer) => {
      if (this.terminal !== null) {
        this._handleTerminalData(data)
      }

      // if panel webview attached,
      // post the data there
      // for each webview panel...
      this.receivedLine = this.receivedLine + data.toString()
      if (/\r\n$/.test(this.receivedLine)) {
        this._dataHandlers.forEach((cb: (msg: DeviceCommandResponse) => void, key: string) => {
          // for each in-flight command...
          inFlightCommands = inFlightCommands.filter((command: InFlightCommand) => {
            // if the command key matches the panel key...
            if (command.panelKey === key && this.receivedLine.includes(command.expectedResponse)) {
              const response = {
                id: command.message.id,
                result: this.receivedLine
              }
              // call the callback with the response
              cb(response)
              return false
            } else {
              return true
            }
          })
          // this isn't a command response
          // but send it to the webview anyway
          const response = { result: this.receivedLine }
          cb(response)
        })
        this.receivedLine = ''
      }
    })

    this.ifc.on('close', (error) => {
      if (error !== null && error.disconnected === true) {
        ExtensionContextStore.inform('Serial Port Closed By Device')
        try {
          void vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', this)
        } catch (error) {
          // error should already be handled by the command
        }
      }
    })

    vscode.window.onDidCloseTerminal(async (t) => {
      if (t.name === this.terminal?.name) {
        ExtensionContextStore.inform('Terminal Closed By User, Disconnecting')
        try {
          await vscode.commands.executeCommand('xbitVsc.disconnectUsbDevice', this)
        } catch (error) {
          // error should already be handled by the command
        }
      }
    })

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
    return this.ifc.connected && this.terminal !== null
  }

  get dvkProbe (): boolean {
    return this.options.board_name !== 'Unknown'
  }

  get path (): string {
    return this.options.path
  }

  async connect (): Promise<void> {
    return await this.ifc.connect()
  }

  async disconnect (): Promise<void> {
    return await this.ifc.disconnect()
  }

  async write (data: string): Promise<void> {
    return this.ifc.write(data)
  }

  setIconPath (): void {
    let type = 'usb'
    let connected = ''

    if (this.connected) {
      connected = '-connected'
    }

    if (this.type === 'repl' || this.type === 'uart') {
      type = this.type
    }

    this.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, `resources/light/${type}-device${connected}.svg`),
      dark: vscode.Uri.joinPath(this.context.extensionUri, `resources/dark/${type}-device${connected}.svg`)
    }
  }

  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  async readDirFromDevice (dirPath: string): Promise<pythonLsStatElement[]> {
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
      await this.ifc.sendBreak()
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
      await this.ifc.write(i)
      await timeout(100)
    }

    await this.ifc.writeWait('\r', 1000)
    const result = await this.ifc.writeWait(`ls('${dirPath}')\r`, 1000)
    const resultMap = result.split(',')
      .map((r: string) => r.trim()
        .split(' ')
      )
      .filter((r: string[]) => {
        return r.length > 1
      })

    const fileResult: pythonLsStatElement[] = resultMap.map((r: string[]) => {
      const element: pythonLsStatElement = {
        type: '',
        size: parseInt(r[2], 10),
        path: r[0]
      }

      if (r[1] === '32768') {
        element.type = 'file'
      } else if (r[1] === '16384') {
        element.type = 'dir'
      } else {
        element.type = r[1]
      }

      return element
    })

    if (tempConnection) {
      await this.disconnect()
    }
    return await Promise.resolve(fileResult)
  }

  // list the child nodes (files) on the USB Device
  async getUsbDeviceFolder (dir = '/'): Promise<UsbDeviceFile[]> {
    if (!this.replCapable) {
      return await Promise.resolve([])
    }
    try {
      const files: pythonLsStatElement[] = await this.readDirFromDevice(dir)
      const treeNodes: UsbDeviceFile[] = []
      files.forEach((file: pythonLsStatElement) => {
        const { path, type, size } = file
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
          treeNode = new UsbDeviceFile(this.context, uri, type, size, this)
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

  // TODO change to writeFile command
  async createFile (filePath: string): Promise<string> {
    try {
      await this.ifc.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
      await this.ifc.writeWait('f.close()\r', 1000)
      return await Promise.resolve('ok')
    } catch (error) {
      return await Promise.reject(error)
    }
  }

  // TODO change to deleteFile command
  async deleteFile (filePath: string): Promise<void> {
    // write import os
    await this.ifc.writeWait(`import os\ros.unlink('${filePath}')\r`, 1000)
  }

  async renameFile (oldFilePath: string, newFilePath: string): Promise<void> {
    // write import os
    await this.ifc.writeWait(`import os\ros.rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
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

  // these are used to receive data from applets
  dataHandler (key: string, cb: (msg: DeviceCommand | DeviceCommandResponse) => void): void {
    this._dataHandlers.set(key, cb)
  }

  // these are used to receive data from applets
  removeDataHandler (key: string): void {
    this._dataHandlers.delete(key)
  }

  // when a command is sent from the webview panel, it is handled here
  // and sent to the device. Such as 'connect'
  commandHandler (panelKey: string, message: DeviceCommand): void {
    let payload = ''
    let expectedResponse = ''
    if (message.method === 'write' && message.params.command !== undefined) {
      payload = message.params.command
      expectedResponse = '>>>'
    } else {
      return
    }

    // if we expect a response, register the command
    if (expectedResponse !== '') {
      // generate a unique id
      let id = message.id
      if (id === undefined) {
        id = Math.floor(Math.random() * 1000000)
      }

      const cmd: InFlightCommand = {
        id,
        expectedResponse,
        message,
        panelKey,
        payload,
        timestamp: Date.now()
      }
      inFlightCommands.push(cmd)
    }
    // write to the serial port
    this.ifc.write(payload)
  }

  async createTerminal (context: vscode.ExtensionContext): Promise<void> {
    this.terminal = new ReplTerminal(context, {
      name: `${this.name} - ${this.serialNumber}`,
      iconPath: this.iconPath
    })

    this.terminal.onInput((data: string) => {
      // send line to the serial port
      if (this.connected) {
        this.lastSentHex = Buffer.from(data).toString('hex')
        this.ifc.write(data)
      }
    })
  }

  async showTerminal (): Promise<void> {
    if (this.terminal !== null) {
      this.terminal.show()
    }
  }

  async destroyTerminal (): Promise<void> {
    if (this.terminal !== null) {
      this.terminal.dispose()
      this.terminal = null
    }
  }
}
