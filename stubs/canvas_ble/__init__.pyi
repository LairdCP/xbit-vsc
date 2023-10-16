#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
class Advertiser:
    """
    The Advertiser class provides for two buffers that can be populated
    by the application: an advertising buffer and a scan response buffer.
    The application cannot inspect or modify in-place either of these
    buffers. Instead, methods are provided to clear the buffer and to
    add data to the buffer. When advertising is started with :meth:`start`
    or updated with :meth:`update`, the current contents of the buffer is
    copied into the BLE stack to be used. Until either :meth:`start` or
    :meth:`update` are called, the application can clear/update the
    buffers at will without any consequence.

    Data in the buffers needs to be in the BLE LTV (length, tag, value)
    format. The methods :meth:`add_ltv` and :meth:`add_tag_string` will
    assist with this by adding the length and tag fields. Additional care
    needs to be taken with the :meth:`add_data` method to ensure that the
    data is in the proper format.

    Only one instance of the Advertiser class should ever be created.
    Multiple advertising sets is not currently implemented.
    """
    def __init__(self) -> any:
        pass

    def __del__(self):
        pass

    def clear_buffer(self, scan:bool):
        """
        Clears a buffer

        :param scan (bool): Buffer to clear. False to clear advertising
           buffer or True to clear scan response buffer
        """
        pass

    def add_data(self, data:any, scan:bool):
        """
        Add data to a buffer. This function adds raw data bytes into the
        selected buffer. The application must ensure that the buffer
        contents contain proper BLE TLVs.

        :param data (bytes): Bytes to add to the buffer
        :param scan (bool): Buffer to which to add. False to add to
          advertising buffer or True to add to scan response buffer.
        """
        pass

    def add_ltv(self, tag:int, data:any, scan:bool):
        """
        Add a byte-based LTV to a buffer.

        :param tag (int): Tag is a one-byte value defined by the BLE
            specification
        :param data (bytes): Data to add to the buffer
        :param scan (bool): Buffer to which to add. False to add to
            advertising buffer or True to add to scan response buffer.
        """
        pass

    def add_tag_string(self, tag:int, string:str, scan:bool):
        """
        Add a string-based LTV to a buffer.

        :param tag (int): Tag is a one-byte value defined by the BLE
            specification
        :param string (str): String to add to the buffer
        :param scan (bool): Buffer to which to add. False to add to
            advertising buffer or True to add to scan response buffer.
        """
        pass

    def add_smp_uuid(self, scan:bool):
        """
        Add the SMP UUID to a buffer. This is a convenience function
        that adds the SMP UUID to the buffer. The SMP UUID is a 128-bit
        value defined by the BLE specification.

        :param scan (bool): Buffer to which to add. False to add to
            advertising buffer or True to add to scan response buffer.
        """
        pass

    def add_canvas_data(self, config_version:int, network_id:int, scan:bool):
        """
        Add Canvas-specific data to a buffer. This is a convenience function
        that adds the Canvas-specific data to the buffer. The Canvas-specific
        data helps to identify the device as a Canvas device that a common
        set of tools can use.

        :param config_version (int): Configuration version of the device. This
            is a 8-bit value that is incremented each time the configuration
            is changed.
        :param network_id (int): Network ID of the device
        :param scan (bool): Buffer to which to add. False to add to
            advertising buffer or True to add to scan response buffer.
        """
        pass

    def validate_data(self) -> bool:
        """
        Perform a validation test on the advertising and scan buffers.

        :returns: True if the buffers contain valid LTVs or False if there
            is an error in either buffer.
        """
        pass

    def set_interval(self, min:int, max:int):
        """
        Set the advertising interval range to be used by the BLE stack. Many
        stacks require a range of values here to allow for some flexibility
        in the scheduling of advertisement packets. The min and max values are
        specified in milliseconds and cannot be the same.

        :param min (int): Minimum advertising interval in milliseconds
        :param max (int): Maximum advertising interval in milliseconds
        """
        pass

    def set_phys(self, primary:int, secondary:int):
        """
        Set the PHYs that will be used for advertising. Values for PHYs should
        be taken from the canvas_ble.PHY_* constants.

        :param primary (int): Primary PHY to use for advertising
        :param secondary (int): Secondary PHY to use for advertising
        """
        pass

    def set_properties(self, connectable:bool, scannable:bool, extended:bool):
        """
        Set the advertisement properties.

        :param connectable (bool): True if the advertisement should be connectable
        :param scannable (bool): True if the advertisement should be scannable
        :param extended (bool): True if extended advertising should be used
        """
        pass

    def set_directed(self, directed:bool, mac:any):
        """
        Set the directed advertisement flag and the MAC address of the
        target device.

        :param directed (bool): True if the advertisement should be directed
        :param mac (bytes): MAC address of the target device. This is a required
            parameter if directed is True. If directed is False, then this
            parameter must be None.
        """
        pass

    def set_channel_mask(self, mask:any):
        """
        Set the channel mask to be used for advertising. The mask is a
        37-bit value with each bit corresponding to a channel. A value of
        1 indicates that the channel will be used. A value of 0 indicates
        that the channel will not be used.

        :param mask (bytes): Channel mask to use for advertising. Should be 5
            bytes in length. The first byte is the LSB of the mask (channel 0).
        """
        pass

    def start(self):
        """
        Start advertising. The advertising buffer is copied into the BLE
        stack and the advertising is started. The application can continue
        to update the advertising buffer and call update() to change the
        advertising data.
        """
        pass

    def stop(self):
        """
        Stop advertising.
        """
        pass

    def update(self):
        """
        Update the advertising data. The advertising buffer is copied into
        the BLE stack and the advertising continues.
        """
        pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#

