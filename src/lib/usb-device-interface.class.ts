import { SerialPort } from 'serialport'
import * as EventEmitter from 'events'

interface Options {
  path: string
  baudRate: number
}
// provides the interface to the serial port for the usb device
// could be extended to support other types of devices connections
export class UsbDeviceInterface extends EventEmitter {
  private serialPort: null | SerialPort
  baudRate: number
  path: string
  resultBuffer: string

  constructor (options: Options) {
    super()
    this.path = options.path
    this.baudRate = isNaN(options.baudRate) ? options.baudRate : 115200
    this.serialPort = null
    this.resultBuffer = ''
  }

  get connected (): boolean {
    return this.serialPort !== null
  }

  async connect (): Promise<void> {
    if (this.serialPort !== null) {
      return await Promise.resolve()
    }
    // if connected, return promise
    try {
      this.serialPort = new SerialPort({
        path: this.path,
        baudRate: this.baudRate
      })

      this.serialPort.on('data', (data: Buffer) => {
        this.resultBuffer += data.toString()
        this.emit('data', data)
      })
    } catch (error) {
      return await Promise.reject(error)
    }
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

  sendBreak (): void {
    this.write('\x03')
  }

  sendEof (): void {
    this.write('\x04')
  }

  // writeWaitFor

  // readWait
}
