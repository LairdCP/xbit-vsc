import * as vscode from 'vscode'
import * as async from 'async'

import { UsbDevice } from '../lib/usb-device.class'
import { ProbeInfo, DvkProbeInterface, DvkProbeInterfaces } from '../lib/hardware-probe-info.class'
import { PortInfo } from '@serialport/bindings-interface'

import { SerialPort } from 'serialport'
// import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import { PyocdInterface } from '../lib/pyocd'

export class UsbDevicesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  context: vscode.ExtensionContext
  _onDidChangeTreeData: vscode.EventEmitter<vscode.Event<any> | null>
  usbDeviceNodes: UsbDevice[]
  hiddenUsbDeviceNodes: string[]
  lastSentHex: string | null
  treeCache: Map<string, UsbDeviceFile[]>
  pyocdInterface: PyocdInterface

  constructor (context: vscode.ExtensionContext, ifc: PyocdInterface) {
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.usbDeviceNodes = []
    this.hiddenUsbDeviceNodes = [] // connected USB devices that don't response to serial query are put here
    this.lastSentHex = null
    this.treeCache = new Map() // cache the file tree for each device and sub folder. Key is the device.path/folder/...
    this.pyocdInterface = ifc
  }

  get onDidChangeTreeData (): vscode.Event<any> {
    return this._onDidChangeTreeData.event
  }

  refresh (): void {
    // appears to be a race condition with the treeview
    // where the first time clicked, the emitted event is empty
    setTimeout(() => {
      this._onDidChangeTreeData.fire(null)
    }, 500)
  }

  async disconnectAll (): Promise<void> {
    for (const usbDevice of this.usbDeviceNodes) {
      try {
        await usbDevice.disconnect()
      } catch (error: unknown) {
        console.error('error disconnecting', error)
      }
    }
  }

  // Connect to a port, execute a command, disconnect and return the result
  // This is used for commands that don't require a persistant connection to the device
  // params:
  // port is the UsbDeviceClass Instance
  // ----------------------------
  async connectAndExecute (port: ProbeInfo | UsbDevice, command: string): Promise<string> {
    // if already connected to the port, disconnect first
    if (port instanceof UsbDevice) {
      if (port.ifc.connected) {
        try {
          await port.disconnect()
        } catch (error: unknown) {
          console.error('error disconnecting', error)
        }
      }
    }

    return await new Promise((resolve, reject) => {
      let timedOut = false
      const portTimeout = setTimeout(() => {
        timedOut = true
        closePort()
      }, 1000)

      const tempPort = new SerialPort({
        path: port.path,
        baudRate: 115200
      }, (err: Error | null) => {
        if (err !== null) {
          closePort(err)
        }
      })

      const closePort = (error: Error | null = null): void => {
        clearTimeout(portTimeout)
        tempPort.removeAllListeners()
        try {
          tempPort.close()
        } catch (error) {
          console.error('error closing port', error)
        }
        if (error !== null) {
          reject(error)
        } else {
          resolve(receivedData.replace(command, '')) // remove the command from the result
        }
      }

      let receivedData = ''
      tempPort.on('data', (data: Buffer) => {
        receivedData += data.toString()
      })

      tempPort.on('open', () => {
        tempPort.write(command)
        setTimeout(() => {
          closePort()
        }, 500)
      })

      tempPort.on('error', (error) => {
        if (timedOut) return
        closePort(error)
      })
    })
  }

  getTreeItem (element: vscode.TreeItem): vscode.TreeItem {
    if (element instanceof UsbDevice) {
      let contextValue = 'usbDevice'
      if (element.ifc?.connected) {
        contextValue = 'usbDeviceConnected'
      }

      if (element.dvkProbe) {
        contextValue = contextValue + 'DvkProbe'
      }

      let label = element.name
      if (element.type === 'busy') {
        label = `${element.name} (busy)`
        contextValue = 'usbDeviceBusy'
      }
      return {
        label,
        description: element.description,
        collapsibleState: element.collapsibleState,
        command: element.command,
        contextValue,
        iconPath: element.iconPath
      }
    } else {
      return element
    }
  }

  // list the connected parent nodes (USB Devices)
  // returns a promise
  // ----------------------------
  async _getUsbDevices (): Promise<UsbDevice[]> {
    return await new Promise((resolve, reject) => {
      // Pyocd.exec(['--list']).then((result) => {
      const ports: ProbeInfo[] = []
      const deviceIds: Set<string> = new Set()
      this.pyocdInterface.listDevices().then(async (result: DvkProbeInterfaces[]) => {
        result.forEach((p: DvkProbeInterfaces) => {
          p.ports.forEach((port: DvkProbeInterface, idx: number) => {
            port.board_name = p.board_name
            const portInfo = new ProbeInfo(port)
            portInfo.idx = idx
            deviceIds.add(portInfo.path)
            deviceIds.add(portInfo.path.replace('/dev/cu.', '/dev/tty.'))
            ports.push(portInfo)
          })
        })
        return await SerialPort.list()
      }).then((result: PortInfo[]) => {
        result.forEach((port: PortInfo) => {
          const portInfo = new ProbeInfo(port)
          // if this is a port that the probe didn't find
          if (!deviceIds.has(portInfo.path)) {
            deviceIds.add(portInfo.path)
            ports.push(portInfo)
          }
        })

        // for each port, check if it's already known.
        // if not, connect and detect if repl capable
        async.eachSeries(ports, (port, next) => {
          // create a uri from the path
          // memfs:/serial/{serialNumber}/dev/tty.usbmodem1411
          // memfs:/serial/{serialNumber}/COM3
          if (port.serialNumber === '') {
            return next()
          }
          // if windows, we need a slash here
          let slash = ''
          if (process.platform === 'win32') {
            slash = '/'
          }
          const uri = vscode.Uri.parse(`memfs:/serial/${port.serialNumber}${slash}${port.path}`)
          if (this.hiddenUsbDeviceNodes.includes(uri.toString())) {
            return next()
          }

          // check if the port is already known
          for (let idx = 0; idx < this.usbDeviceNodes.length; idx++) {
            if (this.usbDeviceNodes[idx].uriString === uri.toString() && this.usbDeviceNodes[idx].type !== 'busy') {
              return next()
            }
          }

          // for known boards we can skip the serial port query
          //
          if (port.board_name !== 'Unknown') {
            // dap link probe
            if (port.board_name.toLowerCase().includes('nx040 dvk')) {
              if (port.idx === 0) {
                const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.None, port, 'uart')
                this.usbDeviceNodes.push(portItem)
                return next()
              } else if (port.idx === 1) {
                const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.Collapsed, port, 'repl')
                this.usbDeviceNodes.push(portItem)
                return next()
              }
            }
          }

          // if no target_board_name, fallback to serial port query
          // if not, connect and detect if repl capable
          //
          this.connectAndExecute(port, '\r\n').then((result) => {
            // if data is >>> it is a repl capable device
            if (result.includes('>>>')) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.Collapsed, port, 'repl')
              this.usbDeviceNodes.push(portItem)
            } else if (result.includes('uart:~$')) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.None, port, 'uart')
              this.usbDeviceNodes.push(portItem)
            } else if (result.includes('00')) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.None, port, 'smartbasic')
              this.usbDeviceNodes.push(portItem)
            } else if (result !== '' || 'board_name' in port) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.None, port, 'unknown')
              this.usbDeviceNodes.push(portItem)
            } else {
              // if no data, it's probably not a serial device we can use
              // hide it so it doesn't get queried everytime
              this.hiddenUsbDeviceNodes.push(uri.toString())
            }
            next()
          }).catch((error) => {
            if (error.message.includes('Resource busy') === true) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.None, port, 'busy')
              this.usbDeviceNodes.push(portItem)
            }
            console.error('error connecting to port', error.message)
            next()
          })
        }, (error) => {
          if (error !== null) {
            reject(error)
          }
          // remove items that are no longer in the list
          this.usbDeviceNodes = this.usbDeviceNodes.filter((item) => {
            return deviceIds.has(item.options.path)
          })

          resolve(this.usbDeviceNodes)
        })
      }).catch((error: unknown) => {
        reject(error)
      })
    })
  }

  async getChildren (element?: UsbDevice): Promise<vscode.TreeItem[]> {
    if (element !== undefined) {
      const key = element?.uri.path ?? 'root'
      const result = this.treeCache.get(key)
      if (result !== undefined) {
        return await Promise.resolve(result)
      }
      try {
        const result = await element.getUsbDeviceFolder()
        this.treeCache.set(key, result)
        return await Promise.resolve(result)
      } catch (error) {
        return await Promise.reject(error)
      }
    } else {
      // pyocd query
      return await this._getUsbDevices()
    }
  }
}
