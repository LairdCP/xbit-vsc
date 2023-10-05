import * as path from 'path'
import * as vscode from 'vscode'
import { UsbDevice } from './usb-device.class'
import { sleep } from '../util'
import { TreeItemIconPath } from '../lib/util.ifc'

const _rwRrate = 512

export class UsbDeviceFile extends vscode.TreeItem {
  label: string
  context: vscode.ExtensionContext
  uri: vscode.Uri
  type: string
  size: number
  command: vscode.Command
  name: string
  parentDevice: UsbDevice
  private writeFileToDeviceDebounce: NodeJS.Timeout | null = null
  private writeFileToDeviceData: string | undefined
  private writing = false

  // overrides
  public readonly contextValue: string
  public readonly tooltip: string
  public readonly iconPath: TreeItemIconPath

  constructor (
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    type: string,
    size: number,
    parentDevice: UsbDevice
  ) {
    let fragment = uri.path.split('/').pop()
    if (fragment === undefined) {
      fragment = '?'
    }
    super(fragment, vscode.TreeItemCollapsibleState.None)
    this.context = context
    this.label = fragment
    this.uri = uri
    this.size = size
    this.type = type
    this.command = {
      title: 'Open File',
      command: 'xbitVsc.openDeviceFile',
      arguments: [this]
    }

    this.name = this.label
    this.contextValue = this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
    this.tooltip = this.uri.path
    this.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'resources/light/gen-file.svg'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources/dark/gen-file.svg')
    }
    this.parentDevice = parentDevice
  }

  // full fs path
  get dir (): string {
    return path.dirname(this.uri.path)
  }

  // file system provider.readFile will figure this out
  // stupid hack
  get devPath (): string {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }

  async readFileFromDevice (): Promise<string> {
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading ${this.uri.path}`,
      cancellable: true
    }, async (progress, token) => {
      let cancelled = false
      token.onCancellationRequested(() => {
        cancelled = true
      })

      let offset = 0
      const readBuffer = Buffer.alloc(this.size)
      const read = async (): Promise<string> => {
        try {
          const result = await this.parentDevice.ifc.writeWait(`binascii.hexlify(f.read(${_rwRrate}))\r`, 1000)

          // loop until returned bytes is less than 64
          const startSlice: number = result.indexOf("'")
          const chunk: string = result.slice(startSlice + 1, result.lastIndexOf("'"))

          // if chunk is empty, we're done
          if (chunk.length !== 0) {
            readBuffer.write(chunk, offset, 'hex')
            const increment = Math.ceil(((chunk.length / 2) / this.size) * 100)
            progress.report({ increment, message: 'Loading File...' })
          } else {
            this.size = offset
          }
          if (offset < this.size) {
            offset += chunk.length / 2
            await sleep(20)
            return await read()
          } else if (cancelled) {
            return await Promise.reject(new Error('cancelled'))
          } else {
            // if this is a refresh, the buffer could be too big
            // so we need to slice it to the actual current file size
            const returnBuffer = readBuffer.subarray(0, this.size)
            return await Promise.resolve(returnBuffer.toString('ascii'))
          }
        } catch (error) {
          console.error('error', error)
          return await Promise.reject(error)
        }
      }

      try {
        // open file
        await this.parentDevice.ifc.writeWait('import binascii\r', 1000)
        const openResult: string = await this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'rb')\r`, 1000)
        if (!openResult.includes('>>>')) {
          return await Promise.reject(openResult)
        } else {
          const fileData: string = await read()
          await this.parentDevice.ifc.writeWait('f.close()\r', 1000)
          return await Promise.resolve(fileData)
        }
      } catch (error) {
        return await Promise.reject(error)
      }
    })
  }

  async writeFileToDevice (data: string): Promise<string> {
    // if already have a debounce pending, just update the data
    if (this.writeFileToDeviceDebounce !== null) {
      this.writeFileToDeviceData = data
      return await Promise.resolve('OK')
    }

    // if already writing, set the data and a debounce
    if (this.writing) {
      this.writeFileToDeviceData = data
      this.writeFileToDeviceDebounce = setTimeout(() => {
        this.writeFileToDeviceDebounce = null
        if (this.writeFileToDeviceData !== undefined) {
          void this.writeFileToDevice(this.writeFileToDeviceData)
        }
      }, 1000)
      return await Promise.resolve('OK')
    }

    this.writing = true
    this.writeFileToDeviceData = undefined
    let offset = 0
    const write = async (): Promise<Error | string> => {
      try {
        const bytesToWrite = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + _rwRrate)
        if (bytesToWrite === null) {
          return await Promise.resolve('OK')
        }
        await this.parentDevice.ifc.writeWait(`f.write(binascii.unhexlify('${bytesToWrite}'))\r`)
      } catch (error) {
        console.error('error', error)
        return await Promise.reject(error)
      }

      offset += _rwRrate
      if (offset < data.length * 2) {
        return await write()
      } else {
        this.size = data.length
        this.writing = false
        // if write data is pending, write it now
        if (this.writeFileToDeviceData !== undefined) {
          clearTimeout(this.writeFileToDeviceDebounce as NodeJS.Timeout)
          this.writeFileToDeviceDebounce = null
          void this.writeFileToDevice(this.writeFileToDeviceData)
        }
        return await Promise.resolve('OK')
      }
    }
    await this.parentDevice.ifc.writeWait('import binascii\r', 1000)
    const result = await this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'wb')\r`, 1000)
    if (!result.includes('>>>')) {
      this.writing = false
      return await Promise.reject(result)
    } else {
      // start writing chunks
      await write()
      return await this.parentDevice.ifc.writeWait('f.close()\r', 1000)
    }
  }
}
