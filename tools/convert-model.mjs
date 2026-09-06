/**
 * Convert a supplied 3D model into the GLB the scene can load.
 *
 * The models people send arrive in whatever their modeller exported: .3ds from
 * 2008, .obj, .fbx. The scene loads GLB and only GLB, so something has to do
 * the translation, and the honest place for it is here rather than in a
 * one-off conversion nobody can repeat when a new file turns up.
 *
 * three.js does the reading, in a real browser, for the same reason
 * render-sprite.mjs renders there: the loaders are the same ones the site
 * ships, so what comes out is by construction something the scene can open.
 * GLTFExporter writes the result back out.
 *
 * What it does beyond loading:
 *
 *   - Centres the model on its own bounding box and scales it to a unit
 *     radius. An archive model arrives at whatever scale and origin its author
 *     used -- this stadium is 300 units across and sits off in the corner of
 *     its own space -- and a scene that has to know each model's quirks is a
 *     scene that breaks when a model is replaced. Everything comes out of here
 *     centred, one unit, +Y up.
 *   - Drops textures and materials down to one flat standard material. A .3ds
 *     names texture files that are not in the archive, so its materials
 *     reference images that do not exist; the scene shades these itself
 *     anyway.
 *   - Optionally welds and decimates, because archive geometry is rarely built
 *     for a browser.
 *
 * Usage:  node tools/convert-model.mjs <input> <output.glb> [--scale 1]
 *                                      [--up y|z] [--max-tris 40000]
 * Needs:  experience/node_modules (three, esbuild) and playwright.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const [INPUT, OUTPUT] = positional;

if (!INPUT || !OUTPUT) {
  console.error('usage: node tools/convert-model.mjs <input> <output.glb> [--scale 1] [--up y|z] [--max-tris 40000]');
  process.exit(1);
}

const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const SCALE = Number(flag('scale', 1));
/* 3ds and many CAD exports are Z-up; three is Y-up. Getting this wrong lays a
   stadium on its side, which is the first thing to check if a converted model
   looks wrong. */
const UP = String(flag('up', 'z')).toLowerCase();
const MAX_TRIS = Number(flag('max-tris', 40000));
/* A model that is only ever drawn as a wireframe, or with a basic material, is
   never shaded -- and a normal is twelve bytes a vertex that nothing reads. On
   the stadium that is a third of the file. */
const DROP_NORMALS = args.includes('--no-normals');

const ext = path.extname(INPUT).toLowerCase();
const LOADERS = {
  '.3ds': ['TDSLoader', 'TDSLoader.js'],
  '.fbx': ['FBXLoader', 'FBXLoader.js'],
  '.obj': ['OBJLoader', 'OBJLoader.js'],
  '.glb': ['GLTFLoader', 'GLTFLoader.js'],
  '.gltf': ['GLTFLoader', 'GLTFLoader.js'],
};
if (!LOADERS[ext]) {
  console.error(`no loader for ${ext}; have ${Object.keys(LOADERS).join(', ')}`);
  process.exit(1);
}
const [loaderName, loaderFile] = LOADERS[ext];

const page = `<!doctype html><html><head><meta charset="utf-8"></head>
<body><script src="./bundle.js"></script></body></html>`;

