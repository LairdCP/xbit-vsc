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
  rtscts: boolean
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
  writeWaitForTimeout: NodeJS.Timeout

  constructor (options: Options) {
    super()
    this.path = options.path
    this.baudRate = isNaN(options.baudRate) ? 115200 : options.baudRate
    this.rtscts = options.rtscts
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
    this.writeWaitForTimeout = undefined as unknown as NodeJS.Timeout
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
          // TODO emit serialData event
          if (this.awaiting !== null) {
            this.awaiting(data)
          } else {
            this.emit('data', data.toString())
          }
        })

        this.serialPort.on('error', (error: unknown) => {
          console.log('serialPort on error', error)
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

  // drain async
  async drain (): Promise<void> {
    return await new Promise((resolve, reject) => {
      if (this.serialPort !== null && 'port' in this.serialPort) {
        this.serialPort.drain((error) => {
          if (error !== null && error !== undefined) {
            reject(error)
          } else {
            resolve()
          }
        })
      }
    })
  }

  // write
  async write (data: string | Buffer): Promise<null | Error> {
    return await new Promise((resolve, reject) => {
      if (this.serialPort !== null && 'port' in this.serialPort) {
        this.serialPort.write(data, (error) => {
          if (error !== null && error !== undefined) {
            console.log('write error', error)
            reject(error)
          } else {
            resolve(null)
          }
        })
      }
    })
  }

  async flush (): Promise<void> {
    return await new Promise((resolve, reject) => {
      if (this.serialPort !== null) {
        this.serialPort.flush((error) => {
          if (error !== null && error !== undefined) {
            reject(error)
          } else {
            resolve()
          }
        })
      }
    })
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

  async writeWaitFor (command: string | Buffer, waitFor: string | number | Buffer, log = false): Promise<Buffer> {
    // TODO queue commands?
    if (this.awaiting !== null) {
      return await Promise.reject(new Error('writeWaitFor already writing'))
    }
    if (this.serialPort === null) {
      this.awaiting = null
      return await Promise.reject(new Error('writeWaitFor serialPort is null'))
    }

    let awaitBuffer = Buffer.from([])
    return await new Promise((resolve, reject) => {
      this.awaiting = (result) => {
        awaitBuffer = Buffer.concat([awaitBuffer, result])
        if (log) {
          console.log('writeWaitFor...awaitBuffer got', result.toString('utf-8'), waitFor, awaitBuffer[awaitBuffer.length - 1])
          console.log('awaitBuffer is', awaitBuffer.toString('hex'))
          console.log('writeWaitFor...awaitBuffer has', awaitBuffer.length)
        }

        if (typeof waitFor === 'number') {
          if (awaitBuffer[awaitBuffer.length - 1] === waitFor) {
            this.awaiting = null
            resolve(awaitBuffer.slice(0, awaitBuffer.indexOf(waitFor)))
          }
        } else if (awaitBuffer.lastIndexOf(waitFor) === awaitBuffer.length - waitFor.length) {
          this.awaiting = null
          resolve(awaitBuffer.slice(0, awaitBuffer.indexOf(waitFor)))
        } else if (awaitBuffer.includes('Traceback')) {
          this.awaiting = null
          reject(new Error('Traceback: ' + command.toString('hex')))
        }
      }

      this.write(command).then(async () => {
        return await this.drain()
      }).then(() => {
        // running command
      }).catch((error) => {
        this.awaiting = null
        reject(error)
      })
    })
  }

  async sendEnterRawMode (): Promise<void> {
    await this.writeWaitFor('\r\x01', Buffer.from('657869740d0a3e', 'hex'), true) // "exit\r\n>"
    this.rawMode = true
  }

  // send ctrl+d
  async sendExecuteRawMode (): Promise<Buffer> {
    try {
      const result = await this.writeWaitFor('\x04', 0x3e)
      const trimmedResult = result.slice(2, result.length - 3)
      return trimmedResult
    } catch (error) {
      console.log('sendExecuteRawMode error', error)
      return await Promise.reject(error)
    }
  }

  async sendExitRawMode (): Promise<string | Buffer | Error> {
    try {
      const p = await this.writeWaitFor('\x0D\x02', Buffer.from('0d0a3e3e3e20', 'hex')) // "\r\n>>> "
      this.rawMode = false
      return p
    } catch (error) {
      console.log('sendExitRawMode error', error)
      return await Promise.reject(error)
    }
  }

  async sendEnterRawPasteMode (): Promise<number> {
    const p: Promise<number> = new Promise((resolve, reject) => {
      this.awaiting = (data) => {
        if (data instanceof Buffer) {
          if (data[0] === 0x52) {
            // raw mode understood
            if (data[1] === 0x01) {
              // raw mode enabled
              this.rawPasteMode = true
              this.windowSize = data.readInt16LE(2)
              this.awaiting = null
              resolve(this.windowSize)
            } else if (data[1] === 0x00) {
              // raw mode disabled
              this.awaiting = null
              reject(new Error('raw mode disabled'))
            }
          }
        }
        this.awaiting = null
        return new Error('raw mode error')
      }
    })
    await this.write('\x05A\x01')
    await this.drain()
    return await p
  }

  async sendExitRawPasteMode (): Promise<string | Buffer | Error> {
    try {
      await this.writeWaitFor('\x04', 0x3e, true)
      this.rawPasteMode = false
      return await Promise.resolve('raw paste mode exited')
    } catch (error) {
      console.log('sendExitRawPasteMode caught error', error)
      return await Promise.reject(error)
    }
  }

  async writeRawPasteMode (commandBytes: Buffer): Promise<void> {
    if (!this.rawPasteMode) {
      throw new Error('not in raw paste mode')
    }
    if (this.windowSize === 0) {
      throw new Error('windowSize is 0')
    }
    let windowRemain = 0
    // Write out the commandBytes data.
    let i = 0
    // this function is called on every complete chunk of data received
    // from the serial port
    return await new Promise((resolve, reject) => {
      this.awaiting = (data) => {
        console.log('data', data.toString('hex'))
        if (data[0] === 0x01) {
          // Device indicated that a new window of data can be sent.
          windowRemain += this.windowSize
          // Send out as much data as possible that fits within the allowed window.
          const b = commandBytes.slice(i, Math.min(i + windowRemain, commandBytes.length))
          if (this.serialPort === null) {
            this.awaiting = null
            return reject(new Error('serialPort disconnected'))
          }
          this.write(b).catch((error) => {
            this.awaiting = null
            return reject(error)
          })
          windowRemain -= b.length
          i += b.length
          if (i === commandBytes.length) {
            this.awaiting = null
            resolve()
          }
        } else if (data[0] === 0x04) {
          // Device indicated that it has received all data.
          this.awaiting = null
          resolve()
        } else {
          // Unexpected data from device.
          this.awaiting = null
          return reject(new Error(`unexpected read during raw paste: ${data.toString()}`))
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