# PHY constants
PHY_1M: int
PHY_CODED: int
PHY_2M: int
PHY_125K: int
PHY_500K: int

# Advertisement LTV types
AD_TYPE_FLAGS: int
AD_TYPE_UUID16_INCOMPLETE: int
AD_TYPE_UUID16_COMPLETE: int
AD_TYPE_UUID32_INCOMPLETE: int
AD_TYPE_UUID32_COMPLETE: int
AD_TYPE_UUID128_INCOMPLETE: int
AD_TYPE_UUID128_COMPLETE: int
AD_TYPE_NAME_SHORT: int
AD_TYPE_NAME_COMPLETE: int
AD_TYPE_MANU_SPECIFIC: int

# Initialize the BLE stack
def init():
    pass

# Convert a BLE address to a printable string
#
# addr: BLE address (bytes)
#
# Returns a string representation of the address
def addr_to_str(addr: any) -> str:
    pass

# Convert a 'fancy' BLE address string to a usable BLE address
#
# addr_str: BLE address string
#
# Returns a binary representation of the address
def str_to_addr(addr_str:str) -> any:
    pass

# Get the BLE address of the local device
#
# Returns a BLE address (bytes)
def my_addr() -> any:
    pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
class Connection:
    """
    The Connection class provides handling of connections to other BLE devices.
    Connections can be in either Central or Peripheral roles.

    When in a Peripheral role the set_periph_callbacks function is used to
    set up callbacks for connection and disconnection.
    The Connection object is passed into this callback so it can be saved by
    the script for later use.

    When in a Central role the connect function is used to initiate a connection.
    This function takes individual callback definitions for when this connection
    is fully connected and for when it is fully disconnected.

    """
    def __init__(self) -> any:
        pass

    def __del__(self):
        """
        Called when an object is deleted.
        Will raise an exception if the object contains a valid connection.
        Use disconnect before explicitly deleting the connection object.
        """
        pass

    def disconnect(self):
        """
        Disconnect the connection
        """
        pass

    def get_addr(self) -> any:
        """
        Return the address of the connected device for this connection

        :returns: The address of the connected device as a bytes array
        """
        pass

    def get_rssi(self) -> int:
        """
        Return the RSSI of the connection

        :returns: The RSSI of the connection
        """
        pass

