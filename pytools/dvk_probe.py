from probe import Probe, ProbePorts
import ctypes as c
import logging
import operator
from pyocd.probe.pydapaccess import DAPAccessCMSISDAP
import serial.tools.list_ports as list_ports
import time
from lc_util import logger_setup

logger = logging.getLogger(__name__)

SET_IO_DIR_CMD = 31
SET_IO_CMD = 30
READ_IO_CMD = 29
READ_BOARD_ID_BYTES_CMD = 28
WRITE_BOARD_ID_BYTES_CMD = 27
REBOOT_CMD = 26
HIGH = OUTPUT = 1
LOW = INPUT = 0
PROBE_BOOT_TIME = 5
BOARD_ID_ADDRESS = 0
MAX_READ_WRITE_LEN = 60
MAX_SETTINGS_SIZE = 256
PROBE_VENDOR_STRING = 'Laird Connectivity'
PROBE_PRODUCT_STRING = 'DVK Probe CMSIS-DAP'


class ProbeSettings(c.Structure):
    _fields_ = [
        ('version', c.c_uint8),
        ('target_device_vendor', c.c_char * 32),
        ('target_device_name', c.c_char * 32),
        ('target_board_vendor', c.c_char * 32),
        ('target_board_name', c.c_char * 32),
    ]


