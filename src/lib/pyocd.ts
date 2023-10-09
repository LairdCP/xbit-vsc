import * as path from 'path'
import * as vscode from 'vscode'
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'
import { DvkProbeInterfaces } from './hardware-probe-info.class'

const minPythonVersion = [3, 10]
const minPipVersion = [22, 0]

export class PyocdInterface {
  context: vscode.ExtensionContext
  outputChannel: vscode.OutputChannel
  executable: undefined | null | string
  venv: string
  ready: boolean
  listDevicesPromise: Promise<DvkProbeInterfaces[]> | null = null
  events: EventEmitter

  constructor (context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    this.context = context
    this.outputChannel = outputChannel
    this.venv = ''
    this.ready = false
    this.events = new EventEmitter()
    this.outputChannel.show()

    detectPython(this.outputChannel).then(async (pythonResult: detectPythonResult | null) => {
      if (pythonResult === null) {
        throw new Error('No python executable found')
      }
      this.executable = pythonResult.executable
      this.venv = pythonResult.venv
      // check for pyocd
      // catch
      // display wait ?
      let scripts = 'bin'
      if (process.platform === 'win32') {
        scripts = 'Scripts'
      }
      const pip = path.join(this.venv, scripts, 'pip')
      return await installDeps(this.outputChannel, this.context, pip)
    }).then(() => {
      this.ready = true
    }).catch((error) => {
      this.outputChannel.appendLine(`Python Environment Error: ${String(error.message)}`)
    })
  }

  private async _listDevices (): Promise<DvkProbeInterfaces[]> {
    // ask pyocd for the list of devices
    return await this.runCommand('python', [this.context.asAbsolutePath('./pytools/probe.py')])
      .then((result: string) => {
        let probeResult: DvkProbeInterfaces[] = []
        try {
          probeResult = JSON.parse(result)
        } catch (error) {
          console.error(error)
        }
        return probeResult
      })
  }

