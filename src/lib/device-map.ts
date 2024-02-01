import { ProbeInfo } from './hardware-probe-info.class'

interface DeviceMapEntry {
  vendorId: number
  productId?: number
  manufacturer: string
  product: string
  'supports-repl': boolean
  'eof-type': string
  'supports-break': boolean
  pyocd: boolean
  description: string
}

const map = [{
  vendorId: 1027,
  // productId: 24577,
  manufacturer: 'FTDI',
  product: 'Generic FTDI Device',
  'supports-repl': true,
  'eof-type': 'restart',
  'supports-break': true,
  pyocd: false,
  description: 'Laird Dongle Running Laird SmartBASIC Firmware or Generic FTDI Device'
}, {
  vendorId: 6421,
  productId: 21023,
  manufacturer: 'Nordic Semiconductor',
  product: 'nRF52840 USB Adapter',
  'supports-repl': false,
  'eof-type': 'disconnect',
  'supports-break': false,
  pyocd: false,
  description: 'Stock Dongle'
}, {
  vendorId: 12259,
  productId: 4,
  manufacturer: 'ZEPHYR',
  product: 'BL654 USB Adapter',
  'supports-repl': true,
  'eof-type': 'disconnect',
  'supports-break': true,
  pyocd: false,
  description: 'Dongle Running Laird Micro-Python Firmware'
}, {
  vendorId: 11914,
  productId: 12,
  manufacturer: 'Laird Connectivity',
  product: 'Sera NX040 DVK',
  'supports-repl': true,
  'eof-type': 'restart',
  'supports-break': true,
  pyocd: true,
  description: 'Sera NX040 DVK Running Laird Micro-Python Firmware'
}]

export class DeviceMap {
  map: DeviceMapEntry[]

  constructor () {
    this.map = map
  }

  find (options: ProbeInfo): DeviceMapEntry | undefined {
    return map.find((mapDef) => {
      if (mapDef.productId === undefined) {
        return options.vendorId === mapDef.vendorId
      } else {
        return options.vendorId === mapDef.vendorId && options.productId === mapDef.productId
      }
    })
  }
}
