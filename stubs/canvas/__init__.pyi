class LEDStrip:
    RED_MASK: int
    GREEN_MASK: int
    BLUE_MASK: int

    COLOR_RED: int
    COLOR_GREEN: int
    COLOR_BLUE: int
    COLOR_YELLOW: int
    COLOR_MAGENTA: int
    COLOR_CYAN: int
    COLOR_WHITE: int
    COLOR_OFF: int

    def __init__(self, pin:str, num_leds:int) -> any:
        """
        Initialize the LED strip on a given device pin

        :param pin: The pin to use for the LED strip
        :param num_leds: The number of LEDs in the strip

        :return: The LED strip object
        """
        pass

    def __del__(self):
        """
        Deinitialize the LED strip
        """
        pass

    def set(self, index:int, color:int):
        """
        Set the color of an LED in a strip

        :param index: The index of the LED to set
        :param color: The color to set the LED to
        """
        pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
class Timer:
    """
    Timer Class

    Allows a callback to be run after a given period and
    exposes associated functionality
    """
    def __init__(self, interval_ms:int, repeats:bool, cb:any, data:any) -> any:
        pass
    def __del__(self):
        pass
    def start(self):
        pass
    def restart(self):
        pass
    def stop(self):
        pass
    def change_period(self, interval_ms:int):
        pass

def zcbor_from_obj(input: any, in_map:bool) -> bytes:
    """
    Convert an object (dictionary or list) to a CBOR byte string.

    :param input: The object to convert.
    :param in_map: True if the CBOR will already be wrapped inside of a map.
    :return: The CBOR byte string.
    """
    pass

def zcbor_to_obj(input: any) -> any:
    """
    Convert a CBOR byte string to an object (dictionary or list).

    :param input: The CBOR byte string.
    :return: The object.
    """
    pass

