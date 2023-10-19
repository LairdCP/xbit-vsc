import * as vscode from 'vscode'
import * as locale from './locale.json'

export function getLocale (): any {
  let lang = vscode.env.language
  let langLocale = null

  try {
    langLocale = require(`./locale.${lang}.json`)
  } catch (error) {
    lang = lang.split('.')[0]
  }

  try {
    langLocale = require(`./locale.${lang}.json`)
  } catch (error) {
    // console.log(error)
  }

  if (langLocale !== null) {
    return Object.assign(locale, langLocale)
  }
  return locale
}