def set_periph_callbacks(con: any, discon: any):
    """
    Set the callbacks to be used when the device is operating in a Peripheral
    role.

    :param con (any): A callback used when a connection is made
    :param discon (any): A callback used when a disconnection is made
    """
    pass

def connect(addr: any, phy: int, cb_con: any, cb_discon: any) -> Connection:
    """
    Initiate a connection when in a Central role.

    :param addr (any): A byte array containing the BLE address to connect to. Canvas_ble.str_to_addr
                        can be used to create this from an apropriate string.
    :param phy (int): The PHY to use see :PI_HAPI_BLE_COMMON_PHY_T:
    :param cb_con (any): A callback used when a connection is made
    :param cb_discon (any): A callback used when a disconnection is made

    :returns: The connection object
    """
    pass
#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#

GATT_CLIENT_CCCD_STATE_DISABLE:int
GATT_CLIENT_CCCD_STATE_NOTIFY:int
GATT_CLIENT_CCCD_STATE_INDICATE:int
GATT_CLIENT_CCCD_STATE_BOTH:int

class GattClient:
    """
    The GattClient class allows a Central device to discover and interact
    with the GattServer (see :class GattServer:) on a connected peripheral
    device

    All functions use __errCode to return a standard error code.
    """

    def __init__(self, connection:Connection) -> any:
        pass

    def __del__(self):
        pass

    def discover(self):
        """
        Before interaction with a GATTServer, the GATT database must be
        discovered. This discovery creates and populates an internal
        database of GATT services, characteristics and descriptors.

        Initially GATT items are identified by a UUID however it is
        possible to associate this UUID with a more descriptive name
        once the database has been populated.
        """
        pass

    def get_dict(self) -> any:
        """
        Returns a dictionary describing the discovered gatt database

        :returns: a dictionary describing the discovered gatt database
        """
        pass

    def set_callbacks(self, notify: any, indicate: any):
        """
        Callbacks can be set for any notifications or indications the
        GATT Server might make.
        The callback will pass an event object containing the
        following parameters:
        .connection -   The connection object of the connection that
                        caused the event.
        .UUID       -   The UUID of the characteristic that this
                        event is associated with.
        .name       -   If a name has been set then is also passed
                        to the callback.
        .data       -   The data attatched to the event. This is
                        passed as 'bytes'.

        :param notify (any): A callback to be called when a
            notification is recieved from the connected server.

        :param indicate (any): A callback to be called when an
            indication is recieved from the connected server.
        """
        pass

    def set_name(self, uuid: str, name: str):
        """
        Once a GATT database has been discovered a more descriptive
        name can be given to the services, characteristics and
        descriptors stored in it.
        This allows use of the _name versions of functionality which
        makes your application script easier to understand.

        :param uuid (str): A string representation of a UUID present
            in the GATT database.

        :param name (str): A unique, within the GATT database, string
            that can be used to refer to GATT object instead of
            its UUID.
        """
        pass

    def read(self, identifier:str) -> any:
        """
        Read the value of a characteristic identified by the given
        UUID.

        :param identifier (str): A string representation of an
            identifier present within the GATT database that is
            to be read. If this identifier is not present in the GATT
            database or is not of a readable type an error will occurr.

        :returns: bytes containing the data read.
        """
        pass

    def write(self, identifier:str, data: any):
        """
        Write a value to a characteristic identified by the given
        identifier.

        :param identifier (str): A string representation of a identifier
            present within the GATT database that is to be written.
            If this identifier is not present in the GATT database or is
            not of a writable type an error will occurr.

        :param data (any): bytes containing the data to be written
        """
        pass

    def enable(self, identifier:str, enable:int):
        """
        Enable or disable) a CCCD with the given identifier.
        A CCCD enables or disables a notification or indication

        :param uuid (str):A string representation of an identifier
            present within the GATT database that is to be set.
            If this identifier is not present in the GATT database or is
            not for a CCCD an error with occurr.

        :param enable (int): A value of True will enable the CCCD
            and a value of False will disable the CCCD
        """
        pass

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#

