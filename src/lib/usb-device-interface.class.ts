import { SerialPort } from 'serialport'
import * as EventEmitter from 'events'
import { sleep } from '../util'

interface Options {
  path: string
  baudRate: number
  eofType: string
  supportsBreak: boolean
}
// provides the interface to the serial port for the usb device
// could be extended to support other types of devices connections
export class UsbDeviceInterface extends EventEmitter {
  private serialPort: null | SerialPort
  baudRate: number
  path: string
  resultBuffer: string
  eofType: string
  supportsBreak: boolean

  constructor (options: Options) {
    super()
    this.path = options.path
    this.baudRate = isNaN(options.baudRate) ? options.baudRate : 115200
    this.serialPort = null
    this.resultBuffer = ''
    this.eofType = options.eofType
    this.supportsBreak = options.supportsBreak
  }

  get connected (): boolean {
    return this.serialPort !== null
  }

  async connect (): Promise<void> {
    if (this.serialPort !== null) {
      return await Promise.resolve()
    }
    return await new Promise((resolve, reject) => {
      // if connected, return promise
      try {
        this.serialPort = new SerialPort({
          path: this.path,
          baudRate: this.baudRate
        }, (error) => {
          if (error !== null) {
            reject(error)
          } else {
            resolve()
          }
        })

        this.serialPort.on('data', (data: Buffer) => {
          this.resultBuffer += data.toString()
          // TODO emit serialData event
          this.emit('data', data)
        })
      } catch (error: any) {
        reject(error)
      }
    })
  }

  async disconnect (): Promise<void> {
    try {
      if (this.serialPort !== null && 'port' in this.serialPort) {
        this.serialPort.close()
      }
      this.serialPort = null
      return await Promise.resolve()
    } catch (error) {
      return await Promise.reject(error)
    }
  }

  // break

  // write
  write (data: string): void {
    if (this.serialPort !== null && 'port' in this.serialPort) {
      this.serialPort.write(data)
    }
  }

  // writeWait
  async writeWait (command: string, timeout = 1000, wait = 10): Promise<string> {
    return await new Promise((resolve, reject) => {
      this.resultBuffer = ''
      this.write(command)

      const waiting = setInterval(() => {
        // check for Error first as there will also be a >>> at the end
        if (this.resultBuffer.includes('Error')) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          reject(this.resultBuffer)
          this.resultBuffer = ''
        } else if (this.resultBuffer.includes('>>>')) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          resolve(this.resultBuffer)
          this.resultBuffer = ''
        }
      }, wait)

      const timeouting = setTimeout(() => {
        clearInterval(waiting)
        reject(new Error('timeout: ' + command))
      }, timeout)
    })
  }

  async sendBreak (): Promise<void> {
    this.write('\x03')
    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 500)
    })
  }

  async sendEof (): Promise<void> {
    // if this is a dongle, disconnect and reconnect
    if (this.eofType === 'disconnect') {
      console.log('eof')
      this.write('\x04')
      await sleep(1500)
      console.log('disconnect')
      await this.disconnect()
      await sleep(1500)
      console.log('reconnect')
      await this.connect()
    } else if (this.eofType === 'restart') {
      this.write('\x04')
    }
    return await sleep(500)
  }

  // writeWaitFor

  // readWait
}
