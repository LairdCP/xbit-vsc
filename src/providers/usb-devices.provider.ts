import * as vscode from 'vscode'
import * as async from 'async'

import { UsbDevice } from '../lib/usb-device.class'
import { ProbeInfo, DvkProbeInterface, DvkProbeInterfaces } from '../lib/hardware-probe-info.class'
import { PortInfo } from '@serialport/bindings-interface'

import { SerialPort } from 'serialport'
// import { UsbDeviceFolder } from '../lib/usb-device-folder.class'
import { UsbDeviceFile } from '../lib/usb-device-file.class'
import { PyocdInterface } from '../lib/pyocd'
import ExtensionContextStore from '../stores/extension-context.store'

export class UsbDevicesProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.TreeDragAndDropController<vscode.TreeItem> {
  dragMimeTypes: readonly string[] = ['text/plain', 'text/x-python', 'application/x-python-code', 'text/uri-list']
  dropMimeTypes: readonly string[] = ['text/plain', 'text/x-python', 'application/x-python-code', 'text/uri-list']

  context: vscode.ExtensionContext
  _onDidChangeTreeData: vscode.EventEmitter<vscode.Event<any> | null>
  usbDeviceNodes: UsbDevice[]
  hiddenUsbDeviceNodes: string[]
  lastSentHex: string | null
  treeCache: Map<string, UsbDeviceFile[]>
  staleTreeCache: Map<string, Array<{ path: string, size: number }>>
  pyocdInterface: PyocdInterface

  constructor (context: vscode.ExtensionContext, ifc: PyocdInterface) {
    this.context = context
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.usbDeviceNodes = []
    this.hiddenUsbDeviceNodes = [] // connected USB devices that don't response to serial query are put here
    this.lastSentHex = null
    this.treeCache = new Map() // cache the file tree for each device and sub folder. Key is the device.path/folder/...
    this.staleTreeCache = new Map() // when refreshing device files, stash the current treeCache here so we can compare
    this.pyocdInterface = ifc
  }

  get onDidChangeTreeData (): vscode.Event<any> {
    return this._onDidChangeTreeData.event
  }