  async listDevices (): Promise<DvkProbeInterfaces[]> {
    // there is initialization that takes n time to complete
    // this will block listing devices until it's ready
    if (!this.ready) {
      this.listDevicesPromise = new Promise((resolve, reject) => {
        const watcher = setInterval(() => {
          if (this.ready) {
            clearInterval(watcher)
            this.listDevicesPromise = null
            this._listDevices().then((devices: DvkProbeInterfaces[]) => {
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

  // runs a command in the venv
  // runCommand(context, OUTPUT_CHANNEL, venv, 'pyocd', ['list'])
  // eslint-disable-next-line @typescript-eslint/ban-types
  async runCommand (command: string, args: string[] = [], callback?: Function, errorCallback?: Function): Promise<string> {
    if (!this.ready) {
      return await Promise.reject(new Error('No Python Environment Available'))
    }

    if (command === undefined) {
      return await Promise.reject(new Error('No command specified'))
    }

    let scripts = 'bin'
    if (process.platform === 'win32') {
      scripts = 'Scripts'
    }

    return await new Promise((resolve, reject) => {
      this.outputChannel.appendLine(`running command ${path.join(this.venv, scripts, command)} ${args.join(' ')}`)
      const pip = path.join(this.venv, scripts, command)
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
}

// creates the venv in that location
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

const checkPythonVersion = async (OUTPUT_CHANNEL: vscode.OutputChannel, pythonExecutable = ''): Promise<boolean> => {
  return await new Promise((resolve, reject) => {
    // if python executable is < 3.10, prompt to install python 3.10
    let updateFlag = false
    let errorString = ''
    const childProcess = spawn(pythonExecutable, ['--version'])
    childProcess.stdout.on('data', (out) => {
      console.log(out.toString())
      const version = out.toString().split(' ')[1].split('.')
      if (version[0] < minPythonVersion[0] || version[1] < minPythonVersion[1]) {
        // error, need update
        updateFlag = true
      }
    })
    childProcess.stderr.on('data', (data: Buffer) => {
      errorString += data.toString()
    })

    childProcess.on('close', (code: any) => {
      console.log('python version check', code, updateFlag)
      if (errorString !== '') {
        reject(errorString)
      } else {
        resolve(updateFlag)
      }
    })
  })
}

const getVenv = async (): Promise<string | null> => {
  const pythonVenv: string | undefined = config.get('python-venv')
  if (pythonVenv === undefined) {
    return null
  }
  try {
    const stat = await fs.stat(pythonVenv)
    if (stat.isDirectory()) {
      return pythonVenv
    }
  } catch (error) {
    // ignore
  }
  return null
}

// prompts the user to select a folder location and
const selectVenv = async (): Promise<string> => {
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

const initVenv = async (OUTPUT_CHANNEL: vscode.OutputChannel, executable: string): Promise<string> => {
  if (executable === '') {
    return await Promise.reject(new Error('No python executable found'))
  }
  return await new Promise((resolve, reject) => {
    selectVenv().then((targetLocation) => {
      let error = ''
      process.chdir(targetLocation)
      OUTPUT_CHANNEL.appendLine(`spawn ${executable} -m venv ./xbit.venv`)

      const child: ChildProcess = spawn(executable, ['-m', 'venv', './xbit.venv'])
      if (child === null || child.stdout === null || child.stderr === null) {
        return reject(new Error('Unable to spawn child process'))
      }
      child.stdout.on('data', (data: string) => {
        OUTPUT_CHANNEL.appendLine(data.toString())
      })

      child.stderr.on('data', (data: string) => {
        error += data
        OUTPUT_CHANNEL.appendLine(data.toString())
      })

      child.on('close', (code: number) => {
        if (code !== 0) {
          OUTPUT_CHANNEL.appendLine('pyocd error: ' + error)
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

const installDeps = async (OUTPUT_CHANNEL: vscode.OutputChannel, context: vscode.ExtensionContext, pip: string): Promise<void> => {
  const metaString: string = (await fs.readFile(context.asAbsolutePath('./package.json'))).toString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metaJson: any = JSON.parse(metaString)
  const lastInstalledVersion: string | undefined = config.get('requirements-version')

  if (lastInstalledVersion === undefined || lastInstalledVersion !== metaJson.version) {
    return await new Promise((resolve, reject) => {
      OUTPUT_CHANNEL.appendLine('installing dependencies')

      let errorString = ''
      const childProcess = spawn(pip, ['install', '-r', context.asAbsolutePath('./requirements.in')])
      childProcess.stdout.on('data', (out) => {
        console.log(out.toString())
      })

      childProcess.stderr.on('data', (data: Buffer) => {
        // stderr includes [notice] messages which aren't errors
        if (!data.toString().includes('[notice]')) {
          errorString += data.toString()
        }
      })

      childProcess.on('close', () => {
        if (errorString !== '') {
          reject(errorString)
        } else {
          void config.update('requirements-version', metaJson.version, vscode.ConfigurationTarget.Global)
          resolve()
        }
      })
    })
  } else {
    return await Promise.resolve()
  }
}

const config = vscode.workspace.getConfiguration('xbit-vsc')

interface detectPythonResult {
  executable: string
  venv: string
}

const detectPython = async (OUTPUT_CHANNEL: vscode.OutputChannel): Promise<null | detectPythonResult> => {
  const executable: string = await findPythonExecutable(OUTPUT_CHANNEL)
  if (executable === '') {
    void vscode.window.showWarningMessage('This extension requires python 3.10.0 or greater. Please install python.')
    return null
  } else {
    OUTPUT_CHANNEL.appendLine(`found pythonExecutable ${executable}`)
  }
  const updateFlag: boolean = await checkPythonVersion(OUTPUT_CHANNEL, executable)
  if (updateFlag) {
    void vscode.window.showWarningMessage('This extension requires python 3.10.0 or greater. Please update your python installation.')
    return null
  } else {
    OUTPUT_CHANNEL.appendLine('python is up to date')
  }

  // make sure pip is installed
  const pip = await new Promise((resolve, reject) => {
    let errorString = ''
    let updateFlag = false
    const childProcess = spawn(executable, ['-m', 'pip', '--version'])
    childProcess.stdout.on('data', (out) => {
      console.log(out.toString())
      const version = out.toString().split(' ')[1].split('.')
      if (version[0] < minPipVersion[0]) {
        // error, need update
        updateFlag = true
      }
    })

    childProcess.stderr.on('data', (data: Buffer) => {
      errorString += data.toString()
    })

    childProcess.on('close', () => {
      if (errorString !== '') {
        reject(errorString)
      } else {
        resolve(updateFlag)
      }
    })
  })

  if (pip === true) {
    OUTPUT_CHANNEL.appendLine('pip is out of date')
    void vscode.window.showWarningMessage(`This extension requires pip ${minPipVersion[0]}.0.0 or greater. Please update your python installation.`)
    return null
  } else {
    OUTPUT_CHANNEL.appendLine('pip is up to date')
  }

  let venv = await getVenv()
  if (venv === null) {
    OUTPUT_CHANNEL.appendLine('no venv found')
    void config.delete('requirements-version')

    const selection = await vscode.window.showWarningMessage('This extension uses a python virtual enviroment to install dependencies. Please select a location for the venv.', 'Select', 'Cancel')
    if (selection === 'Select') {
      OUTPUT_CHANNEL.appendLine('initializing venv')
      venv = await initVenv(OUTPUT_CHANNEL, executable)
    } else {
      return null
    }
  }
  return { executable, venv }
}
