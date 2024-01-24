// this class managing filesystem operations on the device

import { UsbDeviceFile } from './usb-device-file.class'
import { UsbDevice } from './usb-device.class'
import { pythonLsStatElement } from './util.ifc'

const CONST_READING_FILE = 'Currently Reading File'
const CONST_WRITING_FILE = 'Currently Writing File'
const CONST_READING_DIR = 'Currently Reading Dir'
const CONST_CREATING_FILE = 'Currently Creating File'

export class UsbDeviceFileSystem {
  private _opLock: boolean | string = false
  private writing: UsbDeviceFile | null = null
  private reading: UsbDeviceFile | null = null
  private readingDir: string | null = null
  private _rwRrate = 256
  usbDevice: UsbDevice

  constructor (usbDevice: UsbDevice) {
    this.usbDevice = usbDevice
  }

  get rate (): number {
    return this._rwRrate
  }

  set rate (rate: number) {
    this._rwRrate = rate
  }

  get opLock (): boolean | string {
    return this._opLock
  }

  set opLock (lock: boolean | string) {
    this._opLock = lock
  }

  // TODO change to writeFile command
  async createFile (filePath: string, data?: Buffer): Promise<null> {
    try {
      // if data is defined, write it to the file
      if (data !== undefined) {
        const newFile = new UsbDeviceFile(this.usbDevice.context, this.usbDevice.uri.with({ path: filePath }), 'file', data.length, this.usbDevice)
        return await this.writeFileRawREPL(newFile, data)
      } else {
        this.opLock = CONST_CREATING_FILE
        await this.usbDevice.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
        await this.usbDevice.writeWait('f.close()\r', 1000)
        return await Promise.resolve(null)
      }
    } catch (error) {
      return await Promise.reject(error)
    } finally {
      this.opLock = false
    }
  }

  // TODO change to deleteFile command
  async deleteFile (filePath: string): Promise<void> {
    // write import os
    await this.usbDevice.writeWait(`import os\ros.unlink('${filePath}')\r`, 1000)
  }

  async renameFile (oldFilePath: string, newFilePath: string): Promise<void> {
    // write import os
    await this.usbDevice.writeWait(`import os\ros.rename('${oldFilePath}', '${newFilePath}')\r`, 1000)
  }

  async writeFileRawREPL (file: UsbDeviceFile, data: Buffer, progressCallback: any = null): Promise<null> {
    // if already writing, reject
    if (this.opLock !== false) {
      return await Promise.reject(new Error(this.opLock as string))
    }
    this.opLock = CONST_WRITING_FILE
    this.writing = file

    const commands = [
      'import binascii',
      `f = open('${file.devPath}', 'wb')`
    ]

    // chunkStart tracks the beginning of the current read chunk
    let chunkStart = 0
    while (chunkStart < data.length * 2) {
      const bytesToWrite = data.toString('hex').slice(chunkStart, chunkStart + this._rwRrate)
      if (bytesToWrite === null) {
        break
      }
      commands.push(`f.write(binascii.unhexlify('${bytesToWrite}'))`)
      chunkStart += this._rwRrate
    }
    commands.push('f.close()')

    const commandsPerPaste = 16
    try {
      console.time('rawwrite')
      await this.usbDevice.ifc.sendEnterRawMode()
      while (commands.length > 0) {
        const commandsToSend = commands.splice(0, commandsPerPaste)
        await this.usbDevice.ifc.sendEnterRawPasteMode()
        await this.usbDevice.ifc.writeRawPasteMode(Buffer.from(commandsToSend.join('\r\n'), 'ascii'))
        await this.usbDevice.ifc.sendExitRawPasteMode()
        if (typeof progressCallback === 'function') {
          progressCallback(this._rwRrate * commandsPerPaste, data.length * 2)
        }
      }
      await this.usbDevice.ifc.sendExitRawMode()
      return await Promise.resolve(null)
    } catch (error) {
      return await Promise.reject(error)
    } finally {
      console.timeEnd('rawwrite')
      this.writing = null
      this.opLock = false
      await this.usbDevice.ifc.sendExitRawMode()
    }
  }

