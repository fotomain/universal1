"""BIMC v1 - the binary chunk format of the BIM feature (one chunk = the geometry of one storey, or a part of it).

Design (documentation/BIM_WBS.html section 6): send less data, in the form the GPU already uses.
  * positions are Uint16 x 3 QUANTIZED inside the bounding box of the chunk (6 bytes a vertex; precision = box size / 65 535, about 1.5 mm for 100 m),
  * a Uint16 element number per vertex (the vertex belongs to ONE element: no sharing between elements), so a viewer can colour / dim / pick per element,
  * indices Uint16 (or Uint32 when the chunk has more than 65 535 vertices, flag bit 0),
  * no normals (the viewer shades flat with screen derivatives), no JSON, no parse: the client makes typed array VIEWS on the buffer (zero copy),
  * every section starts at a multiple of 4 bytes, little endian.
The scene is Y up, metres, the origin shifted to the model (the shift is stored in bim_model_table.originShift).
Not in v1 (the header has room for it): instancing of repeated geometry, normals, meshopt. Chunk name = sha256 of its bytes.

Layout:
  header   80 bytes   magic 'BIMC' | u16 version | u16 flags | u32 vertexCount | u32 indexCount | u32 elementCount | u32 materialCount | u32 rangeCount |
                      f32 min[3] | f32 size[3] | u32 offMaterials | offPositions | offElemIndex | offIndices | offRanges | offGuids | u32 totalSize
  materials  materialCount x RGBA8 (A = 255 opaque)
  positions  vertexCount x 3 x u16
  elemIndex  vertexCount x u16          (chunk local element number)
  indices    indexCount x u16 / u32
  ranges     rangeCount x { u16 element, u16 material, u32 firstIndex, u32 indexCount }   sorted by firstIndex = the answer to "which element is this triangle"
  guids      elementCount x 24 bytes ASCII (the 22 characters of the IFC GlobalId, zero padded)
"""
from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass, field

import numpy as np

MAGIC = b'BIMC'
VERSION = 1
FLAG_INDEX32 = 1
HEADER_SIZE = 80
GUID_SLOT = 24
MAX_ELEMENTS_PER_CHUNK = 60000
_HEADER = struct.Struct('<4sHHIIIII3f3fIIIIIII')


def _pad4(n: int) -> int:
    return (n + 3) & ~3


@dataclass
class ChunkElement:
    """One element of a chunk: its triangles in scene space (Y up, metres, origin shifted) and one material index per triangle."""
    guid: str
    verts: np.ndarray            # (n, 3) float64
    faces: np.ndarray            # (m, 3) int, indices into verts
    face_material: np.ndarray    # (m,) int index into the chunk palette


@dataclass
class Chunk:
    data: bytes
    sha256: str
    vertex_count: int
    index_count: int
    element_count: int
    bbox_min: tuple
    bbox_size: tuple
    element_guids: list = field(default_factory=list)
    element_bboxes: list = field(default_factory=list)   # per element (minx, miny, minz, maxx, maxy, maxz) in scene space


