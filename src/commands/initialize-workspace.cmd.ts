import * as vscode from 'vscode'
import * as nodePath from 'path'
import { copy, emptyDir } from 'fs-extra'
import ExtensionContextStore from '../stores/extension-context.store'

let path = nodePath.posix
if (process.platform === 'win32') {
  path = nodePath.win32
}

export async function InitializeWorkspaceCommand (e: any): Promise<null | Error> {
  console.log(e)
  const workspaceFolder = vscode.workspace.workspaceFolders?.find((workspaceFolder) => {
    return e.path?.startsWith(workspaceFolder.uri.path)
  })

  if (workspaceFolder === undefined) {
    return null
  }

  console.log('workspaceFolder', workspaceFolder.uri)

  // get the extension path: context.extensionUri.fsPath
  // get the project path: workspaceFolder.uri.path

  // update stubs folder
  const extensionFolder = ExtensionContextStore.context?.extensionUri.fsPath
  if (extensionFolder === undefined) {
    return null
  }

  // copy recursively files from extension/canvas-stubs to e.path/.vscode/xbit/canvas-stubs
  try {
    const stubsFolder = path.join(workspaceFolder.uri.path, '.vscode', 'xbit', 'canvas-stubs')
    await emptyDir(stubsFolder)
    await copy(path.join(extensionFolder, 'stubs'), stubsFolder)
  } catch (error) {
    ExtensionContextStore.error('Updating stubs failed', error)
  }

  const config = vscode.workspace.getConfiguration('python', workspaceFolder)

  try {
    await config.update('languageServer', 'Pylance')
    await config.update('analysis.typeCheckingMode', 'basic')

    await addToArray(config, 'analysis.typeshedPaths', '.vscode/xbit/canvas-stubs')
    await addToArray(config, 'analysis.extraPaths', '.vscode/xbit/canvas-stubs')
    ExtensionContextStore.inform('Workspace Initialized', true)
  } catch (error) {
    ExtensionContextStore.error('Error Initializing Project', error)
    ExtensionContextStore.initializePending = e
  }
  return null
}

// const addSettings = async function (vsc: string): Promise<void> {
//   const settingsFilePath = path.join(vsc, 'settings.json')
//   const stubsPath = path.join('.vscode', 'Xbit')
//   const defaultSettings = {
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "python.linting.enabled": true,
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "python.languageServer": "Pylance",
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "python.analysis.typeCheckingMode": "basic",
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "micropico.syncFolder": "",
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "micropico.openOnStart": true,
//   };

//   interface ISettings {
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "python.analysis.typeshedPaths": string[];
//     // eslint-disable-next-line @typescript-eslint/naming-convention
//     "python.analysis.extraPaths": string[];
//   }

//   let settings = ((await readJsonFile(settingsFilePath)) as ISettings) || {};
//   settings = _.defaults(settings, defaultSettings);

//   settings["python.analysis.typeshedPaths"] = _.union(
//     settings["python.analysis.typeshedPaths"] || [],
//     [stubsPath]
//   );
//   settings["python.analysis.extraPaths"] = _.union(
//     settings["python.analysis.extraPaths"] || [],
//     [join(stubsPath, "stubs")]
//   );

//   await writeJsonFile(settingsFilePath, settings);
// }

const addToArray = async function (config: vscode.WorkspaceConfiguration, key: string, value: string): Promise<void> {
  // set the typeshed paths
  let gotArray = config.get<string[]>(key)
  if (gotArray === null || gotArray === undefined) {
    gotArray = []
  }
  if (!gotArray.includes(value)) {
    gotArray.push(value)
  }
  await config.update(key, gotArray)
}
