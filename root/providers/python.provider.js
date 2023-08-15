const vscode = require('vscode')

module.exports = async (OUTPUT_CHANNEL, resource = null) => {
  // create a python executable reference
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
