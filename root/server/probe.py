from DvkProbe import DvkProbe
import json
result = DvkProbe.get_connected_probes()

def obj_dict(obj):
    return obj.__dict__

json_string = json.dumps(result, default=obj_dict)

print(json_string)
