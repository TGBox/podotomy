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

# Let's inspect density along Y (height):
slices = {}
for i in range(0, count, 10):
    x, y, z = struct.unpack_from('<3f', bin_data, offset + i * 12)
    # bucket by 10mm
    bucket = int(y // 10) * 10
    slices[bucket] = slices.get(bucket, 0) + 1

print("Vertex distribution along Y (height in mm):")
for b in sorted(slices.keys()):
    bar = '#' * (slices[b] // 1000)
    print(f"Y [{b:3d} to {b+10:3d} mm]: {slices[b]:6d} vertices {bar}")