"""
GATT Server Event Constants

The GATT server can cause the stack to raise a number of different events
for each characteristic.
These events can be intercepted by use of a callback see
:meth build_from_dict:
As only a single callback is available for each event the following
constants are used to indicate the specific event that caused the callback
to be triggered.
"""
GATT_SERVER_EVENT_ATTR_VALUE: int
"""
Raised when a client writes to a writeable characteristic.
"""
GATT_SERVER_EVENT_INDICATION_OK: int
"""
Raised when an indication is acknowledged
"""
GATT_SERVER_EVENT_INDICATION_TIMEOUT: int
"""
Raised when an indication exceeds it's acknowlegement timeout
"""
GATT_SERVER_EVENT_CCCD_NONE: int
"""
Raised when a client sets a Characteristics CCCD so both
notifications and indications are disabled.
"""
GATT_SERVER_EVENT_CCCD_NOTIFY: int
"""
Raised when a client sets a Characteristics CCCD so notifications
are enabled.
"""
GATT_SERVER_EVENT_CCCD_INDICATE: int
"""
Raised when a client sets a Characteristics CCCD so indications
are enabled.
"""
GATT_SERVER_EVENT_CCCD_BOTH: int
"""
Raised when a client sets a Characteristics CCCD so both notifications
and indications are enabled.
"""

