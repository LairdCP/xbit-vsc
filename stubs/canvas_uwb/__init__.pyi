#
# Copyright (c) 2023 Laird Connectivity LLC
#
# SPDX-License-Identifier: LicenseRef-LairdConnectivity-Clause
#
# NOTE: This file is a stub for the purpose of type checking and code
# generation. It is not intended to be used at runtime. Constant values
# are set to 0 to avoid type checking errors, but runtime values may
# differ.

#: :meta hide-value:
#: Responder/Controlee role
ROLE_RESPONDER: int = 0
#: :meta hide-value:
#: Initiator/Controller role
ROLE_INITIATOR: int = 0

#: :meta hide-value:
#: Represents an invalid range value
RANGE_ERROR: int = 0

#: :meta hide-value:
#: Unicast (one-to-one) mode
MODE_UNICAST: bytes = b''
#: :meta hide-value:
#: Multicast (one-to-many) mode
MODE_MULTICAST: bytes = b''

#: :meta hide-value:
#: Application configuration for device type
CONFIG_DEVICE_TYPE: int = 0
#: :meta hide-value:
#: Application configuration for ranging round usage
CONFIG_RANGING_ROUND_USAGE: int = 0
#: :meta hide-value:
#: Application configuration for multi-node mode (Unicast or Multicast)
CONFIG_MULTI_NODE_MODE: int = 0
#: :meta hide-value:
#: Application configuration for number of controlees in multicast session
CONFIG_NUMBER_OF_CONTROLEES: int = 0
#: :meta hide-value:
#: Application configuration for local address
CONFIG_LOCAL_ADDRESS: int = 0
#: :meta hide-value:
#: Application configuration for peer address
CONFIG_PEER_ADDRESS: int = 0
#: :meta hide-value:
#: Application configuration for ranging slot duration
CONFIG_SLOT_DURATION: int = 0
#: :meta hide-value:
#: Application configuration for ranging interval (milliseconds)
CONFIG_RANGING_INTERVAL: int = 0
#: :meta hide-value:
#: Application configuration for device role
CONFIG_DEVICE_ROLE: int = 0
#: :meta hide-value:
#: Application configuration for RF frame configuration
CONFIG_RF_FRAME_CONFIG: int = 0
#: :meta hide-value:
#: Application configuration for preamble code index
CONFIG_PREAMBLE_CODE_INDEX: int = 0
#: :meta hide-value:
#: Application configuration for SFD identifier
CONFIG_SFD_ID: int = 0
#: :meta hide-value:
#: Application configuration for number of slots per ranging round
CONFIG_SLOTS_PER_RR: int = 0
#: :meta hide-value:
#: Application configuration for MAC address mode (2 or 8 byte addresses)
CONFIG_MAC_ADDRESS_MODE: int = 0
#: :meta hide-value:
#: Application configuration for maximum ranging round retries
CONFIG_MAX_RR_RETRY: int = 0
#: :meta hide-value:
#: Application configuration for transmit power
CONFIG_TX_POWER: int = 0

class UwbDeviceState:
    """
    Helper class to represent the state of the UWB device.

    This class should not be created directly. Instead, an instance of
    the class is returned by :py:func:`get_device_state`.
    """
    def __init__(self, state: int) -> any:
        pass

    def is_error(self) -> bool:
        """
        :return: `True` if the device is in an error state. `False` if the
            device is in a normal state.
        """
        pass

    def is_ready(self) -> bool:
        """
        :return: `True` if the device is ready to be used. `False` if the
            device is not ready to be used.
        """
        pass

    def is_active(self) -> bool:
        """
        :return: `True` if the device has at least one active session. `False`
            if the device has no active sessions.
        """
        pass

class UwbStackCapabilities:
    """
    Helper class to represent the capabilities of the UWB stack.

    This class should not be created directly. Instead, an instance of
    the class is returned by :py:func:`get_stack_capability`.
    """
    def __init__(self, max_multicast: int, max_sessions: int, channel_mask: int, roles: int) -> any:
        pass

    def get_max_sessions(self) -> int:
        """
        :return: The maximum number of sessions that can be created.
        """
        pass

    def get_max_multicast(self) -> int:
        """
        :return: The maximum number of multicast addresses that can be
            added to a session.
        """
        pass

    def get_channel_mask(self) -> int:
        """
        :return: The channel mask of the UWB stack. This is a bit mask
            where each bit represents a channel. For example, if the
            channel mask is 0x00000001, then channel 0 is enabled. If
            the channel mask is 0x00000003, then channels 0 and 1 are
            enabled.
        """
        pass

    def is_responder_supported(self) -> bool:
        """
        :return: `True` if the UWB stack supports the responder role.
        """
        pass

    def is_initiator_supported(self) -> bool:
        """
        :return: `True` if the UWB stack supports the initiator role.
        """
        pass

class UwbSessionState:
    """
    Helper class to represent the state of a UWB session.

    This class should not be created directly. Instead, an instance of
    the class is returned by :py:meth:`UwbSession.get_session_state`.
    """
    def __init__(self, state: int) -> any:
        pass

    def is_init(self) -> bool:
        """
        :return: `True` if the session is in the init state. `False` if the
            session is not in the init state.
        """
        pass

    def is_deinit(self) -> bool:
        """
        :return: `True` if the session is in the deinit state. `False` if the
            session is not in the deinit state.
        """
        pass

    def is_active(self) -> bool:
        """
        :return: `True` if the session is in the active state. `False` if the
            session is not in the active state.
        """
        pass

    def is_idle(self) -> bool:
        """
        :return: `True` if the session is in the idle state. `False` if the
            session is not in the idle state.
        """
        pass

    def is_error(self) -> bool:
        """
        :return: `True` if the session is not in a normal state. `False` if
            the session is in a normal state.
        """
        pass

