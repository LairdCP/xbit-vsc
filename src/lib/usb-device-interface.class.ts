import { SerialPort } from 'serialport'
import * as EventEmitter from 'events'
import { sleep } from '../util'
import ExtensionContextStore from '../stores/extension-context.store'

interface Options {
  path: string
  baudRate: number
  rtscts: boolean
  eofType: string
  supportsBreak: boolean
  supportsRepl: boolean
}
// provides the interface to the serial port for the usb device
// could be extended to support other types of devices connections
export class UsbDeviceInterface extends EventEmitter {
  private serialPort: null | SerialPort
  baudRate: number
  path: string
  eofType: string
  supportsBreak: boolean
  supportsRepl: boolean
  rawMode: boolean
  rawPasteMode: boolean
  restarting: boolean
  connected: boolean
  awaiting: null | ((data: Buffer) => void)
  windowSize: number

  constructor (options: Options) {
    super()
    console.log(options)
    this.path = options.path
    this.baudRate = isNaN(options.baudRate) ? 115200 : options.baudRate
    this.serialPort = null
    this.eofType = options.eofType
    this.supportsBreak = options.supportsBreak
    this.supportsRepl = options.supportsRepl
    this.rawMode = false
    this.rawPasteMode = false
    this.restarting = false
    this.connected = false
    this.awaiting = null
    this.windowSize = 0
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
          baudRate: this.baudRate,
          rtscts: this.rtscts
        }, (error) => {
          if (error !== null) {
            reject(error)
          } else {
            this.connected = true
            resolve()
          }
        })

        this.serialPort.on('data', (data: Buffer) => {
          // console.log('data', data)
          // TODO emit serialData event
          this.emit('data', data.toString())
          if (this.awaiting !== null) {
            this.awaiting(data)
          }
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
    if (this.rawPasteMode) {
      await this.sendExitRawPasteMode()
    }
    if (this.rawMode) {
      await this.sendExitRawMode()
    }
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
        responseBuffer = responseBuffer.replace(command, '')

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

  async writeWaitFor (command: string | Buffer, waitFor: string | number | Buffer, timeout = 1000, delay = 50): Promise<Buffer> {
    // TODO queue commands?
    if (this.awaiting !== null) {
      return await Promise.reject(new Error('already writing'))
    }
    let awaitBuffer = Buffer.from([])
    this.serialPort?.flush()
    return await new Promise((resolve, reject) => {
      this.awaiting = (result) => {
        console.log('awaitBuffer got', result.toString('hex'))
        awaitBuffer = Buffer.concat([awaitBuffer, result])
        if (awaitBuffer.includes(waitFor)) {
          this.awaiting = null
          resolve(awaitBuffer.slice(0, awaitBuffer.indexOf(waitFor)))
        }
      }
      if (timeout !== 0) {
        setTimeout(() => {
          this.awaiting = null
          reject(new Error('timeout: ' + command.toString()))
        }, timeout)
      }
      setTimeout(() => {
        if (this.serialPort === null) {
          this.awaiting = null
          return reject(new Error('serialPort is null'))
        }
        this.serialPort.write(command)
      }, delay)
    })
  }

  // send ctrl+a
  // async sendEnterRawMode (): Promise<void> {
  //   await this.write('\x01')
  //   this.rawMode = true
  //   return await sleep(50)
  // }
  async sendEnterRawMode (): Promise<string | Buffer | Error> {
    const p = await this.writeWaitFor('\r\x01', 'raw REPL; CTRL-B to exit\r\n>', 1000, 50)
    this.rawMode = true
    return p
  }

  // send ctrl+d
  async sendExecuteRawMode (): Promise<Buffer> {
    const result = await this.writeWaitFor('\x04', '>')
    console.log('result', result)
    const trimmedResult = result.slice(2, result.length - 3)
    console.log('trimmedResult', trimmedResult.toString())
    return trimmedResult
  }

  // send ctrl+b
  // async sendExitRawMode (): Promise<void> {
  //   await this.write('\x02')
  //   this.rawMode = false
  //   return await sleep(50)
  // }
  async sendExitRawMode (): Promise<string | Buffer | Error> {
    const p = await this.writeWaitFor('\x0D\x02', 'MicroPython', 1000, 50)
    this.rawMode = false
    return p
  }

  async sendEnterRawPasteMode (): Promise<number | Error> {
    const result = await this.writeWaitFor('\x05A\x01', 0x52, 1000, 50)
    this.rawPasteMode = true
    if (result instanceof Buffer) {
      if (result[0] === 0x52) {
        // raw mode understood
        if (result[1] === 0x01) {
          // raw mode enabled
          this.windowSize = result.readInt16LE(2)
          console.log('raw mode enabled', this.windowSize)
          return await Promise.resolve(this.windowSize)
        } else if (result[1] === 0x00) {
          // raw mode disabled
          return await Promise.reject(new Error('raw mode disabled'))
        }
      }
    }
    return new Error('raw mode error')
  }

  async sendExitRawPasteMode (): Promise<string | Buffer | Error> {
    const p = await this.writeWaitFor('\x04', '>', 1000, 50)
    this.rawPasteMode = false
    return p
  }

  async writeRawPasteMode (commandBytes: Buffer): Promise<void> {
    if (!this.rawPasteMode) {
      throw new Error('not in raw paste mode')
    }
    if (this.windowSize === 0) {
      throw new Error('windowSize is 0')
    }
    let windowRemain = this.windowSize
    // Write out the commandBytes data.
    let i = 0
    // this function is called on every complete chunk of data received
    // from the serial port
    return await new Promise((resolve, reject) => {
      this.awaiting = (data) => {
        // await sleep(50)
        // console.log('awaiting', data)
        if (data[0] === 0x01) {
          // Device indicated that a new window of data can be sent.
          windowRemain += this.windowSize
          // Send out as much data as possible that fits within the allowed window.
          const b = commandBytes.slice(i, Math.min(i + windowRemain, commandBytes.length))
          // console.log('b', b.length, b)
          if (this.serialPort === null) {
            return reject(new Error('serialPort disconnected'))
          }
          this.serialPort.write(b)
          windowRemain -= b.length
          i += b.length
          if (i === commandBytes.length) {
            resolve()
          }
        } else if (data[0] === 0x04) {
          resolve()
        } else {
          // Unexpected data from device.
          throw new Error(`unexpected read during raw paste: ${data.toString()}`)
        }
      }
      this.awaiting(Buffer.from([0x01]))
    })
  }

  async sendBreak (): Promise<void> {
    await this.write('\x03')
    return await sleep(50)
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
        await sleep(500)
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
      await this.writeWait('\x04', {
        waitFor: 'MicroPython v'
      })
      return await sleep(50)
    } else {
      return await Promise.reject(new Error('Unknown eofType'))
    }
  }

  async reset (): Promise<void> {
    return await this.sendEof()
  }
}
