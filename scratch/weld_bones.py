"""Weld duplicate vertices of bones_foot.glb (triangle soup -> indexed mesh).
Normals of merged vertices are averaged. Vertex order = first occurrence (keeps
runtime centroid ~identical and good GPU cache locality)."""
import struct, json, sys
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
with open(src, 'rb') as f:
    magic, ver, _ = struct.unpack('<4sII', f.read(12))
    jl, _ = struct.unpack('<II', f.read(8)); g = json.loads(f.read(jl))
    bl, _ = struct.unpack('<II', f.read(8)); b = f.read(bl)

acc, bvs = g['accessors'], g['bufferViews']
prim = g['meshes'][0]['primitives'][0]
assert len(g['meshes']) == 1 and len(g['meshes'][0]['primitives']) == 1 and 'indices' not in prim

def read(i):
    a = acc[i]; v = bvs[a['bufferView']]
    return np.frombuffer(b, np.float32, a['count'] * 3, v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, 3)

P = read(prim['attributes']['POSITION']); N = read(prim['attributes']['NORMAL']).astype(np.float64)
_, first, inv = np.unique(P, axis=0, return_index=True, return_inverse=True)
inv = inv.ravel()
order = np.argsort(first)                 # unique ids sorted by first occurrence
remap = np.empty_like(order); remap[order] = np.arange(len(order))
idx = remap[inv].astype(np.uint32)
pos = P[first[order]].astype(np.float32)

nacc = np.zeros((len(pos), 3)); np.add.at(nacc, idx, N)
ln = np.linalg.norm(nacc, axis=1)
fallback = N[first[order]]
nrm = np.where(ln[:, None] > 1e-6, nacc / np.maximum(ln, 1e-12)[:, None], fallback).astype(np.float32)

blobs = [pos.tobytes(), nrm.tobytes(), idx.tobytes()]
views, off = [], 0
for data, target in zip(blobs, [34962, 34962, 34963]):
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target}); off += len(data)
bin_ = b''.join(blobs)
g['bufferViews'] = views
g['buffers'] = [{'byteLength': len(bin_)}]
g['accessors'] = [
    {'bufferView': 0, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
     'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
    {'bufferView': 1, 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
    {'bufferView': 2, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
]
prim['attributes'] = {'POSITION': 0, 'NORMAL': 1}; prim['indices'] = 2
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
bin_ += b'\0' * (-len(bin_) % 4)
with open(dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bin_)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)
print(f'{len(P)} -> {len(pos)} vertices, {len(idx)//3} triangles')
