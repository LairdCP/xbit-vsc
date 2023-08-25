const vscode = require('vscode')
const { spawn } = require('child_process')
const config = vscode.workspace.getConfiguration('xbit-vsc')
const path = require('path')
const fs = require('fs/promises')

class PyocdInterface {
  constructor (context, OUTPUT_CHANNEL) {
    this.context = context
    this.outputChannel = OUTPUT_CHANNEL
    this.executable = null
    this.venv = null

    return findPythonExecutable().then((pythonExecutable) => {
      if (pythonExecutable) {
        console.log('found pythonExecutable', pythonExecutable[0])
        this.executable = pythonExecutable[0]
        // Pyocd(outputChannel, pythonExecutable[0]).then((pyocd) => {
        //   if (pyocd) {
        //     console.log('found pyocd', pyocd)
        //   }
        // })
        this.getVenv().then(() => {
          return null
        }).catch(() => {
          return vscode.window.showWarningMessage('This extension uses a python virtual enviroment to install dependencies. Please select a location for the venv.', 'Select', 'Cancel')
        }).then((selection) => {
          if (selection === 'Select') {
            return this.initVenv(this.outputChannel, pythonExecutable[0])
          } else if (this.venv) {
            return null
          } else {
            throw new Error('No venv selected')
          }
        }).then(() => {
          // check for pyocd
          // catch
          return this.installDeps()
        }).catch((error) => {
          console.log('venv error', error)
        })
      } else {
        console.log('pythonExecutable not found')
        // show notifcation to install the python extension as recommended
        // does this happene automatically?
      }
    })
  }

  installDeps () {
    return this.runCommand('pip', ['install', '-r', this.context.asAbsolutePath('./requirements.in')])
  }

  // runs a command in the venv
  // runCommand(context, OUTPUT_CHANNEL, venv, 'pyocd', ['list'])
  runCommand (command, args = []) {
    if (!this.venv) {
      return Promise.reject(new Error('No venv selected'))
    }

    if (!command) {
      return Promise.reject(new Error('No command specified'))
    }

    return new Promise((resolve, reject) => {
      const pip = path.join(this.venv, 'bin', command)
      const child = spawn(pip, args)
      let error = ''

      child.stdout.on('data', (data) => {
        this.outputChannel.appendLine(data.toString())
      })
      child.stderr.on('data', (data) => {
        error += data
        this.outputChannel.appendLine(data.toString())
      })
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error))
        } else {
          return resolve()
        }
      })
    })
  }

  initVenv () {
    return new Promise((resolve, reject) => {
      this.selectVenv(this.OUTPUT_CHANNEL).then((targetLocation) => {
        let error = ''
        process.chdir(targetLocation)

        console.log('InitVenv', process.cwd())
        const child = spawn(this.executable, ['-m', 'venv', './xbit.venv'])
        child.stdout.on('data', (data) => {
          this.outputChannel.appendLine(data.toString())
        })

        child.stderr.on('data', (data) => {
          error += data
          this.outputChannel.appendLine(data.toString())
        })

        child.on('close', (code) => {
          if (code !== 0) {
            this.OUTPUT_CHANNEL.appendLine('pyocd error: ' + error)
            reject(new Error(error))
          } else {
            const venvFolder = path.join(targetLocation, 'xbit.venv')
            config.update('python-venv', venvFolder, vscode.ConfigurationTarget.Global).then(() => {
              resolve(venvFolder)
            })
          }
        })
      })
    })
  }

  getVenv () {
    const pythonVenv = config.get('python-venv')
    return fs.stat(pythonVenv)
      .then((stat) => {
        if (stat.isDirectory()) {
          this.venv = pythonVenv
          return pythonVenv
        } else {
          throw new Error('python-venv is not a directory')
        }
      })
  }

  // prompts the user to select a folder location and
  async selectVenv () {
    const onFulfilled = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      title: 'Select Virtual Environment Location',
      openLabel: 'Select'
    })
    if (onFulfilled && onFulfilled.length > 0) {
      return onFulfilled[0].fsPath
    } else {
      throw new Error('No folder selected')
    }
  }
}

module.exports = PyocdInterface

// creates the venv in that location

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
  }
}

const findPythonExecutable = async (OUTPUT_CHANNEL, resource = null) => {
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
