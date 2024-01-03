import { SerialPort } from 'serialport'
import * as EventEmitter from 'events'
import { sleep } from '../util'
import ExtensionContextStore from '../stores/extension-context.store'

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
  eofType: string
  supportsBreak: boolean
  rawMode: boolean
  restarting: boolean
  connected: boolean

  constructor (options: Options) {
    super()
    console.log(options)
    this.path = options.path
    this.baudRate = isNaN(options.baudRate) ? 115200 : options.baudRate
    this.serialPort = null
    this.eofType = options.eofType
    this.supportsBreak = options.supportsBreak
    this.rawMode = false
    this.restarting = false
    this.connected = false
  }

  // get connected (): boolean {
  //   return this.serialPort !== null
  // }

  async connect (): Promise<void> {
    if (this.connected) {
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
            this.connected = true
            resolve()
          }
        })

        this.serialPort.on('data', (data: Buffer) => {
          // TODO emit serialData event
          this.emit('data', data.toString())
        })

        this.serialPort.on('error', (error: unknown) => {
          this.emit('error', error)
        })

        this.serialPort.on('close', (error: unknown) => {
          this.connected = false
          this.emit('close', error)
        })
      } catch (error: unknown) {
        reject(error)
      }
    })
  }

  async disconnect (): Promise<void> {
    return await new Promise((resolve, reject) => {
      if (this.serialPort !== null && 'port' in this.serialPort) {
        this.serialPort.close((error) => {
          if (error instanceof Error && !error.message.includes('Port is not open')) {
            reject(error)
          } else {
            this.serialPort = null
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }

  // break

  // write
  async write (data: string): Promise<null | Error> {
    if (this.serialPort !== null && 'port' in this.serialPort) {
      this.serialPort.write(data)
      return await Promise.resolve(null)
    } else {
      return await Promise.reject(new Error('serialPort is null'))
    }
  }

  // writeWait
  async writeWait (command: string, options: any = {}): Promise<string> {
    const timeout = options.timeout === undefined ? 5000 : options.timeout
    const waitFor = options.waitFor === undefined ? '>>>' : options.waitFor
    const jsonResponse = options.jsonResponse === true
    let id = 0
    let responseBuffer = ''

    return await new Promise((resolve, reject) => {
      const resolver = (data: string): void => {
        responseBuffer += data.replace(command, '')

        if (responseBuffer.includes('Error')) {
          reject(responseBuffer)
        } else if (this.rawMode && responseBuffer.includes('>')) {
          resolve(responseBuffer)
        } else if (responseBuffer.includes(waitFor)) {
          resolve(responseBuffer)
        } else {
          return
        }
        clearTimeout(timeouting)
        this.removeListener('data', resolver)
      }

      if (jsonResponse) {
        try {
          id = JSON.parse(command.replace(/"/g, '\\"').replace(/(?<!\\)'/g, '"')).i
          command = command + '\r'
        } catch (error) {
          if (error instanceof Error) {
            ExtensionContextStore.log(error.message)
          }
        }
        this.once(`jsonData${id}`, (jsonLine) => {
          clearTimeout(timeouting)
          resolve(jsonLine)
        })
      } else {
        this.on('data', resolver)
      }

      this.write(command).catch((error) => {
        clearTimeout(timeouting)
        reject(error)
      })

      const timeouting = setTimeout(() => {
        reject(new Error('timeout: ' + command))
      }, timeout)
    })
  }

  // send ctrl+a
  async sendEnterRawMode (): Promise<void> {
    await this.write('\x01')
    this.rawMode = true
    return await sleep(100)
  }

  // send ctrl+d
  async sendExecuteRawMode (): Promise<string> {
    const result = await this.writeWait('\x04')
    await sleep(50)
    return result
  }

  // send ctrl+b
  async sendExitRawMode (): Promise<void> {
    await this.write('\x02')
    this.rawMode = false
    return await sleep(100)
  }

  async sendBreak (): Promise<void> {
    await this.write('\x03')
    return await sleep(500)
  }

  async sendEof (): Promise<void> {
    let tryCount = 10
    // if this is a dongle, disconnect and reconnect
    if (this.eofType === 'disconnect') {
      this.restarting = true
      await this.write('\x04')
      await this.disconnect()
      while (!this.connected) {
        tryCount--
        await sleep(1000)
        try {
          await this.connect()
        } catch (error) {
          console.log('reconnect error', error)
        }
        if (tryCount === 0) {
          this.restarting = false
          this.emit('close')
          break
        }
      }
    } else if (this.eofType === 'restart') {
      await this.write('\x04')
      return await sleep(500)
    }
  }

  async reset (): Promise<void> {
    return await this.sendEof()
  }
}
