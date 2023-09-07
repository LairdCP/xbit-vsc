// this is spat out of the pyocd probe command
/*
{
  "device": "/dev/cu.usbmodem2102",
  "name": "cu.usbmodem2102",
  "description": "DVK Probe CMSIS-DAP",
  "hwid": "USB VID:PID=2E8A:000C SER=E6620CD64F273B37 LOCATION=2-1",
  "vid": 11914,
  "pid": 12,
  "serial_number": "E6620CD64F273B37",
  "location": "2-1",
  "manufacturer": "Laird Connectivity",
  "product": "DVK Probe CMSIS-DAP",
  "interface": null
}
*/
export interface DvkProbeInterface {
  location: string
  manufacturer: string
  device: string
  pid: number
  vid: number
  serial_number: string

  name: string
  description: string
  hwid: string
  product: string
  interface: number | null
}

// this is spat out of the Serial.list() function
/*
{
  "locationId": "02100000",
  "manufacturer": "Laird Connectivity",
  "path": "/dev/tty.usbmodem2102",
  "pnpId": undefined,
  "productId": "000c",
  "serialNumber": "E6620CD64F273B37",
  "vendorId": "2e8a"
}
*/
export interface PortInfo extends DvkProbeInterface {
  locationId: string
  manufacturer: string
  path: string
  pnpId: string | undefined
  productId: string
  serialNumber: string
  vendorId: string
}

// unified interface for the probe info
// from either the serial port list or the dvk probe script
export class ProbeInfo {
  options: PortInfo
  serialNumber = ''
  locationId = ''
  manufacturer = ''
  path: string
  productId = 0
  vendorId = 0
  name = ''

  constructor (options: PortInfo) {
    this.options = options

    // set the serial number
    if (this.options.serial_number !== undefined) {
      this.serialNumber = this.options.serial_number
    } else if (this.options.serialNumber !== undefined) {
      this.serialNumber = this.options.serialNumber
    }

    if (this.options.locationId !== undefined) {
      this.locationId = this.options.locationId
    } else if (this.options.location !== undefined) {
      this.locationId = this.options.location
    }

    this.manufacturer = this.options.manufacturer
    if (this.options.productId !== undefined) {
      this.productId = parseInt(this.options.productId, 16)
    } else if (this.options.pid !== undefined) {
      this.productId = this.options.pid
    }

    if (this.options.vendorId !== undefined) {
      this.vendorId = parseInt(this.options.vendorId, 16)
    } else if (this.options.vid !== undefined) {
      this.vendorId = this.options.vid
    }

    if (this.options.device !== undefined) {
      this.path = this.options.device
    } else if (this.options.path !== undefined) {
      this.path = this.options.path
    } else {
      throw new Error('path is undefined')
    }

    if (this.options.name === undefined || this.options.name === '') {
      this.name = this.path
    } else {
      this.name = this.options.name
    }

    this.name = this.name.replace(/\/(dev|cu)\//, '')
  }
}