const entry = `
import * as THREE from 'three';
import { ${loaderName} } from 'three/examples/jsm/loaders/${loaderFile}';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SCALE = ${SCALE}, UP = ${JSON.stringify(UP)}, MAX_TRIS = ${MAX_TRIS};
const DROP_NORMALS = ${DROP_NORMALS};

new ${loaderName}().load('./model${ext}', (loaded) => {
  const model = loaded.scene || loaded;
  const report = { meshes: 0, trisIn: 0, trisOut: 0 };

  /* One material for everything. The archive's own materials point at texture
     files the archive does not contain, and the scene lights and shades this
     itself -- keeping them would ship a pile of broken image references. */
  model.traverse((child) => {
    if (!child.isMesh) return;
    report.meshes++;
    let geometry = child.geometry;
    geometry.deleteAttribute('uv');
    geometry.deleteAttribute('uv1');
    geometry.deleteAttribute('color');
    const before = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    report.trisIn += before;

    /* Weld first: an exporter that wrote every triangle as three loose
       vertices makes the file several times bigger than the shape needs and
       leaves the normals faceted along edges that are meant to be smooth. */
    try {
      geometry = mergeVertices(geometry, 1e-4);
    } catch { /* a geometry that cannot be welded is used as it came */ }
    if (DROP_NORMALS) geometry.deleteAttribute('normal');
    else geometry.computeVertexNormals();
    child.geometry = geometry;
    report.attrs = Object.keys(geometry.attributes).join(',');
    report.trisOut += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

    child.material = new THREE.MeshStandardMaterial({
      color: 0xb9c6d4,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
      flatShading: false,
    });
  });

  /* Z-up to Y-up, applied to the geometry rather than left as a rotation on a
     wrapper: a caller should be able to drop this into a scene without knowing
     which way its author thought was up. */
  if (UP === 'z') model.rotation.x = -Math.PI / 2;
  model.updateMatrixWorld(true);

  /* Centre, and normalise to a unit radius. */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;

  const wrapper = new THREE.Group();
  wrapper.add(model);
  model.position.sub(centre.clone().multiplyScalar(1));
  wrapper.scale.setScalar((1 / radius) * SCALE);

  report.sizeIn = [size.x, size.y, size.z].map((n) => Math.round(n * 100) / 100);
  report.radius = Math.round(radius * 100) / 100;
  report.overBudget = report.trisOut > MAX_TRIS;

  new GLTFExporter().parse(
    wrapper,
    (glb) => {
      window.__glb = Array.from(new Uint8Array(glb));
      window.__report = report;
    },
    (error) => { window.__error = String(error); },
    { binary: true },
  );
}, undefined, (error) => { window.__error = String(error && error.message || error); });
`;

const tmp = fs.mkdtempSync(path.join(ROOT, 'experience', '.convert-'));
fs.writeFileSync(path.join(tmp, 'entry.mjs'), entry);
fs.writeFileSync(path.join(tmp, 'index.html'), page);
fs.copyFileSync(INPUT, path.join(tmp, `model${ext}`));

const esbuild = path.join(ROOT, 'experience/node_modules/.bin/esbuild');
const built = spawnSync(esbuild, [
  path.join(tmp, 'entry.mjs'),
  '--bundle',
  '--format=iife',
  `--outfile=${path.join(tmp, 'bundle.js')}`,
], { cwd: path.join(ROOT, 'experience'), encoding: 'utf8' });
if (built.status !== 0) {
  console.error(built.stderr || built.stdout);
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const name = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(tmp, path.basename(name));
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((done) => server.listen(8198, done));

const { chromium } = process.env.PLAYWRIGHT_PATH
  ? await import(path.resolve(process.env.PLAYWRIGHT_PATH))
  : await import('playwright');

const browser = await chromium.launch();
const tab = await browser.newPage();
tab.on('pageerror', (e) => console.error('[page]', e.message));
await tab.goto('http://localhost:8198/', { waitUntil: 'networkidle' });
await tab.waitForFunction(() => window.__glb || window.__error, null, { timeout: 180000 });

const failed = await tab.evaluate(() => window.__error || null);
if (failed) {
  console.error('load failed:', failed);
  await browser.close();
  server.close();
  process.exit(1);
}
const bytes = await tab.evaluate(() => window.__glb);
const report = await tab.evaluate(() => window.__report);
await browser.close();
server.close();

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, Buffer.from(bytes));
fs.rmSync(tmp, { recursive: true, force: true });

const kb = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`${path.basename(OUTPUT)}  ${kb}KB`);
console.log(`  meshes ${report.meshes}, triangles ${report.trisIn} -> ${report.trisOut}` +
  (report.overBudget ? `  OVER the ${MAX_TRIS} budget` : ''));
console.log(`  source size ${report.sizeIn.join(' x ')} (radius ${report.radius}), written centred at unit radius`);
