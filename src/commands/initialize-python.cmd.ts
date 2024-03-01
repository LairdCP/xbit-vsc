import ExtensionContextStore from '../stores/extension-context.store'

export async function InitializePythonCommand (silent = false): Promise<null | Error> {
  if (ExtensionContextStore === undefined) {
    return new Error('No workspace folders found')
  }

  if (ExtensionContextStore.pyocdInterface === undefined) {
    return new Error('No pyocd interface found')
  }

  try {
    await ExtensionContextStore.pyocdInterface.detectPython(false)
    return null
  } catch (error) {
    if (!silent) {
      if (error instanceof Error) {
        return error
      } else {
        return new Error('Unknown error')
      }
    } else {
      return null
    }
  }
}