def write_chunk(elements: list[ChunkElement], palette: list[tuple]) -> Chunk:
    """palette = [(r, g, b, a) 0..255]. At most MAX_ELEMENTS_PER_CHUNK elements (the caller splits)."""
    if not elements:
        raise ValueError('a chunk needs at least one element')
    if len(elements) > MAX_ELEMENTS_PER_CHUNK:
        raise ValueError('too many elements for one chunk')
    if len(palette) > 255:
        raise ValueError('palette too large')
    all_v = np.concatenate([e.verts for e in elements], axis=0)
    mn = all_v.min(axis=0)
    mx = all_v.max(axis=0)
    size = np.where(mx - mn > 0, mx - mn, 1.0)
    # float32 box: the viewer reads the same numbers, so quantize against what is stored
    mn32 = mn.astype('<f4')
    size32 = size.astype('<f4')
    q = np.rint((all_v - mn32.astype(np.float64)) / size32.astype(np.float64) * 65535.0).clip(0, 65535).astype('<u2')
    elem_index = np.concatenate([np.full(len(e.verts), i, dtype='<u2') for i, e in enumerate(elements)])
    n_vertices = len(all_v)
    index32 = n_vertices > 65535
    idx_dtype = '<u4' if index32 else '<u2'

    idx_parts = []
    ranges = []
    base = 0
    first = 0
    for i, e in enumerate(elements):
        faces = np.asarray(e.faces, dtype=np.int64).reshape(-1, 3)
        mats = np.asarray(e.face_material, dtype=np.int64).reshape(-1)
        order = np.argsort(mats, kind='stable')
        faces = faces[order]
        mats = mats[order]
        if len(faces):
            start = 0
            while start < len(mats):
                end = start
                while end < len(mats) and mats[end] == mats[start]:
                    end += 1
                ranges.append((i, int(mats[start]), first + start * 3, (end - start) * 3))
                start = end
            idx_parts.append((faces + base).reshape(-1).astype(idx_dtype))
            first += len(faces) * 3
        base += len(e.verts)
    indices = np.concatenate(idx_parts) if idx_parts else np.zeros(0, dtype=idx_dtype)

    pal = np.zeros((len(palette), 4), dtype='u1')
    for i, c in enumerate(palette):
        pal[i] = [c[0], c[1], c[2], c[3] if len(c) > 3 else 255]
    guids = b''.join(e.guid.encode('ascii')[:GUID_SLOT].ljust(GUID_SLOT, b'\0') for e in elements)
    rng = b''.join(struct.pack('<HHII', *r) for r in ranges)

    sections = [pal.tobytes(), q.tobytes(), elem_index.tobytes(), indices.tobytes(), rng, guids]
    offsets = []
    pos = HEADER_SIZE
    for s in sections:
        offsets.append(pos)
        pos += _pad4(len(s))
    total = pos
    head = _HEADER.pack(MAGIC, VERSION, FLAG_INDEX32 if index32 else 0, n_vertices, len(indices), len(elements), len(palette), len(ranges),
                        *[float(x) for x in mn32], *[float(x) for x in size32], *offsets, total)
    assert len(head) == HEADER_SIZE, len(head)
    out = bytearray(head)
    for s in sections:
        out += s
        out += b'\0' * (_pad4(len(s)) - len(s))
    data = bytes(out)
    boxes = []
    for e in elements:
        a, b = e.verts.min(axis=0), e.verts.max(axis=0)
        boxes.append(tuple(round(float(x), 4) for x in (*a, *b)))
    return Chunk(data=data, sha256=hashlib.sha256(data).hexdigest(), vertex_count=n_vertices, index_count=len(indices), element_count=len(elements),
                 bbox_min=tuple(float(x) for x in mn32), bbox_size=tuple(float(x) for x in size32), element_guids=[e.guid for e in elements], element_bboxes=boxes)


@dataclass
class ReadChunk:
    version: int
    flags: int
    vertex_count: int
    index_count: int
    element_count: int
    bbox_min: np.ndarray
    bbox_size: np.ndarray
    palette: np.ndarray
    positions: np.ndarray       # (n, 3) uint16
    element_index: np.ndarray   # (n,) uint16
    indices: np.ndarray
    ranges: list
    guids: list

    def world_positions(self) -> np.ndarray:
        """the dequantized positions in scene space (float64)"""
        return self.bbox_min.astype(np.float64) + self.positions.astype(np.float64) / 65535.0 * self.bbox_size.astype(np.float64)

    def element_of_triangle(self, triangle: int) -> int:
        first = triangle * 3
        for el, _m, f, c in self.ranges:
            if f <= first < f + c:
                return el
        return -1


def read_chunk(data: bytes) -> ReadChunk:
    """The reader of the tests and the checker (the app has its own in TypeScript: kit8/pm/bim/bimc/bimcReader.ts; both read the same golden file)."""
    (magic, version, flags, nv, ni, ne, nm, nr, mnx, mny, mnz, sx, sy, sz, o_mat, o_pos, o_el, o_idx, o_rng, o_gd, total) = _HEADER.unpack_from(data, 0)
    if magic != MAGIC:
        raise ValueError('not a BIMC chunk')
    if version != VERSION:
        raise ValueError(f'unsupported BIMC version {version}')
    if total != len(data):
        raise ValueError('the chunk is cut: size differs from the header')
    idx_dtype = '<u4' if flags & FLAG_INDEX32 else '<u2'
    pal = np.frombuffer(data, dtype='u1', count=nm * 4, offset=o_mat).reshape(-1, 4)
    pos = np.frombuffer(data, dtype='<u2', count=nv * 3, offset=o_pos).reshape(-1, 3)
    el = np.frombuffer(data, dtype='<u2', count=nv, offset=o_el)
    idx = np.frombuffer(data, dtype=idx_dtype, count=ni, offset=o_idx)
    ranges = [struct.unpack_from('<HHII', data, o_rng + 12 * i) for i in range(nr)]
    guids = [data[o_gd + GUID_SLOT * i:o_gd + GUID_SLOT * (i + 1)].rstrip(b'\0').decode('ascii') for i in range(ne)]
    return ReadChunk(version, flags, nv, ni, ne, np.array([mnx, mny, mnz], dtype='<f4'), np.array([sx, sy, sz], dtype='<f4'), pal, pos, el, idx, ranges, guids)
