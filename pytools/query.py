from dvk_probe import DvkProbe
import json
probes = DvkProbe.get_connected_probes()

json_result = []

print("Found %d probes" % len(probes))
# for each result, get the dap info
for probe in probes:
  ports = []
  for port in probe.ports:
    port_info = DvkProbe.get_com_port_info(probe.ports[port])
    print("Port %d: %s" % (port, port_info))
    ports.append(port_info)
  # if inst has function probe, then call it
  probe.open()
  board_name = probe.get_dap_info(8)
  board_vendor = probe.get_dap_info(7)
  probe.close()
  inst_result = {
    "id": probe.id,
    "ports": ports,
    "board_name": board_name,
    "board_vendor": board_vendor
  }
  json_result.append(inst_result)


def obj_dict(obj):
    return obj.__dict__

json_string = json.dumps(json_result, default=obj_dict)

print(json_string)