class UwbSession:
    """
    Class representing a UWB session. A session is a collection of
    settings and state related to a UWB ranging session.
    A session is created by calling :py:func:`session_new`. Following
    the creation, the session is configured by calling the various `set_*()`
    class methods. The session is started by calling the :py:meth:`start`
    method. The session is stopped by calling the :py:meth:`stop` method.
    The session is destroyed by calling the :py:meth:`close` method.

    In general, the settings of a session must match on both sides of the
    ranging session. For example, if the initiator sets the ranging interval
    to 1000ms, then the responder must also set the ranging interval to 1000ms.
    The UWB radio and stack have no way of exchanging settings between the
    initiator and responder. Therefore, it is the responsibility of the
    application to ensure that the settings match on both sides of the
    session.

    :param session_id: The session ID. This is a unique identifier for the
      session.
    """
    def __init__(self, session_id: int) -> any:
        pass

    def __del__(self):
        pass

    def set_local_addr(self, address: int):
        """
        Set the local address of the session. This is the address that
        the UWB stack will use when ranging with the peer(s).

        :param address: The local address.
        """
        pass

    def set_peer_addr(self, address: int):
        """
        Set the peer address of the session. This is the address that
        the UWB stack will attempt to communicate with when ranging.

        :param address: The peer address.
        """
        pass

    def set_ranging_interval(self, interval: int):
        """
        Set the ranging interval of the session. This is the interval
        at which the UWB stack will attempt to range with the peer(s).
        The value should be same on both sides of the ranging session.

        :param interval: The ranging interval in milliseconds.
        """
        pass

    def set_callback(self, cb: any):
        """
        Set the callback function for the session. The callback function
        will be called at approximately the interval specified by the
        :py:meth:`set_ranging_interval` method.

        The callback function should expect to take a single list argumnent.
        Each entry of the list will be a tuple containing the following
        values:
          - The address of the peer.
          - The range value in centimeters. This value will be equal to
            :py:data:`canas_uwb.RANGE_ERROR` if the range is invalid.

        :param cb: The callback function.
        """
        pass

    def set_app_config(self, config_id: int, value: any):
        """
        Set an application configuration value for a session.

        :param config_id: The configuration ID.
        :param value: The configuration value. This is a bytes value of the required
            length for the configuration ID.
        """
        pass

    def get_app_config(self, config_id: int) -> any:
        """
        Get an application configuration value for a session.

        :param config_id: The configuration ID.

        :return: The configuration value. This is a bytes value of the required
            length for the configuration ID.
        """
        pass

    def get_session_state(self) -> UwbSessionState:
        """
        Get the state of the session.

        :return: The session state as a :py:class:`UwbSessionState` object.
        """
        pass

    def add_multicast(self, address: int):
        """
        Add an address to the multicast list of the session. The UWB stack
        will attempt to range with all addresses in the multicast list. The
        session must have been configured as a multicast session by calling
        the :py:meth:`set_app_config` method with the
        :py:data:`canvas_uwb.CONFIG_MULTI_NODE_MODE` configuration ID and
        a value of :py:data:`canvas_uwb.MODE_MULTICAST`. This method is
        only applicable to the initiator role.

        :param address: The address to add to the multicast list.
        """
        pass

    def del_multicast(self, address: int):
        """
        Delete an address from the multicast list of the session.

        :param address: The address to delete from the multicast list.
        """
        pass

    def start(self) -> bool:
        """
        Start the session. The session must have been configured before
        calling this method.

        :return: `True` if the session was started successfully. `False` if
            the session was not started successfully.
        """
        pass

    def stop(self):
        """
        Stop the session.
        """
        pass

    def close(self):
        """
        Close the session and free any resources associated with the session.
        Once a session is closed, it cannot be used again.
        """
        pass

def init():
    """
    Initialize the UWB stack. This method must be called before any other
    UWB stack methods are called.
    """
    pass

def shutdown():
    """
    Shutdown the UWB stack. This method must be called when the UWB stack
    is no longer needed. To use the UWB stack again, the `init()` method.
    """
    pass

def get_stack_capability() -> UwbStackCapabilities:
    """
    Get the capabilities of the UWB stack.

    :return: The capabilities of the UWB stack as a
      :py:class:`UwbStackCapabilities` object.
    """
    pass

def get_device_state() -> UwbDeviceState:
    """
    Get the state of the UWB device.

    :return: The state of the UWB device as a :py:class:`UwbDeviceState`
      object.
    """
    pass

def session_new(session_id: int, role: int) -> UwbSession:
    """
    Create a new session.

    :param session_id: The session ID. This is a unique identifier for the
        session.
    :param role: The role of the session. This should be either
        :py:data:`canvas_uwb.ROLE_RESPONDER` or
        :py:data:`canvas_uwb.ROLE_INITIATOR`.
    """
    pass

def raw_uci_send(data: any) -> bytes:
    """
    Send a raw UCI command to the UWB stack.

    :param data: The raw UCI command to send to the UWB stack.

    :return: The raw UCI reply received from the UWB stack.
    """
    pass

