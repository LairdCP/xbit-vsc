from DvkProbe import DvkProbe
import json
result = DvkProbe.get_connected_probes()

json_result = []

# for each result, get the dap info
for inst in result:

  # if inst has function probe, then call it
  inst.open()
  board_name = inst.get_dap_info(8)
  inst.close()
  inst_result = {
    "_id": inst._id,
    "_ports": inst._ports,
    "_board_name": board_name
  }
  json_result.append(inst_result)

def obj_dict(obj):
    return obj.__dict__

json_string = json.dumps(json_result, default=obj_dict)

print(json_string)