  public async handleDrop (
    target: vscode.TreeItem | undefined,
    sources: vscode.DataTransfer,
    token: vscode.CancellationToken): Promise<void> {
    if (target === undefined) {
      return
    }
    if (target instanceof UsbDeviceFile) {
      target = target.parentDevice
    }
    if (!(target instanceof UsbDevice)) {
      return
    }
    const files: string[] = sources.get('text/uri-list')?.value.split('\r\n')
    for (const file of files) {
      const uri = vscode.Uri.parse(file)
      const data = await vscode.workspace.fs.readFile(uri)

      // if the file is larger than 32k, don't write it
      if (data.length > 32768) {
        void vscode.window.showErrorMessage('File too large')
        return
      }

      const fileName = uri.path.split('/').pop()
      if (fileName !== undefined) {
        // is there a tree cache listing already?
        if (!(this.treeCache.has(target.uri.path))) {
          // if not, get the tree listing
          await this.getChildren(target)
        }

        const found = this.treeCache.get(target.uri.path)?.find((file) => {
          const compareFile = file.uri.path.split('/').pop()
          return compareFile === fileName
        })

        if (found !== undefined) {
          // if the file is already on the device, prompt to overwrite
          const overwrite = await vscode.window.showInformationMessage(`Overwrite ${fileName}?`, 'Yes', 'No')
          if (overwrite === 'No') {
            return
          }
        }

        // write the file to the device
        try {
          ExtensionContextStore.mute()
          await target.createFile(fileName, Buffer.from(data))
          ExtensionContextStore.outputChannel.appendLine('Saved\n')
        } catch (error) {
          ExtensionContextStore.outputChannel.appendLine('Error saving\n')
        } finally {
          ExtensionContextStore.unmute()
        }
      }
    }
    // refresh device files command
    await vscode.commands.executeCommand('xbitVsc.refreshDeviceFiles', target)
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
  async connectAndExecute (port: ProbeInfo, commands: string[]): Promise<string[]> {
    // if already connected to the port, disconnect first
    return await new Promise((resolve, reject) => {
      let timedOut = false
      let receivedData = ''
      const responses: string[] = []
      const portTimeout = setTimeout(() => {
        timedOut = true
        closePort()
      }, 1500)

      const tempPort = new SerialPort({
        path: port.path,
        baudRate: 115200
      }, (err: Error | null) => {
        if (err !== null) {
          closePort(err)
        }
      })

      const closePort = (error: Error | null = null): void => {
        tempPort.removeAllListeners()
        tempPort.close((error) => {
          if (error !== null) {
            ExtensionContextStore.error('error closing port', error)
            reject(error)
          } else {
            resolve(responses)
          }
        })
      }

      let commandTimeout = setTimeout(() => null, 0)
      let command: string | undefined
      const sendCommand = (): void => {
        if (command !== undefined) {
          const data = receivedData.replace(command, '')
          responses.push(data)
        }
        receivedData = ''

        command = commands.shift()
        if (command === undefined) {
          return closePort()
        }

        tempPort.write(command)
        commandTimeout = setTimeout(() => {
          sendCommand()
        }, 500)
      }

      tempPort.on('data', (data: Buffer) => {
        receivedData += data.toString()
        if (receivedData.includes('>>>')) {
          clearTimeout(commandTimeout)
          sendCommand()
        }
      })

      tempPort.on('open', () => {
        clearTimeout(portTimeout)
        sendCommand()
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
        iconPath: element.iconPath,
        id: element.id
      }
    } else {
      let contextValue = 'usbDeviceFile'
      if (typeof element.label === 'string' && /\.py$/.test(element.label)) {
        contextValue = 'usbDeviceFilePython'
      }
      return {
        label: element.label,
        description: element.description,
        collapsibleState: element.collapsibleState,
        command: element.command,
        contextValue,
        iconPath: element.iconPath,
        id: element.id
      }
    }
  }

  async getPorts (): Promise<{ ports: ProbeInfo[], deviceIds: Set<string> }> {
    // Pyocd.exec(['--list']).then((result) => {
    const ports: ProbeInfo[] = []
    const deviceIds: Set<string> = new Set()
    const pyOcdResult = await this.pyocdInterface.listDevices()
    pyOcdResult.forEach((p: DvkProbeInterfaces) => {
      p.ports.forEach((port: DvkProbeInterface, idx: number) => {
        port.board_name = p.board_name
        const portInfo = new ProbeInfo(port)
        portInfo.idx = idx
        deviceIds.add(portInfo.path)
        deviceIds.add(portInfo.path.replace('/dev/cu.', '/dev/tty.'))
        ports.push(portInfo)
      })
    })
    const serialPortResult = await SerialPort.list()
    serialPortResult.forEach((port: PortInfo) => {
      const portInfo = new ProbeInfo(port)
      // if this is a port that the probe didn't find
      if (!deviceIds.has(portInfo.path)) {
        deviceIds.add(portInfo.path)
        ports.push(portInfo)
      }
    })
    return { ports, deviceIds }
  }

  // list the connected parent nodes (USB Devices)
  // returns a promise
  // ----------------------------
  async _getUsbDevices (): Promise<UsbDevice[]> {
    return await new Promise((resolve, reject) => {
      this.getPorts().then(({ ports = [], deviceIds = new Set() }) => {
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
          let known: UsbDevice | undefined
          for (let idx = 0; idx < this.usbDeviceNodes.length; idx++) {
            if (this.usbDeviceNodes[idx].uriString === uri.toString()) {
              known = this.usbDeviceNodes[idx]
              // if the port is known and not a "busy" port, we don't query it again
              if (this.usbDeviceNodes[idx].type !== 'busy') {
                return next()
              }
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
          this.connectAndExecute(port, [
            '\x03',
            '\r\n'
          ]).then(async ([, result]) => {
            // if data is >>> it is a repl capable device
            if (result.includes('>>>')) {
              const portItem = new UsbDevice(this.context, uri, vscode.TreeItemCollapsibleState.Collapsed, port, 'repl')
              try {
                let responses = await this.connectAndExecute(port, [
                  'import os;os.uname()\r\n',
                  'app_id\r\n',
                  'app_ver\r\n'
                ])
                responses = responses.map((response) => {
                  return response.replace('>>> ', '').replace(/(\r|\n)+/g, '')
                })
                portItem.uname = /^Traceback/.test(responses[0]) ? 'unknown' : responses[0]
                portItem.appId = /^Traceback/.test(responses[1]) ? 'unknown' : responses[1].replace(/'/g, '')
                portItem.appVersion = /^Traceback/.test(responses[2]) ? 'unknown' : responses[2].replace(/'/g, '')
              } catch (error) {
                ExtensionContextStore.error('error getting app_id', error)
              }

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
            if (error.message.includes('Resource busy') === true && known === undefined) {
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

          // remove zephyr devices if not enabled
          const returnNodes = this.usbDeviceNodes.filter((item): boolean => {
            // rewrite this if else to be shorter
            if (item.type === 'uart') {
              return ExtensionContextStore.showZephyr
            } else {
              return true
            }
          })
          resolve(returnNodes)
        })
      }).catch((error: unknown) => {
        reject(error)
      })
    })
  }

  async getChildren (element?: UsbDevice): Promise<vscode.TreeItem[]> {
    // if (element !== undefined && !element.connected) {
    //   return await Promise.resolve([])
    // }
    if (this.pyocdInterface.executable === null) {
      return await Promise.resolve([])
    }
    if (element !== undefined) {
      const key = element?.uri.path ?? 'root'
      const result = this.treeCache.get(key)
      if (result !== undefined) {
        return await Promise.resolve(result)
      }
      try {
        if (!element.connected) {
          await vscode.commands.executeCommand('xbitVsc.connectUsbDevice', element)
        }
        ExtensionContextStore.mute()
        const result = await element.getUsbDeviceFolder()
        this.treeCache.set(key, result)

        // if this.staleTreeCache has a key for this device, compare the files
        // if the file size is different, mark the file as dirty
        const staleFiles = this.staleTreeCache.get(key)
        if (staleFiles !== undefined) {
          for (const file of result) {
            const staleFile = staleFiles.find((f) => {
              return f.path === file.uri.path
            })
            if (staleFile === undefined ||
              (staleFile !== undefined && staleFile.size !== file.size)) {
              // delete from memfs
              try {
                await vscode.workspace.fs.delete(file.uri)
              } catch (ex) {
                // can't delete file as it's not been loaded
                // OK
              }
            }
          }
        }

        return await Promise.resolve(result)
      } catch (error) {
        return await Promise.reject(error)
      } finally {
        ExtensionContextStore.unmute()
      }
    } else {
      // pyocd query
      return await this._getUsbDevices()
    }
  }

  async getParent (element: vscode.TreeItem): Promise<vscode.TreeItem> {
    const usbDevice = element as UsbDevice
    return await Promise.resolve(usbDevice.parentDevice)
  }
}
