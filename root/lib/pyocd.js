const vscode = require('vscode')
const { spawn } = require('child_process')

module.exports = {
  // detect if pyocd is installed
  Pyocd: (OUTPUT_CHANNEL, executable) => {
    const commands = {
      exec: (command) => {
        return new Promise((resolve, reject) => {
          let response = ''
          let error = ''
          const child = spawn(executable, command)
          child.stdout.on('data', (data) => {
            response += data.toString()
            OUTPUT_CHANNEL.appendLine(data.toString())
          })

          child.stderr.on('data', (data) => {
            error += data
            OUTPUT_CHANNEL.appendLine(data.toString())
          })

          child.on('close', (code) => {
            if (code !== 0) {
              OUTPUT_CHANNEL.appendLine('pyocd error: ' + error)
              reject(new Error(error))
            } else {
              resolve(response)
            }
          })
        })
      }
    }

    return new Promise((resolve, reject) => {
      // check if pyocd is installed
      const child = spawn('pip', ['show', 'pyocd'])
      let pyocdInstalled = false
      let allData = ''

      child.stdout.on('data', (data) => {
        allData += data.toString()
        if (allData.includes('Name: pyocd')) {
          pyocdInstalled = true
        }
      })
      child.stderr.on('data', (data) => {
        console.error('show pyocd: ' + data.toString())
      })

      child.on('close', (code) => {
        if (pyocdInstalled) {
          const dict = {}
          allData.split('\n').forEach((line) => {
            const [key, value] = line.split(': ')
            dict[key] = value
          })
          OUTPUT_CHANNEL.appendLine('pyocd version: ' + dict.Version)
          resolve(commands)
        } else {
          // install it?
          reject(new Error('pyocd not installed'))
        }
      })
    })
  },
  // find python executable
  // to use with pyocd
  PythonExecutable: async (OUTPUT_CHANNEL, resource = null) => {
    // find a python executable reference
    try {
      const extension = vscode.extensions.getExtension('ms-python.python')
      if (!extension) {
        OUTPUT_CHANNEL.appendLine(
          'Unable to get python executable from vscode-python. ms-python.python extension not found.'
        )
        return undefined
      }

      let usingNewInterpreterStorage = false
      try {
        usingNewInterpreterStorage = extension.packageJSON.featureFlags.usingNewInterpreterStorage
      } catch (error) {

      }

      if (usingNewInterpreterStorage) {
        if (!extension.isActive) {
          try {
            await extension.activate()
          } finally {
            // loaded
          }
        }
        const execCommand = extension.exports.settings.getExecutionDetails(resource).execCommand
        OUTPUT_CHANNEL.appendLine('vscode-python execCommand: ' + execCommand)
        if (!execCommand) {
          OUTPUT_CHANNEL.appendLine('vscode-python did not return proper execution details.')
          return undefined
        }
        if (execCommand instanceof Array) {
          if (execCommand.length === 0) {
            return undefined
          }
          return execCommand
        }
        return [execCommand]
      } else {
        const config = vscode.workspace.getConfiguration('python')
        const executable = await config.get('defaultInterpreterPath')
        if (!executable) {
          return undefined
        }
        return [executable]
      }
    } catch (error) {
      OUTPUT_CHANNEL.appendLine(
        'Error when querying about python executable path from vscode-python.'
      )
      return undefined
    }
  }
}
