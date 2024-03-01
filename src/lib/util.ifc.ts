import * as vscode from 'vscode'

export interface TreeItemIconPath {
  light: vscode.Uri
  dark: vscode.Uri
}

export interface DeviceConfiguration {
  baudRate: number
  rtscts: boolean
  name: string
}

export interface DeviceConfigurations {
  [key: string]: DeviceConfiguration
}

export interface InFlightCommand {
  id: number
  expectedResponse: string
  message: DeviceCommand
  panelKey: string
  payload: string
  timestamp: number
}

// this is the interface for the message that is sent from the webview to the extension
// and vice versa
export interface DeviceCommand {
  method: string
  params: {
    command?: string | undefined
    [key: string]: string | number | boolean | object | undefined
  }
  id?: number
}

export interface DeviceCommandResponse {
  id?: number
  result: string
}

export interface pythonLsStatElement {
  type: string
  size: number
  path: string
}
