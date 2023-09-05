import * as path from 'path'
import * as vscode from 'vscode'
import { UsbDevice } from './usb-device.class'

export class UsbDeviceFile extends vscode.TreeItem {
  label: string
  uri: vscode.Uri
  type: string
  size: number
  command: any
  name: string
  parentDevice: UsbDevice

  // overrides
  public readonly contextValue: string
  public readonly tooltip: string
  public readonly iconPath: any

  constructor (
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
    this.label = fragment
    this.uri = uri
    this.size = size
    this.type = type
    this.command = {
      command: 'usbDevices.openDeviceFile',
      arguments: [this]
    }
    this.name = this.label
    this.contextValue = this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
    this.tooltip = this.uri.path
    this.iconPath = {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-file.svg')
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
    const rate = 128
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
          const result = await this.parentDevice.ifc.writeWait(`binascii.hexlify(f.read(${rate}))\r`, 1000)

          // loop until returned bytes is less than 64
          const startSlice: number = result.indexOf("'")
          const chunk: string = result.slice(startSlice + 1, result.lastIndexOf("'"))
          readBuffer.write(chunk, offset, 'hex')

          const increment = Math.round((chunk.length / this.size * 2) * 100)
          progress.report({ increment, message: 'Loading File...' })

          if (offset < this.size) {
            offset += chunk.length / 2
            return await read()
          } else if (cancelled) {
            return await Promise.reject(new Error('cancelled'))
          } else {
            return await Promise.resolve(readBuffer.toString('ascii'))
          }
        } catch (error) {
          console.log('error', error)
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
          console.log('resolve data', fileData)
          return await Promise.resolve(fileData)
        }
      } catch (error) {
        return await Promise.reject(error)
      }
    })
  }

  async writeFileToDevice (data: string): Promise<string> {
    let offset = 0
    console.log('writeFileToDevice', data)
    const write = async (): Promise<Error | string> => {
      try {
        const bytesToWrite = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + 128)
        console.log('bytesToWrite', bytesToWrite)
        if (bytesToWrite === null) {
          return await Promise.resolve('OK')
        }
        await this.parentDevice.ifc.writeWait(`f.write(binascii.unhexlify('${bytesToWrite}'))\r`)
      } catch (error) {
        console.log('error', error)
        return await Promise.reject(error)
      }
      offset += 128
      console.log(offset, data.length)
      if (offset < data.length * 2) {
        return await write()
      } else {
        return await Promise.resolve('OK')
      }
    }

    await this.parentDevice.ifc.writeWait('import binascii\r', 1000)
    const result = await this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'wb')\r`, 1000)
    if (result.indexOf('>>>') === -1) {
      return await Promise.reject(result)
    } else {
      // start writing chunks
      await write()
      // console.log('write result', result)
      console.log('close')
      return this.parentDevice.ifc.writeWait('f.close()\r', 1000)
    }
  }
}