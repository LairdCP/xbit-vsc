import * as vscode from 'vscode'
import * as path from 'path'
import PanelsStore from '../stores/applets.store'
import { promises } from 'fs'
import { XbitAppletJson } from '../lib/xbit-applet-json.ifc'
const fs = promises

// any is a vscode.TreeItem of xbit-applet.json
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function RunApplet (element: any): Promise<null | Error> {
  try {
    // read the json manifest from element.path
    const jsonFile: Buffer = await fs.readFile(element.path)
    const jsonText: XbitAppletJson = JSON.parse(jsonFile.toString())
    // load the html file from element.path
    const htmlBuffer: Buffer = await fs.readFile(path.join(path.dirname(element.path), jsonText.main))
    const htmlText: string = htmlBuffer.toString()

    // create a new web view
    const panelKey = `xbitVsc.${String(jsonText.name)}`

    // if panelKey already exists in PanelStore, show it
    if (PanelsStore.has(panelKey)) {
      const panel = PanelsStore.get(panelKey)
      panel?.reveal()
      return await Promise.resolve(null)
    }

    const panel = vscode.window.createWebviewPanel(
      'xbitVsc',
      jsonText.name,
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    )
    PanelsStore.set(panelKey, panel)

    const appletPath = path.join(path.dirname(element.path))
    const onDiskAppletPath = vscode.Uri.parse(appletPath)
    const webviewAppletPath = panel.webview.asWebviewUri(onDiskAppletPath)

    const parsedHtml: string[] = []
    htmlText.split('\n').forEach((line: string) => {
      // add the base url to the html so that scripts in the applet can load files
      if (line.includes('</body>')) {
        parsedHtml.push(`<script>vsCodeWebViewBaseUrl = "${webviewAppletPath.toString()}"</script>`)
      }
      if (line.includes('src=')) {
        const src = line.split('src=')[1].split('"')[1]
        // convert to absolute path
        const absolutePath = path.join(path.dirname(element.path), src)
        // convert to vscode uri
        const onDiskPath = vscode.Uri.parse(absolutePath)
        const webviewPath = panel.webview.asWebviewUri(onDiskPath)

        parsedHtml.push(line.replace(src, webviewPath.toString()))
      } else if (line.includes('<link rel="stylesheet" href=')) {
        const src = line.split('href=')[1].split('"')[1]
        // convert to absolute path
        const absolutePath = path.join(path.dirname(element.path), src)
        // convert to vscode uri
        const onDiskPath = vscode.Uri.parse(absolutePath)
        const webviewPath = panel.webview.asWebviewUri(onDiskPath)

        parsedHtml.push(line.replace(src, webviewPath.toString()))
      } else {
        parsedHtml.push(line)
      }
    })
    panel.webview.html = parsedHtml.join('\n')
    return await Promise.resolve(null)
  } catch (error) {
    // console.error('error', error)
    return await Promise.reject(error)
  }
}
