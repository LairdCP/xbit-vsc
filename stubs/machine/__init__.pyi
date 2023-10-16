#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
class I2C:
    def __init__(self, device: any, address: int) -> any:
        """
        Initialize I2C object.

        :param device: Device identifier
        Zephyr - device identifier string
        Silicon Labs - (device identifier string, sda pin, scl pin)
        :param address: Device address
        """
        pass

    def __del__(self):
        """
        Delete I2C object.
        """
        pass

    def set_address(self, address: int):
        """
        Set device address
        """
        pass

    def read(self, length: int) -> any:
        """
        Read from I2C device.

        :param length: Number of bytes to read
        """
        pass

    def write_read(self, data: any, length: int) -> any:
        """
        Write-then-read I2C device.

        :param data: Buffer containing bytes to write
        :param length: Number of bytes to read
        """
        pass

    def write(self, data: any) -> int:
        """
        Write to I2C device.

        :param data: Buffer containing bytes to write
        """
        pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
# NOTE: This file is a stub for the purpose of type checking and code
# generation. It is not intended to be used at runtime. Constant values
# are set to 0 to avoid type checking errors, but runtime values may
# differ.

class Pin:
    """
    A pin object is used to control I/O pins (also known as GPIO -
    general-purpose input/output). Pin objects are commonly associated
    with a physical pin that can drive an output voltage and read input
    voltages. The pin class has methods to set the mode of the pin (IN,
    OUT, etc) and methods to get and set the digital logic level.

    :param port_pin: The ("port", pin#) or (gpio-dynamic label "GPIO3")
    :param mode: :py:data:`NO_CONNECT`, :py:data:`IN`, py:data:`OUT`
    :param pull: Optional; :py:data:`PULL_NONE`, :py:data:`PULL_UP`,
      :py:data:`PULL_DOWN` (default :py:data:`PULL_NONE`)
    """

    #: :meta hide-value:
    #: Pin is disconnected internally
    NO_CONNECT: int = 0
    #: :meta hide-value:
    #: Pin is an input
    IN: int = 0
    #: :meta hide-value:
    #: Pin is an output
    OUT: int = 0
    #: :meta hide-value:
    #: Pin is an output, set to high impedance
    OPEN_DRAIN: int = 0
    #: :meta hide-value:
    #: Pin is configured as an analog input
    ANALOG: int = 0
    #: :meta hide-value:
    #: Pin has no pull-up or pull-down resistor
    PULL_NONE: int = 0
    #: :meta hide-value:
    #: Pin has a pull-up resistor enabled
    PULL_UP: int = 0
    #: :meta hide-value:
    #: Pin has a pull-down resistor enabled
    PULL_DOWN: int = 0
    #: :meta hide-value:
    #: No events
    EVENT_NONE: int = 0
    #: :meta hide-value:
    #: Event on rising edge (0 -> 1 transition)
    EVENT_RISING: int = 0
    #: :meta hide-value:
    #: Event on falling edge (1 -> 0 transition)
    EVENT_FALLING: int = 0
    #: :meta hide-value:
    #: Event on rising or falling edge
    EVENT_BOTH: int = 0
    PY_ARG_UNUSED: int = 0

    def __init__(self, port_pin: any, mode: int, pull: int = PULL_NONE) -> any:
        pass

    def __del__(self):
        pass

    def reconfigure(self, port_pin: any, mode: int, pull: int = PULL_NONE):
        """
        Delete and re-initialize pin (potentially with a different configuration).

        :param port_pin: The ("port", pin#) or (gpio-dynamic label "GPIO3")
        :param mode: :py:data:`NO_CONNECT`, :py:data:`IN`, py:data:`OUT`
        :param pull: Optional; :py:data:`PULL_NONE`, :py:data:`PULL_UP`,
          :py:data:`PULL_DOWN` (default :py:data:`PULL_NONE`)
        """
        pass

    def on(self):
        """
        Set a pin to on ('1').
        """
        pass

    def off(self):
        """
        Set a pin to off ('0').
        """
        pass

    def high(self):
        """
        Set a pin to '1'.
        """
        pass

    def low(self):
        """
        Set a pin to '0'.
        """
        pass

    def toggle(self):
        """
        Toggle a pin's state.
        """
        pass

    def value(self) -> int:
        """
        Read an input pin. Negative on error.
        """
        pass

    def configure_event(self, callback: any, type: int):
        """
        Configure GPIO pin event (interrupt).

        :param callback: Function that is called when event occurs
        :param type: `Pin.EVENT_*` type
        """
        pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#

class SPI:
    MSB: int
    LSB: int
    CS_ACTIVE_HIGH: int
    CS_ACTIVE_LOW: int

    def __init__(self, device: any, pin: any) -> any:
        """
        Initialize SPI object.

        :param device: Device identifier or tuple (device id, clk name, COPI name, CIPO name)
        :param pin: None or Pin object or
        tuple (GPIO device name, pin number, CS_ACTIVE_HIGH or LOW) [Zephyr] or
        tuple (pin name, CS_ACTIVE_LOW) [LYRA]
        """
        pass

    def __del__(self):
        """
        Delete SPI object.
        """
        pass

    def configure(self, rate: int, polarity: int, phase: int, first_bit: int):
        """
        Change configuration from default (1M, 0, 0, MSB).

        param: rate: SCK rate in Hz
        param: polarity: Clock polarity (0 or 1)
        param: phase: Clock phase (0 or 1)
        param: first_bit: Bit to send first. SPI.MSB or SPI.LSB
        """
        pass

    def transceive(self, data: any) -> any:
        """
        Write data to device and return equal sized buffer.

        :param data: Bytes to write
        """
        pass

