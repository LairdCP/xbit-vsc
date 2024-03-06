import * as vscode from 'vscode'
import * as nodePath from 'path'
import { copy, emptyDir } from 'fs-extra'
import ExtensionContextStore from '../stores/extension-context.store'

export async function InitializeWorkspaceCommand (e: any): Promise<null | Error> {
  let path = nodePath.posix
  if (process.platform === 'win32') {
    path = nodePath.win32
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.find((workspaceFolder) => {
    return e.path?.startsWith(workspaceFolder.uri.path)
  })

  if (workspaceFolder === undefined) {
    return null
  }

  // get the extension path: context.extensionUri.fsPath
  // get the project path: workspaceFolder.uri.path

  // update stubs folder
  const extensionFolder = ExtensionContextStore.context?.extensionUri.fsPath
  if (extensionFolder === undefined) {
    return null
  }

  // copy recursively files from extension/canvas-stubs to e.path/.vscode/xbit/canvas-stubs
  try {
    const tempPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'xbit')
    if (process.platform === 'win32' && tempPath.startsWith('\\')) {
      tempPath.replace('\\', '')
    }
    const stubsFolder = path.join(workspaceFolder.uri.fsPath, '.vscode', 'xbit', 'canvas-stubs')

    await emptyDir(stubsFolder)
    await copy(path.join(extensionFolder, 'stubs'), stubsFolder)
  } catch (error) {
    ExtensionContextStore.error('Updating stubs failed', error)
  }

  const config = vscode.workspace.getConfiguration('python', workspaceFolder)

  try {
    await config.update('languageServer', 'Pylance', ExtensionContextStore.configurationTarget)
    await config.update('analysis.typeCheckingMode', 'basic', ExtensionContextStore.configurationTarget)
    await config.update('analysis.stubPath', '.vscode/xbit/canvas-stubs', ExtensionContextStore.configurationTarget)
    await addToArray(config, 'analysis.typeshedPaths', '.vscode/xbit/canvas-stubs')
    await addToArray(config, 'analysis.extraPaths', '.vscode/xbit/canvas-stubs')
    ExtensionContextStore.inform('Workspace Initialized', true)
  } catch (error) {
    ExtensionContextStore.error('Error Initializing Project', error)
    ExtensionContextStore.initializePending = e
  }
  return null
}

const addToArray = async function (config: vscode.WorkspaceConfiguration, key: string, value: string): Promise<void> {
  // set the typeshed paths
  let gotArray = config.get<string[]>(key)
  if (gotArray === null || gotArray === undefined) {
    gotArray = []
  }
  if (!gotArray.includes(value)) {
    gotArray.push(value)
  }
  await config.update(key, gotArray, ExtensionContextStore.configurationTarget)
}