  async readFileRawREPL (file: UsbDeviceFile, progressCallback: any = null): Promise<Buffer> {
    // if already reading, reject
    if (this.opLock !== false) {
      return await Promise.reject(new Error(this.opLock as string))
    }
    this.opLock = CONST_READING_FILE
    this.reading = file
    const commands = [
      'import binascii',
      `f = open('.${file.devPath}', 'rb')`
    ]

    let chunkEnd = 0
    while (chunkEnd < file.size) {
      commands.push(`print(binascii.hexlify(f.read(${this._rwRrate})).decode())`)
      chunkEnd += this._rwRrate
    }
    commands.push('f.close()')

    let readResult = Buffer.from('')
    try {
      await this.usbDevice.ifc.sendEnterRawMode()
      await this.usbDevice.ifc.flush()

      while (commands.length > 0) {
        let nextCommand = commands.shift()
        if (nextCommand === undefined) {
          break
        }
        nextCommand = nextCommand + '\r\n'
        await this.usbDevice.ifc.write(nextCommand)
        const readBuffer = await this.usbDevice.ifc.sendExecuteRawMode()
        readResult = Buffer.concat([readResult, readBuffer])
        if (typeof progressCallback === 'function') {
          progressCallback(this._rwRrate, file.size)
        }
      }
      await this.usbDevice.ifc.sendExitRawMode()
      // const readResult = await this.usbDevice.ifc.sendExecuteRawMode()
      // file contents will be a Buffer with this: b'HEXBYTES'\n\rb'HEXBYTES'\n\rb'HEXBYTES'
      // convert to hex bytes and replace the extra characters
      // b', ' and /r/n
      // console.log('readResult', readResult)
      const hexString = readResult.toString('hex').replace(/(0d|0a)/g, '')
      // convert back to a buffer, and then to ascii string
      // console.log('hexString', hexString)
      const hexContents = Buffer.from(hexString, 'hex').toString()
      // convert the ascii hex string to ascii
      // console.log('hexContents', hexContents)
      const fileContents = Buffer.from(hexContents, 'hex')

      return await Promise.resolve(fileContents)
    } catch (error) {
      console.error('error', error)
      return await Promise.reject(error)
    } finally {
      this.reading = null
      this.opLock = false
    }
  }

  // Returns a promise
  //
  // Write the ls function to repl console
  // Call the function with the current dir
  // Parse the result and populate an array
  // return the array in the promise
  async readDirFromDevice (dirPath: string): Promise<pythonLsStatElement[]> {
    if (!this.usbDevice.replCapable) {
      return await Promise.resolve([])
    }

    if (this.opLock !== false) {
      return await Promise.reject(new Error(this.opLock as string))
    }

    this.opLock = CONST_READING_DIR
    this.readingDir = dirPath
    const timeout = async (ms: number): Promise<void> => {
      return await new Promise(resolve => setTimeout(resolve, ms))
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

    try {
      for (const i of lsFunction) {
        await this.usbDevice.write(i)
        await timeout(100)
      }

      await this.usbDevice.writeWait('\r', 1000)
      const result = await this.usbDevice.writeWait(`ls('${dirPath}')\r`, 1000)
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
          // TODO Create the directory in memFs
        } else {
          element.type = r[1]
        }

        return element
      })
      return await Promise.resolve(fileResult)
    } catch (error) {
      return await Promise.reject(error)
    } finally {
      this.readingDir = null
      this.opLock = false
    }
  }

  // async readFile (file: UsbDeviceFile): Promise<string> {
  //   if (this.opLock !== false) {
  //     return await Promise.reject(new Error(this.opLock as string))
  //   }
  //   this.reading = file
  //   this.opLock = CONST_READING_FILE
  //   try {
  //     return await file.readFileFromDevice()
  //   } catch (error) {
  //     return await Promise.reject(error)
  //   } finally {
  //     this.reading = null
  //     this.opLock = false
  //   }
  // }
}
