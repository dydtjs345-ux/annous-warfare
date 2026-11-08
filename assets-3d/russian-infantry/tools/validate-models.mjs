/** Official Khronos validation plus asset-specific checks on actual GLB geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = { validator: 'Khronos glTF-Validator 2.0.0-dev.3.10', files: [] };
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const types = { 5120: ['getInt8', 1], 5121: ['getUint8', 1], 5122: ['getInt16', 2], 5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4] };

function parse(buf) {
  assert.equal(buf.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(buf.readUInt32LE(4), 2, 'glTF 2.0');
  assert.equal(buf.readUInt32LE(8), buf.length, 'Complete GLB, not a truncated file');
  let gltf, bin;
  for (let o = 12; o < buf.length;) {
    const length = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4);
    const chunk = buf.subarray(o + 8, o + 8 + length);
    if (type === 0x4e4f534a) gltf = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    o += 8 + length;
  }
  assert.ok(gltf && bin, 'Real JSON and BIN chunks');
  return { gltf, bin };
}

function accessor(gltf, bin, id) {
  const a = gltf.accessors[id], v = gltf.bufferViews[a.bufferView];
  assert.ok(!a.sparse && v, 'Ordinary resident mesh accessor');
  const [getter, bytes] = types[a.componentType], n = sizes[a.type];
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const stride = v.byteStride ?? n * bytes, offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, j) => {
    let x = view[getter](offset + i * stride + j * bytes, true);
    if (a.normalized && a.componentType !== 5126) x /= 2 ** (bytes * 8) - 1;
    assert.ok(Number.isFinite(x), 'Finite geometry');
    return x;
  }));
}

for (const file of ['Russian_Infantry_Kit.glb', 'Russian_Infantry_Apose.glb', 'AK74M.glb']) {
  const data = await fs.readFile(path.join(root, 'models', file));
  const official = await validator.validateBytes(new Uint8Array(data), { uri: file, maxIssues: 1000 });
  const { gltf: g, bin } = parse(data);
  assert.equal(official.issues.numErrors, 0, `${file}: official glTF errors`);
  assert.equal(official.issues.numWarnings, 0, `${file}: official glTF portability warnings`);
  assert.ok(g.images?.length >= 3 && g.images.every(im => im.bufferView !== undefined && im.mimeType === 'image/png'), 'Embedded PBR PNGs, no missing external assets');
  assert.ok(!g.animations?.length, 'Neutral A-pose, no unrequested animation clips');
  let triangles = 0, vertices = 0, degenerateTriangles = 0, weightedVertices = 0;
  const meshes = [];
  for (let mi = 0; mi < g.meshes.length; mi++) {
    const m = g.meshes[mi], bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const p of m.primitives) {
      assert.equal(p.mode ?? 4, 4, 'Triangulated game mesh');
      assert.ok(p.attributes.NORMAL !== undefined && p.attributes.TANGENT !== undefined && p.attributes.TEXCOORD_0 !== undefined, 'Normals, explicit tangents and UVs');
      const material = g.materials[p.material];
      assert.ok(material.pbrMetallicRoughness.baseColorTexture && material.normalTexture, 'Baked albedo and tangent normal material');
      const pos = accessor(g, bin, p.attributes.POSITION), index = accessor(g, bin, p.indices).flat();
      vertices += pos.length; triangles += index.length / 3;
      for (const xyz of pos) for (let k = 0; k < 3; k++) {
        bounds.min[k] = Math.min(bounds.min[k], xyz[k]); bounds.max[k] = Math.max(bounds.max[k], xyz[k]);
      }
      for (let i = 0; i < index.length; i += 3) {
        const a = pos[index[i]], b = pos[index[i + 1]], c = pos[index[i + 2]];
        assert.ok(a && b && c, 'All triangle indices in bounds');
        const u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]);
        const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (cross.reduce((sum, x) => sum + x * x, 0) < 1e-20) degenerateTriangles++;
      }
      if (p.attributes.WEIGHTS_0 !== undefined) {
        assert.equal(p.attributes.WEIGHTS_1, undefined, 'At most four skin influences');
        const ws = accessor(g, bin, p.attributes.WEIGHTS_0), js = accessor(g, bin, p.attributes.JOINTS_0);
        assert.equal(ws.length, pos.length);
        for (let i = 0; i < ws.length; i++) {
          assert.ok(Math.abs(ws[i].reduce((a, b) => a + b, 0) - 1) < .0002, 'Normalized skin weights');
          assert.ok(ws[i].every(w => w >= 0 && w <= 1));
          assert.ok(js[i].every(j => j < g.skins[0].joints.length), 'Skin joint indices');
        }
        weightedVertices += ws.length;
      }
    }
    const dimensions = bounds.max.map((x, k) => x - bounds.min[k]);
    assert.ok(dimensions.every(d => d > .02), 'Real volumetric mesh, not a billboard');
    meshes.push({ name: m.name, bounds, dimensionsMetres: dimensions });
  }
  assert.equal(degenerateTriangles, 0, `${file}: no zero-area triangles`);
  const magazineNode=g.nodes.find(n=>n.name==='AK74M_Magazine');
  if(!file.includes('Apose'))assert.ok(magazineNode && magazineNode.skin===undefined,'Detachable rigid magazine');
  const weaponNode = g.nodes.find(n => n.name === 'AK74M_Separate_Weapon');
  if (file.includes('Kit')) {
    assert.equal(g.meshes.length, 3, 'Character, separate weapon and detachable magazine');
    assert.ok(weaponNode && weaponNode.skin === undefined, 'Weapon is independent from the character skin');
    assert.ok(g.skins?.length === 1 && weightedVertices > 10000);
  }
  if (file.includes('Apose')) {
    assert.equal(g.meshes.length, 1); assert.ok(g.skins?.[0].joints.length >= 60);
    const height = meshes[0].dimensionsMetres[1];
    assert.ok(height > 1.75 && height < 1.9, 'Plausible metre-scale adult height in glTF Y-up');
  }
  if (file === 'AK74M.glb') {
    assert.equal(g.meshes.length, 2); assert.equal(weightedVertices, 0);
    assert.ok(Math.max(...meshes.find(m=>m.name==='AK74M_Separate_Weapon').dimensionsMetres) > .93 && Math.max(...meshes.find(m=>m.name==='AK74M_Separate_Weapon').dimensionsMetres) < .96, 'Full-length rifle scale');
  }
  const entry = { file, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), triangles, exportedVertices: vertices, weightedVertices, bones: g.skins?.[0].joints.length ?? 0, embeddedImages: g.images.length, degenerateTriangles, meshes, khronos: official.issues };
  report.files.push(entry);
  console.log(`${file}: ${triangles} triangles, ${official.issues.numErrors} errors, ${official.issues.numWarnings} warnings`);
}
await fs.mkdir(path.join(root, 'validation'), { recursive: true });
await fs.writeFile(path.join(root, 'validation', 'glb-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log('All actual GLB exports passed structural, PBR, skin, scale and Khronos checks.');
