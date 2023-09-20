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
      // 1. from webview, panelKey = A, message = { method: 'foo', params: 'bar' }
      this.handleMessage(panelKey, message)
    })

    panel.onDidDispose(() => {
      this._panels.delete(panelKey)
      if (this._links.has(panelKey)) {
        const link = this._links.get(panelKey)
        if (link !== undefined) {
          link.forEach((usbDevice: UsbDevice) => {
            usbDevice.removeDataHandler(panelKey)
          })
        }
        this._links.delete(panelKey)
      }
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
    // 2. if panelKey is linked to device(s)...
    if (this._links.has(panelKey)) {
      const link = this._links.get(panelKey)
      if (link !== undefined) {
        // for each linked device...
        link.forEach((usbDevice: UsbDevice) => {
          // send the message to the device
          // panelKey = A, message = { method: 'foo', params: 'bar' }
          usbDevice.commandHandler(panelKey, message)
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
    usbDevice.dataHandler(panelKey, (message: any) => {
      // 6. from device, panelKey = A, data = { result: 'bar', id: 12345}
      if (this._panels.has(panelKey)) {
        const panel = this._panels.get(panelKey)
        if (panel !== undefined) {
          panel.webview.postMessage(message)
        }
      }
    })
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
  }
}

export default new AppletsStore()
