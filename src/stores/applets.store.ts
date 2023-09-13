import { UsbDevice } from '../lib/usb-device.class'

class AppletsStore {
  private readonly _panels: Map<string, any>
  private readonly _links: Map<string, UsbDevice[]>

  constructor () {
    this._panels = new Map()
    this._links = new Map()
  }

  set (panelKey: string, panel: any): void {
    this._panels.set(panelKey, panel)

    panel.webview.onDidReceiveMessage(async (message: any) => {
      this.handleMessage(panelKey, message)
    })
  }

  has (key: string): boolean {
    return this._panels.has(key)
  }

  get (key: string): any {
    return this._panels.get(key)
  }

  list (): string[] {
    return Array.from(this._panels.keys())
  }

  handleMessage (panelKey: string, message: any): void {
    console.log('handle message', panelKey, message)
    let payload = ''
    if (message.method === 'write') {
      payload = message.params.command
    } else {
      return
    }
    if (this._links.has(panelKey)) {
      const link = this._links.get(panelKey)
      if (link !== undefined) {
        link.forEach((usbDevice: UsbDevice) => {
          usbDevice.ifc.write(payload)
        })
      }
    }
  }

  link (panelKey: string, usbDevice: UsbDevice): void {
    if (this._links.has(panelKey)) {
      const link = this._links.get(panelKey)
      if (link !== undefined) {
        link.push(usbDevice)
      }
    } else {
      this._links.set(panelKey, [usbDevice])
    }
    // register data handler function that is called whenever
    // this device emits serial data
    //
    usbDevice.dataHandler(panelKey, (data: any) => {
      console.log('dataHandler called', panelKey, data)
      if (this._panels.has(panelKey)) {
        const panel = this._panels.get(panelKey)
        if (panel !== undefined) {
          panel.webview.postMessage({ message: data.toString() })
        }
      }
    })
    console.log('link', panelKey, usbDevice)
  }

  unlink (panelKey: string, usbDevice: UsbDevice): void {
    if (this._links.has(panelKey)) {
      const link = this._links.get(panelKey)
      if (link !== undefined) {
        const index = link.indexOf(usbDevice)
        if (index > -1) {
          link.splice(index, 1)
        }
        // remove the data handler function
        usbDevice.removeDataHandler(panelKey)
      }
    }
    console.log('unlink', panelKey, usbDevice)
  }
}

export default new AppletsStore()
