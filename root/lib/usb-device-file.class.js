const path = require('path')
const vscode = require('vscode')

class UsbDeviceFile extends vscode.TreeItem {
  constructor (
    uri,
    type,
    size,
    command
  ) {
    const label = uri.path.split('/').pop()
    super(label, vscode.TreeItemCollapsibleState.None)
    this.uri = uri
    this.size = size
    this.type = type
    this.command = command
  }

  // full fs path
  get dir () {
    return path.dirname(this.uri.path)
  }

  // file system provider.readFile will figure this out
  get devPath () {
    return this.uri.path.replace(this.parentDevice.uri.path, '')
  }

  get name () {
    return this.uri.path.split('/').pop()
  }

  get tooltip () {
    return this.uri.path
  }

  get contextValue () {
    return this.type === 'file' ? 'usbDeviceFile' : 'usbDeviceFolder'
  }

  get iconPath () {
    return {
      light: path.join(__filename, '../../..', 'resources', 'light', 'gen-file.svg'),
      dark: path.join(__filename, '../../..', 'resources', 'dark', 'gen-file.svg')
    }
  }

  // given a filePath, read the file from the device in 64 byte chunks
  readFileFromDevice () {
    const rate = 128
    let resultData = ''

    return new Promise((resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Loading ${this.path}`,
        cancellable: true
      }, (progress, token) => {
        let cancelled = false
        token.onCancellationRequested(() => {
          cancelled = true
        })

        let data = ''
        const read = async () => {
          let result
          try {
            result = await this.parentDevice.ifc.writeWait(`hex(f.read(${rate}))\r`, 1000)
            // console.log('read result', result)
          } catch (error) {
            console.log('error', error)
            return Promise.reject(error)
          }

          // loop until returned bytes is less than 64
          const chunk = Buffer.from(result.slice(result.indexOf("'") + 1, result.lastIndexOf("'")), 'hex').toString('hex')
          data += chunk
          const increment = Math.round((chunk.length / this.size * 2) * 100)
          progress.report({ increment, message: 'Loading File...' })

          if (chunk.length === rate * 2) {
            return read()
          } else if (cancelled) {
            return Promise.reject(new Error('cancelled'))
          } else {
            return Promise.resolve(data)
          }
        }

        // open file
        return this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'rb')\r`, 1000)
          .then(() => {
            return read()
          })
          .then((result) => {
            resultData = result
            // close file
            return this.parentDevice.ifc.writeWait('f.close()\r', 1000)
          })
          .then(() => {
            resolve(resultData)
          }).catch((error) => {
            console.timeEnd('readFileFromDevice')
            return reject(error)
          })
      })
    })
  }

  writeFileToDevice (data) {
    let offset = 0
    const write = async () => {
      try {
        const bytesToWrite = Buffer.from(data, 'ascii').toString('hex').slice(offset, offset + 50).match(/[\s\S]{2}/g) || []
        await this.parentDevice.ifc.writeWait(`f.write(b'\\x${bytesToWrite.join('\\x')}')\r`)
      } catch (error) {
        console.log('error', error)
        return Promise.reject(error)
      }
      offset += 50
      if (offset < data.length * 2) {
        return write()
      } else {
        return Promise.resolve()
      }
    }

    return this.parentDevice.ifc.writeWait(`f = open('${this.devPath}', 'wb')\r`, 1000)
      .then((result) => {
        if (result.indexOf('>>>') === -1) {
          return Promise.reject(result)
        }
        // start writing chunks
        return write()
          .then(() => {
            // console.log('write result', result)
            return this.parentDevice.ifc.writeWait('f.close()\r', 1000)
          })
      })
  }
}

module.exports = UsbDeviceFile
