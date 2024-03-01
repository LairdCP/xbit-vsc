import * as nodePath from 'path'
import * as vscode from 'vscode'
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'
import { DvkProbeInterfaces } from './hardware-probe-info.class'

let path = nodePath.posix
if (process.platform === 'win32') {
  path = nodePath.win32
}

const minPythonVersion = [3, 11, 4]
const maxPythonVersion = [3, 11, 17]

const minPipVersion = [22, 0]

export class PyocdInterface {
  context: vscode.ExtensionContext
  outputChannel: vscode.OutputChannel
  executable: undefined | null | string
  venv: string
  ready: boolean // if the this interface has been initialized
  configured: boolean // if the venv is configured
  listDevicesPromise: Promise<DvkProbeInterfaces[]> | null = null
  events: EventEmitter
  private muted = false

  constructor (context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    this.context = context
    this.outputChannel = outputChannel
    this.venv = ''
    this.ready = false
    this.configured = false
    this.events = new EventEmitter()
    this.outputChannel.show()
  }

  private async _listDevices (): Promise<DvkProbeInterfaces[]> {
    // ask pyocd for the list of devices
    try {
      const result = await this.runCommand('python', [this.context.asAbsolutePath('./pytools/query.py')])
      let probeResult: DvkProbeInterfaces[] = []
      try {
        probeResult = JSON.parse(result)
      } catch (error) {
        console.error(error)
      }
      return probeResult
    } catch (error) {
      // console.error(error)
      return []
    }
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
    if (!this.ready || !this.configured) {
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
        if (!this.muted) {
          this.outputChannel.appendLine(data.toString())
        }
        if (callback !== undefined) {
          callback(data.toString())
        }
      })
      child.stderr.on('data', (data: Buffer) => {
        error += data.toString()
        if (!this.muted) {
          this.outputChannel.appendLine(data.toString())
        }
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

  mute (): void {
    this.muted = true
  }

  unmute (): void {
    this.muted = false
  }

  async detectPython (silent = true): Promise<void> {
    let executable: string | null = await findPythonExecutable(this.outputChannel)
    let venv: string | null = null

    try {
      if (executable === '' && !silent) {
        void vscode.window.showWarningMessage('This extension requires python 3.11.6 or 3.11.7. Please install python.')
        throw new Error('No python executable found')
      } else {
        this.outputChannel.appendLine(`found pythonExecutable ${executable}`)
      }
      const updateFlag: boolean = await checkPythonVersion(this.outputChannel, executable)
      if (updateFlag && !silent) {
        void vscode.window.showWarningMessage('This extension requires python 3.11.6 or 3.11.7. Please update your python installation.')
        throw new Error('Python version out of date')
      } else {
        this.outputChannel.appendLine('python is up to date')
      }

      // make sure pip is installed
      const pipUpdateFlag: boolean = await checkPipVersion(this.outputChannel, executable)
      if (pipUpdateFlag && !silent) {
        this.outputChannel.appendLine('pip is out of date')
        void vscode.window.showWarningMessage(`This extension requires pip ${minPipVersion[0]}.0.0 or greater. Please update your python installation.`)
        throw new Error('Pip version out of date')
      } else {
        this.outputChannel.appendLine('pip is up to date')
      }

      venv = await getVenv()
      if (venv === null && !silent) {
        this.outputChannel.appendLine('no venv found')

        // if on linux, prompt to install python3-venv
        const selection = await vscode.window.showWarningMessage('This extension uses a python virtual enviroment to install dependencies. Please select a location for the venv.', 'Select', 'Cancel')
        if (selection === 'Select') {
          this.outputChannel.appendLine('initializing venv')
          const location = await selectVenv()
          venv = await initEnvWithProgress(location, this.outputChannel, executable)
        } else {
          throw new Error('No venv selected')
        }
      }
    } catch (error) {
      executable = null
    }

    try {
      // const pythonResult: detectPythonResult | null = await _detectPython(this.outputChannel, silent)
      if (executable === null || venv === null) {
        throw new Error('No python executable found')
      }
      this.executable = executable
      this.venv = venv

      let scripts = 'bin'
      if (process.platform === 'win32') {
        scripts = 'Scripts'
      }
      const pip = path.join(this.venv, scripts, 'pip')
      await installDepsWithProgress(this.outputChannel, this.context, pip)
      this.configured = true
    } catch (error) {
      if (error instanceof Error) {
        this.outputChannel.appendLine(`Python Environment Error: ${String(error.message)}`)
      } else {
        this.outputChannel.appendLine(`Python Environment Error: ${String(error)}`)
      }
    } finally {
      this.ready = true
    }
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
      const pythonConfig = vscode.workspace.getConfiguration('python')
      const executable: string | undefined = await pythonConfig.get('defaultInterpreterPath')
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
      if (version[0] < minPythonVersion[0] || version[1] < minPythonVersion[1] || version[2] < minPythonVersion[2] || version[0] > maxPythonVersion[0] || version[1] > maxPythonVersion[1] || version[2] > maxPythonVersion[2]) {
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

const checkPipVersion = async (OUTPUT_CHANNEL: vscode.OutputChannel, executable: string): Promise<boolean> => {
  return await new Promise((resolve, reject) => {
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
}

const getVenv = async (): Promise<string | null> => {
  const config = vscode.workspace.getConfiguration('xbit-vsc')
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

const initVenv = async (targetLocation: string, OUTPUT_CHANNEL: vscode.OutputChannel, executable: string): Promise<string> => {
  if (executable === '') {
    return await Promise.reject(new Error('No python executable found'))
  }
  const config = vscode.workspace.getConfiguration('xbit-vsc')

  return await new Promise((resolve, reject) => {
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
  })
}

const initEnvWithProgress = async (targetLocation: string, OUTPUT_CHANNEL: vscode.OutputChannel, executable: string): Promise<string> => {
  return await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Creating virtual environment',
    cancellable: false
  }, async (progress) => {
    progress.report({ message: 'Copying files...' })
    return await initVenv(targetLocation, OUTPUT_CHANNEL, executable)
  })
}

const installDeps = async (OUTPUT_CHANNEL: vscode.OutputChannel, context: vscode.ExtensionContext, pip: string): Promise<void> => {
  return await new Promise((resolve, reject) => {
    OUTPUT_CHANNEL.appendLine('installing dependencies')

    let errorString = ''
    const childProcess = spawn(pip, ['install', '-qq', '-r', context.asAbsolutePath('./requirements.in')])
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
      if (errorString.includes('ERROR') || errorString.includes('CRITICAL')) {
        reject(errorString)
      } else {
        OUTPUT_CHANNEL.appendLine('done')
        resolve()
      }
    })
  })
}

const installDepsWithProgress = async (OUTPUT_CHANNEL: vscode.OutputChannel, context: vscode.ExtensionContext, pip: string): Promise<void> => {
  return await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Pip',
    cancellable: false
  }, async (progress) => {
    progress.report({ message: 'Installing Dependencies...' })
    return await installDeps(OUTPUT_CHANNEL, context, pip)
  })
}
