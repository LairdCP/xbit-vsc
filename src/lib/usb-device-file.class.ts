import * as path from 'path'
import * as vscode from 'vscode'

export class UsbDeviceFile extends vscode.TreeItem {
  label: string
  uri: vscode.Uri
  type: string
  size: number
  command: any
  parentDevice: any // UsbDevice
  name: string

  // overrides
  public readonly contextValue: string
  public readonly tooltip: string
  public readonly iconPath: any

  constructor (
    uri: vscode.Uri,
    type: string,
    size: number,
    command: any
  ) {
    super(uri.fragment, vscode.TreeItemCollapsibleState.None)
    this.label = uri.fragment
    this.uri = uri
    this.size = size
    this.type = type
    this.command = command
    this.name = this.label
    this.contextValue = this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
    this.tooltip = this.uri.path
    this.iconPath = {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-file.svg')
    }
  }

  // full fs path
  get dir (): string {
    return path.dirname(this.uri.path)
  }

  // file system provider.readFile will figure this out
  get devPath (): string {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }

  async readFileFromDevice (): Promise<string> {
    const rate = 128
    const result: string = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading ${this.uri.path}`,
      cancellable: true
    }, async (progress, token) => {
      let cancelled = false
      token.onCancellationRequested(() => {
        cancelled = true
      })

      let data = ''
      const read = async (): Promise<string> => {
        try {
          const result = await this.parentDevice.ifc.writeWait(`binascii.hexlify(f.read(${rate}))\r`, 1000)
          // console.log('read result', result)

          // loop until returned bytes is less than 64
          const startSlice: number = result.indexOf("'")
          const chunk = Buffer.from(result.slice(startSlice + 1, result.lastIndexOf("'")), 'hex').toString('hex')
          data += chunk
          const increment = Math.round((chunk.length / this.size * 2) * 100)
          progress.report({ increment, message: 'Loading File...' })
          if (chunk.length === rate * 2) {
            return await read()
          } else if (cancelled) {
            return await Promise.reject(new Error('cancelled'))
          } else {
            return await Promise.resolve(data)
          }
        } catch (error) {
          console.log('error', error)
          return await Promise.reject(error)
        }
      }

      try {
        // open file
        await this.parentDevice.ifc.writeWait('import binascii\r', 1000)
        await this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'rb')\r`, 1000)
        if (result.includes('>>>')) {
          return await Promise.reject(result)
        } else {
          await read()
          await this.parentDevice.ifc.writeWait('f.close()\r', 1000)
          return await Promise.resolve(result)
        }
      } catch (error) {
        return await Promise.reject(error)
      }
    })
    return await Promise.resolve(result)
  }

  async writeFileToDevice (data: string): Promise<string> {
    let offset = 0
    const write = async (): Promise<Error | string> => {
      try {
        const bytesToWrite = Buffer.from(data, 'ascii').toString('hex')
        if (bytesToWrite === null) {
          return await Promise.resolve('OK')
        }
        await this.parentDevice.ifc.writeWait(`f.write(binascii.unhexlify('${bytesToWrite}'))\r`)
      } catch (error) {
        console.log('error', error)
        return await Promise.reject(error)
      }
      offset += 50
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
      return this.parentDevice.ifc.writeWait('f.close()\r', 1000)
    }
  }
}

module.exports = UsbDeviceFile
