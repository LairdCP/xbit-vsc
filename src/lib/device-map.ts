import { ProbeInfo } from './hardware-probe-info.class'

const map = [{
  vendorId: 1027,
  productId: 24577,
  manufacturer: 'FTDI',
  product: 'BL654 US 1.0',
  'supports-repl': false,
  'eof-type': 'none',
  'supports-break': false,
  pyocd: false,
  description: 'Laird Dongle Running Laird SmartBASIC Firmware'
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
  map: any[]

  constructor () {
    this.map = map
  }

  find (options: ProbeInfo): any {
    return map.find((mapDef) => {
      return options.vendorId === mapDef.vendorId && options.productId === mapDef.productId
    })
  }
}
