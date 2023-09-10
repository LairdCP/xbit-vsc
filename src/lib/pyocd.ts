import * as path from 'path'
import * as vscode from 'vscode'
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'

const config = vscode.workspace.getConfiguration('xbit-vsc')

export class PyocdInterface {
  context: vscode.ExtensionContext
  outputChannel: vscode.OutputChannel
  executable: string
  venv: string
  ready: boolean
  listDevicesPromise: Promise<any> | null = null
  events: EventEmitter

  constructor (context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    this.context = context
    this.outputChannel = outputChannel
    this.executable = ''
    this.venv = ''
    this.ready = false
    this.events = new EventEmitter()

    findPythonExecutable(this.outputChannel).then((pythonExecutable: string) => {
      if (pythonExecutable !== '') {
        console.log('found pythonExecutable', pythonExecutable)
        this.executable = pythonExecutable
        // Pyocd(outputChannel, pythonExecutable[0]).then((pyocd) => {
        //   if (pyocd) {
        //     console.log('found pyocd', pyocd)
        //   }
        // })
        this.getVenv().then(() => {
          return null
        }).catch(() => {
          return vscode.window.showWarningMessage('This extension uses a python virtual enviroment to install dependencies. Please select a location for the venv.', 'Select', 'Cancel')
        }).then(async (selection) => {
          if (selection === 'Select') {
            return await this.initVenv()
          } else if (this.venv !== null) {
            return null
          } else {
            throw new Error('No venv selected')
          }
        }).then(async () => {
          // check for pyocd
          // catch
          return await this.installDeps()
        }).then(() => {
          this.ready = true
        }).catch((error) => {
          console.log('venv error', error)
        })
      } else {
        console.log('pythonExecutable not found')
        // show notifcation to install the python extension as recommended
        // does this happene automatically?
      }
    }).catch(() => {
      console.log('findPythonExecutable error')
    })
  }

  private async _listDevices (): Promise<any> {
    // ask pyocd for the list of devices
    return await this.runCommand('python', [this.context.asAbsolutePath('./src/server/probe.py')])
      .then((result: string) => {
        let probeResult = []
        try {
          probeResult = JSON.parse(result)
        } catch (error) {
          console.error(error)
        }
        return probeResult
      })
  }

  async listDevices (): Promise<any[]> {
    // there is initialization that takes n time to complete
    // this will block listing devices until it's ready
    if (!this.ready) {
      this.listDevicesPromise = new Promise((resolve, reject) => {
        const watcher = setInterval(() => {
          if (this.ready) {
            clearInterval(watcher)
            this._listDevices().then((devices) => {
              resolve(devices)
            }).catch((error) => {
              reject(error)
            })
          }
        }, 100)
      })
      return await this.listDevicesPromise
    }

    if (this.listDevicesPromise !== null) {
      return await this.listDevicesPromise
    }
    return await this._listDevices()
  }

  async installDeps (): Promise<string> {
    return await this.runCommand('pip', ['install', '-r', this.context.asAbsolutePath('./requirements.in')])
  }