class DvkProbe(Probe):
    ROBOT_LIBRARY_SCOPE = 'TEST SUITE'

    GPIO_16 = 16
    GPIO_17 = 17
    GPIO_18 = 18
    GPIO_19 = 19
    GPIO_20 = 20
    GPIO_21 = 21
    GPIO_22 = 25
    GPIO_26 = 26
    GPIO_27 = 27
    GPIO_28 = 28

    def __init__(self, id, description, ports: ProbePorts):
        super().__init__(id, description, ports)
        self.__probe_handle = None

    @staticmethod
    def get_connected_probes() -> list['DvkProbe']:
        """Get a list of all connected probes.

        Returns:
            List: List of DVK probes
        """
        probes = []
        for dap_probe in DAPAccessCMSISDAP.get_connected_devices():
            # Is this the probe we are looking for?
            if dap_probe.vendor_name == PROBE_VENDOR_STRING and \
                    dap_probe.product_name == PROBE_PRODUCT_STRING:
                id = dap_probe._unique_id
                logger.debug(f'Found probe {id}')

                # Create list of comports that correspond to emulator
                com_ports = list()
                for comport in list_ports.comports():
                    if id == comport.serial_number:
                        logger.debug(
                            f'Found probe COM port {comport.device} [{comport.serial_number}]')
                        com_ports.append(comport)
                    else:
                        logger.debug(
                            f'COM port {comport.device} [{comport.serial_number}]')

                # Sort the com ports so that the Zephyr port is first
                com_ports.sort(key=operator.attrgetter('location', 'device'))
                if len(com_ports) < 2:
                    logger.warning(
                        f'No COM ports found for probe {id}, skipping this probe')
                    continue

                probes.append(
                    DvkProbe(dap_probe._unique_id,
                             PROBE_PRODUCT_STRING,
                             {"zephyr_shell": com_ports[0].device,
                              "python": com_ports[1].device}))

        return probes

    def open(self):
        if self.__probe_handle == None:
            self.__probe_handle = DAPAccessCMSISDAP(self.id)

        logger.info(f"Opening Dvk Probe ID {self.id}")
        if not self.__probe_handle.is_open:
            self.__probe_handle.open()
        if not self.__probe_handle.is_open:
            raise Exception(f"Unable to open Dvk Probe at {self.id}")

    def close(self):
        self.__probe_handle.close()

    def gpio_read(self, gpio: int):
        res = self.__probe_handle.vendor(READ_IO_CMD, [gpio])
        return res[0]

    def gpio_to_input(self, gpio: int, option: int = 0):
        res = self.__probe_handle.vendor(SET_IO_DIR_CMD, [gpio, INPUT, option])
        return res[0]

    def gpio_to_output(self, gpio: int, option: int = 0):
        res = self.__probe_handle.vendor(
            SET_IO_DIR_CMD, [gpio, OUTPUT, option])
        return res[0]

    def gpio_to_output_low(self, gpio: int):
        res = self.__probe_handle.vendor(SET_IO_CMD, [gpio, LOW])
        return res[0]

    def gpio_to_output_high(self, gpio: int):
        res = self.__probe_handle.vendor(SET_IO_CMD, [gpio, HIGH])
        return res[0]

    def get_dap_info(self, id: int):
        result = self.__probe_handle.identify(DAPAccessCMSISDAP.ID(id))
        return result

    def get_dap_info1(self, id: DAPAccessCMSISDAP.ID):
        result = self.__probe_handle.identify(id)
        return result

    def get_dap_ids(self):
        return DAPAccessCMSISDAP.ID

    def reset_probe(self):
        self.__probe_handle.assert_reset(True)
        time.sleep(0.050)
        self.__probe_handle.assert_reset(False)
        time.sleep(0.050)

    def write_settings(self, settings: ProbeSettings):
        """Write the probe settings to the EEPROM

        Args:
            settings (ProbeSettings): Probe settings to write

        Raises:
            Exception: If the settings size is too large
        """
        bytes_left = c.sizeof(settings)
        if bytes_left > MAX_SETTINGS_SIZE:
            raise Exception(f'Settings size is too large: {bytes_left}')
        address = BOARD_ID_ADDRESS
        write_len = MAX_READ_WRITE_LEN
        settings_bytes = list(bytearray(settings))

        while bytes_left > 0:
            write_cmd = []
            write_cmd.append(address)
            if (bytes_left > MAX_READ_WRITE_LEN):
                write_len = MAX_READ_WRITE_LEN
            else:
                write_len = bytes_left
            write_cmd.append(write_len)
            write_cmd.extend(settings_bytes[0:write_len])
            res = self.__probe_handle.vendor(
                WRITE_BOARD_ID_BYTES_CMD, write_cmd)
            assert res[0] == write_len, 'Could not write board ID bytes'
            settings_bytes = settings_bytes[write_len:]
            bytes_left -= res[0]
            address += res[0]

    def read_settings(self) -> ProbeSettings:
        """Read the probe settings from the EEPROM

        Returns:
            ProbeSettings: All the probe settings
        """
        bytes_left = MAX_SETTINGS_SIZE
        address = BOARD_ID_ADDRESS
        read_len = MAX_READ_WRITE_LEN
        settings_bytes = []
        while bytes_left > 0:
            if (bytes_left > MAX_READ_WRITE_LEN):
                read_len = MAX_READ_WRITE_LEN
            else:
                read_len = bytes_left
            res = self.__probe_handle.vendor(
                READ_BOARD_ID_BYTES_CMD, [address, read_len])
            assert res[0] == read_len, f'Read board id bytes failed, response: {res}'
            settings_bytes.extend(res[1:])
            bytes_left -= read_len
            address += read_len
        return ProbeSettings.from_buffer(bytearray(settings_bytes))

    def reboot(self, bootloader: bool = False) -> int:
        """Reboot the debug probe

        Args:
            bootloader (bool, optional): reboot into bootloader mode. Defaults to False.

        Returns:
            int: 0 on success
        """
        res = self.__probe_handle.vendor(REBOOT_CMD, [bootloader])
        return res[0]

    def program_v1_settings(self, board_vendor: str, board_name: str, target_device_vendor: str, target_device_name: str):
        """Program settings into the I2C EEPROM of the DVK Probe

        Args:
            board_vendor (str): e.g. Laird Connectivity
            board_name (str): e.g. Vela IF820 DVK
            target_device_vendor (str): e.g. ARM
            target_device_name (str): e.g. cortex_m
        """

        settings = ProbeSettings(version=1,
                                 target_device_vendor=bytes(
                                     target_device_vendor, 'UTF-8'),
                                 target_device_name=bytes(
                                     target_device_name, 'UTF-8'),
                                 target_board_vendor=bytes(
                                     board_vendor, 'UTF-8'),
                                 target_board_name=bytes(board_name, 'UTF-8'))

        self.write_settings(settings)
        settings_read = self.read_settings()
        assert bytearray(settings) == bytearray(
            settings_read), f'Verify board settings failed {bytearray(settings_read)}'

        # Reboot the probe after changing settings in order for the settings to take effect
        logger.info('Rebooting the probe...')
        res = self.reboot()
        assert res == 0, 'Failed to reboot!'
        self.close()
        time.sleep(PROBE_BOOT_TIME)
        self.__probe_handle.open()
        (device_vendor, device_name) = self.__probe_handle.target_names
        assert device_vendor == target_device_vendor and device_name == target_device_name, \
            f'Target device vendor [{device_vendor}] and device name [{device_name}] do not match the programmed settings!'


if __name__ == "__main__":
    logger = logger_setup(__file__)
    probes = DvkProbe.get_connected_probes()
    logger.info(f"Probes found: {len(probes)}")
    for p in probes:
        logger.info(p)
        for port in p.ports:
            port_info = DvkProbe.get_com_port_info(p.ports[port])
            logger.info(
                f"\tProbe port {port_info.device} HWID: {port_info.hwid}")
