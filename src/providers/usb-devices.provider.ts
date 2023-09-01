import * as vscode from 'vscode'
import * as async from 'async'

import { UsbDevice } from '../lib/usb-device.class'
import { PortInfo, ProbeInfo } from './hardware-probe-info'
import { SerialPort } from 'serialport'
// import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
import { UsbDeviceFile } from '../lib/usb-device-file.class'

export class UsbDevicesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  context: vscode.ExtensionContext
  _onDidChangeTreeData: vscode.EventEmitter<any>
  usbDeviceNodes: UsbDevice[]
  hiddenUsbDeviceNodes: string[]
  parser: any
  lastSentHex: any
  treeCache: Map<string, UsbDeviceFile[]>
  pyocdInterface: any

  constructor (context: any, ifc: any) {
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.usbDeviceNodes = []
    this.hiddenUsbDeviceNodes = [] // connected USB devices that don't response to serial query are put here
    this.parser = null
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

  disconnectAll (): void {
    this.usbDeviceNodes.forEach((usbDevice) => {
      usbDevice.disconnect().catch((error: Error) => {
        console.log('error disconnecting', error)
      })
    })
  }

  // Connect to a port, execute a command, disconnect and return the result
  // This is used for commands that don't require a persistant connection to the device
  // params:
  // port is the UsbDeviceClass Instance
  // ----------------------------
  async connectAndExecute (port: any, command: string): Promise<string> {
    // if already connected to the port, disconnect first
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
          closePort()
        }
      })

      const closePort = (error: any = null): void => {
        clearTimeout(portTimeout)
        tempPort.removeAllListeners()
        try {
          tempPort.close()
        } catch (error) {
          console.log('error closing port', error)
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
        }, 100)
      })

      tempPort.on('error', (error) => {
        if (timedOut) return
        closePort(error)
      })
    })
  }

  getTreeItem (element: vscode.TreeItem): vscode.TreeItem {
    if (element instanceof UsbDevice) {
      return {
        label: element.label,
        collapsibleState: element.collapsibleState,
        command: element.command,
        contextValue: element.ifc?.connected === true ? 'usbDeviceConnected' : 'usbDevice',
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
      let ports: ProbeInfo[]
      const deviceIds: string[] = []
      SerialPort.list().then((result: any[]) => {
        ports = result.map((port: PortInfo) => {
          return new ProbeInfo(port)
        })
        return this.pyocdInterface.listDevices()
      }).then((result) => {
        result.forEach((p: any) => {
          p._ports.forEach((port: PortInfo) => {
            const portInfo = new ProbeInfo(port)
            if (!deviceIds.includes(portInfo.serialNumber)) {
              ports.push(portInfo)
              deviceIds.push(portInfo.serialNumber)
            }
          })
        })

        // for each port, check if it's already known.
        // if not, connect and detect if repl capable
        async.eachSeries(ports, (port, next) => {
          // create a uri from the path
          // memfs:/serial/dev/tty.usbmodem1411
          // memfs:/serial/COM3
          if (port.serialNumber === '') {
            return next()
          }
          const uri = vscode.Uri.parse(`memfs:/serial/${port.serialNumber}${port.path}`)
          console.log('memfs uri', uri)
          if (this.hiddenUsbDeviceNodes.includes(uri.toString())) {
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
            if (result.includes('>>>')) {
              const portItem = new UsbDevice(uri, vscode.TreeItemCollapsibleState.Collapsed, port, 'repl')
              this.usbDeviceNodes.push(portItem)
            } else if (result.includes('uart:~$')) {
              const portItem = new UsbDevice(uri, vscode.TreeItemCollapsibleState.None, port, 'uart')
              this.usbDeviceNodes.push(portItem)
            } else if (result !== '') {
              const portItem = new UsbDevice(uri, vscode.TreeItemCollapsibleState.None, port, 'unknown')
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
          if (error !== null) {
            reject(error)
          }
          // remove items that are no longer in the list
          this.usbDeviceNodes = this.usbDeviceNodes.filter((item) => {
            return deviceIds.includes(item.serialNumber)
          })
          resolve(this.usbDeviceNodes)
        })
      }).catch((error) => {
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
        this.refresh()
        return await Promise.resolve(result)
      } catch (error) {
        return await Promise.reject(error)
      }
    } else {
      // pyocd query
      return await this._getUsbDevices()
    }
  }

  async createFile (element: UsbDevice, filePath: string): Promise<void> {
    try {
      await element.createFile(filePath)
      await vscode.window.showInformationMessage(`Created New File: ${filePath}`)
    } catch (error) {
      await vscode.window.showInformationMessage('Error Creating File')
    }
    const key = element?.uri.toString() ?? 'root'
    this.treeCache.delete(key)
    this.refresh()
  }

  async deleteFile (element: UsbDeviceFile): Promise<void> {
    // const dirPath = path.dirname(filePath)
    const key = element?.uri.toString()
    try {
      await element.parentDevice.deleteFile(element.devPath)
      await vscode.window.showInformationMessage(`Deleted File: ${key}`)
    } catch (error) {
      await vscode.window.showInformationMessage('Error Deleting File')
    }
    // remove from MemFS cache
    this.treeCache.delete(key)
    console.log('refreshing')
    this.refresh()
  }

  async renameFile (element: UsbDeviceFile, newFilePath: string): Promise<void> {
    const oldFilePath = element.devPath.split('/').pop()
    const newFileName = newFilePath.split('/').pop()
    const key = element?.uri.toString()
    try {
      await element.parentDevice.renameFile(oldFilePath, newFileName)
      await vscode.window.showInformationMessage(`Renamed File: ${newFileName ?? ''}`)
    } catch (error) {
      await vscode.window.showInformationMessage('Error Renaming File')
    }
    // remove from MemFS cache
    this.treeCache.delete(key)
    this.refresh()
  }
}