  // runs a command in the venv
  // runCommand(context, OUTPUT_CHANNEL, venv, 'pyocd', ['list'])
  // eslint-disable-next-line @typescript-eslint/ban-types
  async runCommand (command: string, args: string[] = [], callback?: Function, errorCallback?: Function): Promise<string> {
    if (this.venv === '') {
      return await Promise.reject(new Error('No venv selected'))
    }

    if (command === undefined) {
      return await Promise.reject(new Error('No command specified'))
    }

    return await new Promise((resolve, reject) => {
      const pip = path.join(this.venv, 'bin', command)
      const child = spawn(pip, args)
      let error = ''
      let result = ''

      child.stdout.on('data', (data: Buffer) => {
        result += data.toString()
        this.outputChannel.appendLine(data.toString())
        if (callback !== undefined) {
          callback(data.toString())
        }
      })
      child.stderr.on('data', (data: Buffer) => {
        error += data.toString()
        this.outputChannel.appendLine(data.toString())
        if (errorCallback !== undefined) {
          errorCallback(data.toString())
        }
      })
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error))
        } else {
          return resolve(result)
        }
      })
    })
  }

  async initVenv (): Promise<string> {
    if (this.executable === '') {
      return await Promise.reject(new Error('No python executable found'))
    }
    return await new Promise((resolve, reject) => {
      this.selectVenv().then((targetLocation) => {
        let error = ''
        process.chdir(targetLocation)

        const child: ChildProcess = spawn(this.executable, ['-m', 'venv', './xbit.venv'])
        if (child === null || child.stdout === null || child.stderr === null) {
          return reject(new Error('Unable to spawn child process'))
        }
        child.stdout.on('data', (data: string) => {
          this.outputChannel.appendLine(data.toString())
        })

        child.stderr.on('data', (data: string) => {
          error += data
          this.outputChannel.appendLine(data.toString())
        })

        child.on('close', (code: number) => {
          if (code !== 0) {
            this.outputChannel.appendLine('pyocd error: ' + error)
            reject(new Error(error))
          } else {
            const venvFolder = path.join(targetLocation, 'xbit.venv')
            config.update('python-venv', venvFolder, vscode.ConfigurationTarget.Global).then(() => {
              resolve(venvFolder)
            }, (error) => {
              reject(error)
            })
          }
        })
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async getVenv (): Promise<string> {
    const pythonVenv: string | undefined = config.get('python-venv')
    if (pythonVenv === undefined) {
      throw new Error('python-venv not set')
    }
    const stat = await fs.stat(pythonVenv)
    if (stat.isDirectory()) {
      this.venv = pythonVenv
      return pythonVenv
    } else {
      throw new Error('python-venv is not a directory')
    }
  }

  // prompts the user to select a folder location and
  async selectVenv (): Promise<string> {
    const onFulfilled = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      title: 'Select Virtual Environment Location',
      openLabel: 'Select'
    })
    if (onFulfilled !== null && onFulfilled !== undefined && onFulfilled.length > 0) {
      return onFulfilled[0].fsPath
    } else {
      throw new Error('No folder selected')
    }
  }
}

// creates the venv in that location

// module.exports = {
//   // detect if pyocd is installed
//   Pyocd: (OUTPUT_CHANNEL, executable) => {
//     const commands = {
//       exec: (command) => {
//         return new Promise((resolve, reject) => {
//           let response = ''
//           let error = ''
//           const child = spawn(executable, command)
//           child.stdout.on('data', (data) => {
//             response += data.toString()
//             OUTPUT_CHANNEL.appendLine(data.toString())
//           })

//           child.stderr.on('data', (data) => {
//             error += data
//             OUTPUT_CHANNEL.appendLine(data.toString())
//           })

//           child.on('close', (code) => {
//             if (code !== 0) {
//               OUTPUT_CHANNEL.appendLine('pyocd error: ' + error)
//               reject(new Error(error))
//             } else {
//               resolve(response)
//             }
//           })
//         })
//       }
//     }

//     return new Promise((resolve, reject) => {
//       // check if pyocd is installed
//       const child = spawn('pip', ['show', 'pyocd'])
//       let pyocdInstalled = false
//       let allData = ''

//       child.stdout.on('data', (data) => {
//         allData += data.toString()
//         if (allData.includes('Name: pyocd')) {
//           pyocdInstalled = true
//         }
//       })
//       child.stderr.on('data', (data) => {
//         console.error('show pyocd: ' + data.toString())
//       })

//       child.on('close', (code) => {
//         if (pyocdInstalled) {
//           const dict = {}
//           allData.split('\n').forEach((line) => {
//             const [key, value] = line.split(': ')
//             dict[key] = value
//           })
//           OUTPUT_CHANNEL.appendLine('pyocd version: ' + dict.Version)
//           resolve(commands)
//         } else {
//           // install it?
//           reject(new Error('pyocd not installed'))
//         }
//       })
//     })
//   }
// }

const findPythonExecutable = async (OUTPUT_CHANNEL: vscode.OutputChannel, resource = null): Promise<string> => {
  // find a python executable reference
  try {
    const extension = vscode.extensions.getExtension('ms-python.python')
    if (extension === undefined) {
      OUTPUT_CHANNEL.appendLine(
        'Unable to get python executable from vscode-python. ms-python.python extension not found.'
      )
      return ''
    }

    let usingNewInterpreterStorage = false
    try {
      usingNewInterpreterStorage = extension.packageJSON.featureFlags.usingNewInterpreterStorage
    } catch (error) {
      // ignore
    }

    if (usingNewInterpreterStorage) {
      if (!extension.isActive) {
        try {
          await extension.activate()
        } finally {
          // loaded
        }
      }
      const execCommand: string[] | string = extension.exports.settings.getExecutionDetails(resource).execCommand
      // OUTPUT_CHANNEL.appendLine('vscode-python execCommand: ' + execCommand.join(' '))
      if (execCommand === null || execCommand.length === 0) {
        OUTPUT_CHANNEL.appendLine('vscode-python did not return proper execution details.')
        return ''
      }
      if (execCommand instanceof Array) {
        if (execCommand.length === 0) {
          return ''
        }
        return execCommand[0]
      }
      return execCommand
    } else {
      const config = vscode.workspace.getConfiguration('python')
      const executable: string | undefined = await config.get('defaultInterpreterPath')
      if (executable === undefined) {
        return ''
      }
      return executable
    }
  } catch (error) {
    OUTPUT_CHANNEL.appendLine(
      'Error when querying about python executable path from vscode-python.'
    )
    return ''
  }
}