class GattServer:
    """
    The GattServer class allows creation and use of a GATT Server on the
    device.

    Only one instance of the GattServer class should ever be created.
    Multiple GattServer instances are not supported at this time.

    "Read" and "Write" functionality are from the CLIENT perspective.
    e.g. A "Read"able characteristic will have data written to it by
    this GattServer class and be read by the client and vice versa.

    All functions use __errCode to return a standard error code.
    """

    def __init__(self) -> any:
        pass

    def __del__(self):
        pass

    def build_from_dict(self, description:dict):
        """
        Builds the GATT server from a correctly formatted python dictionary.
        If the GATT server contains many services and characteristics and
        the GATT server is being built manually within the python script it
        may be necessary to build the dictionary in pieces as PikaPython has
        a limit to the number of characters a line of script can contain.

        The format of the GATT server dictionary is as follows.
        Services are a dictionary containing description keys and a
        dictionary of Characteristics
        Characteristics are a dictionary containing only description keys.

        The GATT server is NOT started after this function is used.

        Available description keys are:
        "Service N"         -   Indicates a Service dictionary where N is a
                                unique identifier within the GATT server
                                dictionary. N can be any character acceptable
                                to the PikaPython parser.
        "Characteristic N"  -   Indicates a Characteristic dictionary where N
                                is a unique identifier within the Service
                                dictionary. N can be any character acceptable
                                to the PikaPython parser.
        "UUID"              -   A string hexadecimal representation of the
                                service or characteristics UUID. 16 and 128
                                bit UUIDs are supported. 128 bit UUIDS can
                                be formatted using '-' characters for clarity.
                                e.g. "b8d00002-6329-ef96-8a4d-55b376d8b25a"
        "Name"              -   A unique name for the service or
                                characteristic. This is best kept short yet
                                descriptive and is used to reference that
                                individual item. Any character acceptable
                                to the PikaPython parser can be used.
        "Capability"        -   Defines the characteristic type. Available
                                types are currently:
                                "Read"      -   The characteristic can be read
                                                by the connected client.
                                "Write"     -   The characteristic can be
                                                written to by the connected
                                                client. Without acknowlegement.
                                "WriteAck"  -   The characteristic can be
                                                written to by the connected
                                                client. With acknowlegement.
                                "Notify"    -   The characteristic can be used
                                                to notify the connected client
                                                of a changed value. Without
                                                acknowlegement. An Applicable
                                                CCCD will automatically be
                                                created for this characteristic.
                                "Indicate"  -   The characteristic can be used
                                                to notify the connected client
                                                of a changed value. With
                                                acknowlegement. An Applicable
                                                CCCD will automatically be
                                                created for this characteristic.
                                Note some types can be mixed currently these
                                are:
                                    -   "Read Write"
                                    -   "Read WriteAck"
        "Length"            -   The length the data in the characteristic in
                                bytes. The data is initialised to zeros upon
                                the GATT server being started.
        "Read Encryption"   -   Defines the level of read encryption for this
                                characteristic. Available values are:
                                "None"      -   No encryption
                                "Encrypt"   -   Requires bonding and encrypted
                                                connection.
                                "Mitm"      -   Requires authenticated pairing
                                                and encrypted connection
        "Write Encryption"  -   Defines the level of write encryption for this
                                characteristic. Values as per "Read Encryption"
        "Callback"          -   Provides the facility to supply a callback to
                                allow the PikaPython script to react to events
                                from the underlying stack.
                                See :link GATT Server Callbacks: for more
                                information.

        :param description (dict): The Dictionary containing the GATT server
            description.
        """
        pass

    def start(self):
        """
        Starts the GATT server.
        """
        pass

    def stop(self):
        """
        Stops the GATT server.
        """
        pass

    def read(self, name:str) -> any:
        """
        Reads the current value of a "Write" characteristic.

        :param name (str): The "Name" of the characteristic to be read
        :returns: bytes containing the data read.
        """
        pass

    def write(self, name:str, value:any):
        """
        Writes a new value into a "Read" characteristic

        :param name (str): The "Name" of the characteristic to be written
        :param value (any): The new value to be written. value must be
            bytes
        """
        pass

    def notify(self, connection:Connection, name:str, value:any ):
        """
        Notifies the client through the named characteristic with a value.
        The characteristic must have the "Notify" capability.

        :param connection (Connection): The connection to be used. This is
            the Connection class object.
        :param name (str): The name of the characteristic to use for the
            notification.
        :param value (any): The value to be used in the notification.
            value must be bytes.
        """
        pass

    def indicate(self, connection:Connection, name:str, value:any ):
        """
        Indicates to the client through the named characteristic with a
        value.
        The characteristic must have the "Indicate" capability.

        :param connection (Connection): The connection to be used. This is
            the Connection class object.
        :param name (str): The name of the characteristic to use for the
            indication.
        :param value (any): The value to be used in the indication.
            value must be bytes.
        """
        pass

    """
    GATT Server Callbacks

    Characteristics can sometimes need to respond to events. This is
    achieved through the use of a callback system. A callback can be
    specified when defining a characteristic in the GATT Server
    dictionary.
    A callback is a PikaPython function that recieves an event object
    as a parameter:
    :code "def my_callback(event_object):" :

    Depending on the underlying event causing the callback to be called
    the event object will have various member variables.
    These can be one or more of:
        .type       -   The type of event.
                        See :link GATT Server Event Constants:
                        This is ALWAYS present
        .connection -   The connection object of the connection that
                        caused the event. Again this is ALWAYS present.
        .name       -   The name of the characteristic that caused
                        the event.
                        This is present in:
                        canvas_ble.GATT_SERVER_EVENT_ATTR_VALUE
                        canvas_ble.GATT_SERVER_INDICATION_OK
                        canvas_ble.GATT_SERVER_EVENT_CCCD_NONE
                        canvas_ble.GATT_SERVER_EVENT_CCCD_NOTIFY
                        canvas_ble.GATT_SERVER_EVENT_CCCD_INDICATE
                        canvas_ble.GATT_SERVER_EVENT_CCCD_BOTH
        .data       -   The characteristics new value as bytes.
                        This is present in:
                        canvas_ble.GATT_SERVER_EVENT_ATTR_VALUE

    If canvas_ble.GATT_SERVER_INDICATION_TIMEOUT is received the connection
    concerned is deemed to have failed. If the disconnect callback from
    :class Connection: has not been recieved and dealt with then the
    connection should be closed and deleted when an event of type
    canvas_ble.GATT_SERVER_INDICATION_TIMEOUT is received.
    """

