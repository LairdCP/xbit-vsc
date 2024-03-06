/* global console setTimeout */

const { SerialPort } = require('serialport')
// const path = '/dev/cu.usbmodem3201'
// const path = '/dev/cu.usbserial-B400BQ71'
const path = '/dev/cu.usbmodem0004490077001'

const timeout = async (ms) => {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

const lsFunction = [
  'import os\r',
  'def ls(path:str):\r',
  '    for f in os.listdir(path):\r',
  '        full_name = path + f\r',
  '        s = os.stat(full_name)\r',
  '        print(full_name, s[0], s[5], ",")\r'
]

const serialPort = new SerialPort({
  path,
  baudRate: 115200,
  rtscts: true
}, async (error) => {
  if (error !== null) {
    console.error('serialPort on error', error)
  } else {
    console.log('serialPort on open')
    await timeout(1000)
    for (const i of lsFunction) {
      serialPort.write(i)
      await timeout(100)
    }
  }
})

let resultBuffer = ''
serialPort.on('data', (data) => {
  console.log('serialPort on data', data)
  // console.log('serialPort on string', data.toString())
  // TODO emit serialData event
  resultBuffer = resultBuffer + data.toString()
  if (/\r\n$/.test(this.resultBuffer)) {
    console.log('serialPort on line', resultBuffer)
    resultBuffer = ''
  }
})

serialPort.on('error', (error) => {
  console.log('serialPort on error', error)
})

serialPort.on('close', (error) => {
  console.log('serialPort on close', error)
})
