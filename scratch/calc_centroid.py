import struct, json

with open('bones_foot.glb', 'rb') as f:
    f.read(12)
    l, t = struct.unpack('<II', f.read(8))
    j = json.loads(f.read(l).decode('utf-8'))
    f.read(8)
    bin_data = f.read()

prim = j['meshes'][0]['primitives'][0]
pos_acc = j['accessors'][prim['attributes']['POSITION']]
bv = j['bufferViews'][pos_acc['bufferView']]
offset = bv.get('byteOffset', 0) + pos_acc.get('byteOffset', 0)
count = pos_acc['count']

sum_x, sum_y, sum_z = 0.0, 0.0, 0.0
for i in range(0, count, 8):
    x, y, z = struct.unpack_from('<3f', bin_data, offset + i * 12)
    sum_x += x
    sum_y += y
    sum_z += z

samples = count // 8
centroid_x = sum_x / samples
centroid_y = sum_y / samples
centroid_z = sum_z / samples

print(f"Calculated Centroid: ({centroid_x:.3f}, {centroid_y:.3f}, {centroid_z:.3f})")
