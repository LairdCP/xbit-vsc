const { SerialPort } = require('serialport')
const EventEmitter = require('events')

// provides the interface to the serial port
// could be extended to support other types of devices connections
class UsbDeviceInterface extends EventEmitter {
//   // create a new UsbDevice
  constructor (options) {
    super()
    this.port = options.port
    this.baudRate = options.baudRate || 115200
    this._serialPort = null
    this.resultBuffer = ''
  }

  get connected () {
    return this._serialPort !== null
  }

  connect () {
    if (this._serialPort) {
      return Promise.resolve()
    }
    // if connected, return promise
    return new Promise((resolve, reject) => {
      this._serialPort = new SerialPort({
        path: this.port.path,
        baudRate: this.baudRate
      }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })

      this._serialPort.on('data', (data) => {
        this.resultBuffer += data.toString()
        this.emit('data', data)
      })
    })
  }

  disconnect () {
    try {
      if (this._serialPort && this._serialPort.port) {
        this._serialPort.close()
      }
      this._serialPort = null
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  // break

  // write
  write (data) {
    try {
      this._serialPort.write(data)
    } catch (error) {
      console.log('error', error)
    }
  }

  // writeWait
  writeWait (command, timeout = 1000, wait = 10) {
    return new Promise((resolve, reject) => {
      this.resultBuffer = ''
      this._serialPort.write(command)
      const waiting = setInterval(() => {
        // check for Error first as there will also be a >>> at the end
        if (this.resultBuffer.indexOf('Error') > -1) {
          clearInterval(waiting)
          clearTimeout(timeouting)

          this.resultBuffer = this.resultBuffer.replace(command, '')
          reject(this.resultBuffer)
          this.resultBuffer = ''
        } else if (this.resultBuffer.indexOf('>>>') > -1) {
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

  // writeWaitFor

  // readWait
}

module.exports = UsbDeviceInterface
