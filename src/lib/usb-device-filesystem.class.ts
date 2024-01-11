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
  private _rwRrate = 512
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
  async createFile (filePath: string, data?: Buffer): Promise<string> {
    try {
      // if data is defined, write it to the file
      if (data !== undefined) {
        return await this.writeFile(new UsbDeviceFile(this.usbDevice.context, this.usbDevice.uri.with({ path: filePath }), 'file', data.length, this.usbDevice), data.toString('ascii'))
      } else {
        this.opLock = CONST_CREATING_FILE
        await this.usbDevice.writeWait(`f = open('${filePath}', 'w')\r`, 1000)
        await this.usbDevice.writeWait('f.close()\r', 1000)
        return await Promise.resolve('ok')
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

  async writeFile (file: UsbDeviceFile, data: string): Promise<string> {
    // if already writing, reject
    if (this.opLock !== false) {
      return await Promise.reject(new Error(this.opLock as string))
    }
    this.opLock = CONST_WRITING_FILE
    this.writing = file
    let offset = 0
    const write = async (): Promise<Error | string> => {
      try {
        const bytesToWrite = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + this._rwRrate)
        if (bytesToWrite === null) {
          return await Promise.resolve('OK')
        }
        await this.usbDevice.writeWait(`f.write(binascii.unhexlify('${bytesToWrite}'))\r`)
      } catch (error) {
        console.error('error', error)
        this.writing = null

        return await Promise.reject(error)
      }

      offset += this._rwRrate
      if (offset < data.length * 2) {
        return await write()
      } else {
        file.size = data.length
        this.writing = null
        this.opLock = false
        return await Promise.resolve('OK')
      }
    }
    try {
      await this.usbDevice.writeWait('import binascii\r', 1000)
      const result = await this.usbDevice.writeWait(`f = open('${file.devPath}', 'wb')\r`, 1000)
      if (!result.includes('>>>')) {
        this.writing = null
        return await Promise.reject(result)
      } else {
        // start writing chunks
        await write()
        return await this.usbDevice.writeWait('f.close()\r', 1000)
      }
    } catch (error) {
      this.writing = null
      this.opLock = false
      return await Promise.reject(error)
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

  async readFile (file: UsbDeviceFile): Promise<string> {
    if (this.opLock !== false) {
      return await Promise.reject(new Error(this.opLock as string))
    }
    this.reading = file
    this.opLock = CONST_READING_FILE
    try {
      return await file.readFileFromDevice()
    } catch (error) {
      return await Promise.reject(error)
    } finally {
      this.reading = null
      this.opLock = false
    }
  }
}
