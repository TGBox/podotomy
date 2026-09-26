import struct
import json

input_path = 'bones_foot.glb'

with open(input_path, 'rb') as f:
    header = f.read(12)
    magic, version, total_len = struct.unpack('<4sII', header)
    
    # JSON chunk
    json_len, json_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(json_len)
    gltf = json.loads(json_bytes.decode('utf-8'))
    
    # BIN chunk
    bin_len, bin_type = struct.unpack('<II', f.read(8))
    bin_bytes = bytearray(f.read(bin_len))

prim = gltf['meshes'][0]['primitives'][0]
pos_acc_idx = prim['attributes']['POSITION']
pos_acc = gltf['accessors'][pos_acc_idx]
pos_bv = gltf['bufferViews'][pos_acc['bufferView']]
pos_offset = (pos_bv.get('byteOffset', 0)) + (pos_acc.get('byteOffset', 0))
count = pos_acc['count']

# Compute foot centroid (weighting the foot body where vertices are dense)
# Shift values to place foot body center directly at (0, 0, 0)
shift_x = 6.44
shift_y = -47.82
shift_z = -3.34

print(f"Shifting all vertices by ({shift_x}, {shift_y}, {shift_z}) so foot center is at (0, 0, 0)...")

new_min = [float('inf'), float('inf'), float('inf')]
new_max = [float('-inf'), float('-inf'), float('-inf')]

for i in range(count):
    p_idx = pos_offset + i * 12
    x, y, z = struct.unpack_from('<3f', bin_bytes, p_idx)
    nx = x - shift_x
    ny = y - shift_y
    nz = z - shift_z
    struct.pack_into('<3f', bin_bytes, p_idx, nx, ny, nz)
    
    if nx < new_min[0]: new_min[0] = nx
    if ny < new_min[1]: new_min[1] = ny
    if nz < new_min[2]: new_min[2] = nz
    if nx > new_max[0]: new_max[0] = nx
    if ny > new_max[1]: new_max[1] = ny
    if nz > new_max[2]: new_max[2] = nz

pos_acc['min'] = new_min
pos_acc['max'] = new_max

print(f"New Bounds: Min={new_min}, Max={new_max}")

# Re-encode JSON
new_json_str = json.dumps(gltf, separators=(',', ':'))
new_json_bytes = new_json_str.encode('utf-8')
padding = (4 - (len(new_json_bytes) % 4)) % 4
new_json_bytes += b' ' * padding
new_json_len = len(new_json_bytes)

new_total_len = 12 + 8 + new_json_len + 8 + len(bin_bytes)

with open(input_path, 'wb') as f:
    f.write(struct.pack('<4sII', magic, version, new_total_len))
    f.write(struct.pack('<II', new_json_len, json_type))
    f.write(new_json_bytes)
    f.write(struct.pack('<II', len(bin_bytes), bin_type))
    f.write(bin_bytes)

print("bones_foot.glb updated successfully!")