#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
class Scanner:
    """
    Class for BLE scanning. This class is a singleton, only one scanner can be
    instantiated at a time. Attempting to instantiate a second scanner will
    return the existing instance.

    :param cb: Callback function to be called when a BLE advertisement is
        received. The callback function must accept a single argument, which will
        be a tuple of the form (rssi, type, data, addr). The `rssi` is the
        received signal strength indicator, the `type` is the advertisement type,
        the `data` is the advertisement data, and the `addr` is the MAC address
        of the device that sent the advertisement. 'type' will be a bitmask of
        one or more of the following values:

        * `canvas_ble.Scanner.TYPE_CONNECTABLE`: Connectable advertisement.
        * `canvas_ble.Scanner.TYPE_SCANNABLE`: Scannable advertisement.
        * `canvas_ble.Scanner.TYPE_DIRECTED`: Directed advertisement.
        * `canvas_ble.Scanner.TYPE_SCAN_RESPONSE`: Scan response.
        * `canvas_ble.Scanner.TYPE_LEGACY`: Legacy advertisement.
        * `canvas_ble.Scanner.TYPE_EXTENDED`: Extended advertisement.
    """
    TYPE_CONNECTABLE: int
    TYPE_SCANNABLE: int
    TYPE_DIRECTED: int
    TYPE_SCAN_RESPONSE: int
    TYPE_LEGACY: int
    TYPE_EXTENDED: int

    FILTER_NAME: int
    FILTER_UUID: int
    FILTER_ADDR: int
    FILTER_MANUF_DATA: int
    FILTER_DATA: int

    def __new__(cb: any) -> any:
        pass

    def set_phys(self, phys: int):
        """
        Set the PHYs to scan on. The `phys` parameter is a bitmask of the PHYs
        to scan on. The bitmask is a combination of the following values:
        `canvas_ble.PHY_1M`, `canvas_ble.PHY_2M`, and `canvas_ble.PHY_CODED`.

        :param phys: Bitmask of the PHYs to scan on.
        """
        pass

    def set_timing(self, interval_ms: int, window_ms: int):
        """
        Set the scan timing. The `interval_ms` parameter is the scan interval in
        milliseconds, and the `window_ms` parameter is the scan window in
        milliseconds. The scan window must be less than or equal to the scan
        interval.

        :param interval_ms: Scan interval in milliseconds.
        :param window_ms: Scan window in milliseconds.
        """
        pass

    def filter_add(self, type:int, data:any):
        """
        Add a filter to the scanner. The `type` parameter is the type of the
        filter to set on the advertisement data. The `data` parameter is particular
        to the type of filter being set. The following filter types are supported:

        * `canvas_ble.Scanner.FILTER_NAME`: The `data` parameter is a string.
        * `canvas_ble.Scanner.FILTER_UUID`: The `data` parameter is a UUID string.
        * `canvas_ble.Scanner.FILTER_ADDR`: The `data` parameter is a BLE address byte
           string.
        * `canvas_ble.Scanner.FILTER_MANUF_DATA`: The `data` parameter is a byte string
           of manufacturer data.
        * `canvas_ble.Scanner.FILTER_DATA`: The `data` parameter is a byte string
           of generic data.

        :param type: Type of filter to set.
        :param data: Filter data.
        """
        pass

    def filter_reset(self):
        """
        Remove all of the filters from the scanner.
        """
        pass

    def start(self, active: bool):
        """
        Start the scanner. The `active` parameter is a boolean value that
        indicates whether the scanner should be active or passive. If the
        value is `True`, the scanner will send scan requests to devices that
        advertise with a scannable advertisement type. If the value is `False`,
        the scanner will not send scan requests.

        :param active: Boolean value indicating whether the scanner should be
            active or passive.
        """
        pass

    def stop(self):
        """
        Stop the scanner.
        """
        pass

def find_ltv(type:int, ad:any) -> any:
    """
    Find the first LTV (length, type, value) tuple in the advertisement data
    that matches the given type. The `type` parameter is the type of the LTV
    to find. The `ad` parameter is the advertisement data to search.

    :param type: Type of LTV to find.
    :param ad: Advertisement data to search.

    :return: The first LTV tuple that matches the given type, or `None` if no
        LTV tuple matches the given type.
    """
    pass

