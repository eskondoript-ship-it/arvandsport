/**
 * Render the hero's rotation sprite from the ball that is actually in the scene.
 *
 * The sprite is what everyone sees first and what phones see for good: the
 * WebGL hero is desktop-only and takes a moment to mount even there, so for the
 * first second of every visit the sprite is the ball. When it was rendered from
 * a different model than the scene uses, the page opened on one ball and
 * swapped to another in front of the visitor.
 *
 * So it is rendered from the same file the scene loads, with three.js, in a
 * real browser. There is no offline path that would be honest here -- the
 * ball's own textures and its glassy finish come out of the GLB's materials,
 * and reimplementing those in a rasteriser would produce a picture of a
 * different ball again.
 *
 * The browser also composes the sheet. Reading thirty PNGs back into Node and
 * tiling them needs an image library the root has no business depending on;
 * a canvas 6 by 5 tiles wide costs one drawImage per frame and comes back as
 * one file.
 *
 * Usage:  node tools/render-sprite.mjs [--frames 30] [--size 300]
 * Needs:  experience/node_modules (three, esbuild) and playwright.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = path.join(ROOT, 'experience/public/models/soccer-ball.glb');
const OUT_DIR = path.join(ROOT, 'static/assets/img/ui');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(args[at + 1]);
};
const FRAMES = flag('frames', 30);
const SIZE = flag('size', 300);
const COLS = 6;
const ROWS = Math.ceil(FRAMES / COLS);

/* The scene's own opening pose, so the swap from sprite to canvas does not
   also rotate the ball. Chapter one holds it a little above the equator. */
const TILT = -14;

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  canvas{display:block}
</style></head><body>
<script src="./bundle.js"></script>
</body></html>`;

const entry = `
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SIZE = ${SIZE}, FRAMES = ${FRAMES}, COLS = ${COLS}, ROWS = ${ROWS}, TILT = ${TILT};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE * 2, SIZE * 2, false);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
/* Framed by arithmetic rather than by eye: the ball is normalised to a unit
   radius below, so the distance that makes it fill FILL of the frame follows
   from the field of view. Guessing a distance is how the first pass rendered a
   ball a quarter the size of the tile. */
const FOV = 30, FILL = 0.86;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
camera.position.set(0, 0, 1 / (FILL * Math.tan(THREE.MathUtils.degToRad(FOV) / 2)));
camera.lookAt(0, 0, 0);

/* Roughly the hero's light rig: a white key, a cool fill from behind left, and
   a generated room for the reflections the panels' clearcoat needs. Matching it
   exactly is not the point -- looking like the same object under the same
   lights is. */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(4.5, 6, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x7fb6ff, 1.1);
fill.position.set(-6, -1.5, -3);
scene.add(fill);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const spin = new THREE.Group();
const tilt = new THREE.Group();
tilt.rotation.x = THREE.MathUtils.degToRad(TILT);
tilt.add(spin);
scene.add(tilt);

new GLTFLoader().load('./ball.glb', (gltf) => {
  const ball = gltf.scene;
  /* Centre it and give it a known radius, so the framing does not depend on
     how the model happens to be authored. */
  const box = new THREE.Box3().setFromObject(ball);
  const size = box.getSize(new THREE.Vector3());
  /* Half the widest side, which for a ball is its radius. Box3's own bounding
     sphere circumscribes the box instead, so it reports r * sqrt(3) and the
     ball comes out at 58% of the size it should be. */
  const radius = Math.max(size.x, size.y, size.z) / 2;
  ball.position.sub(box.getCenter(new THREE.Vector3()));
  ball.scale.setScalar(1 / radius);
  spin.add(ball);

  const sheet = document.createElement('canvas');
  sheet.width = SIZE * COLS;
  sheet.height = SIZE * ROWS;
  const ctx = sheet.getContext('2d');

  for (let i = 0; i < FRAMES; i++) {
    spin.rotation.y = (i / FRAMES) * Math.PI * 2;
    renderer.render(scene, camera);
    ctx.drawImage(
      renderer.domElement,
      (i % COLS) * SIZE, Math.floor(i / COLS) * SIZE, SIZE, SIZE,
    );
  }

  window.__sheet = sheet.toDataURL('image/png');
});
`;

/* Inside experience/, not the system temp directory: esbuild resolves a bare
   import from the entry file's own directory, and three lives here. */
const tmp = fs.mkdtempSync(path.join(ROOT, 'experience', '.sprite-'));
fs.writeFileSync(path.join(tmp, 'entry.mjs'), entry);
fs.writeFileSync(path.join(tmp, 'index.html'), page);
fs.copyFileSync(MODEL, path.join(tmp, 'ball.glb'));

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

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const name = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(tmp, path.basename(name));
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((done) => server.listen(8199, done));

/* The root package has no dependencies on purpose -- CI runs the build with
   nothing installed -- so playwright is wherever the person running this has
   it. PLAYWRIGHT_PATH points at it when that is not the module path. */
const { chromium } = process.env.PLAYWRIGHT_PATH
  ? await import(path.resolve(process.env.PLAYWRIGHT_PATH))
  : await import('playwright');

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const tab = await browser.newPage({ viewport: { width: 800, height: 800 } });
tab.on('pageerror', (e) => console.error('[page]', e.message));
await tab.goto('http://localhost:8199/', { waitUntil: 'networkidle' });
await tab.waitForFunction(() => Boolean(window.__sheet), null, { timeout: 120000 });
const data = await tab.evaluate(() => window.__sheet);
await browser.close();
server.close();

const png = path.join(tmp, 'sheet.png');
fs.writeFileSync(png, Buffer.from(data.split(',')[1], 'base64'));

/* WebP and the single still come from PIL: the browser writes PNG only, and
   the rest of the image pipeline in this repo is Python already. */
const convert = spawnSync('python3', ['-c', `
from PIL import Image
sheet = Image.open(${JSON.stringify(png)}).convert('RGBA')
# 68, not the 82 this started at. The Trionda is a busy, saturated texture and
# the sheet is thirty copies of it: 82 costs 479KB against 343, for a difference
# nobody can see at the 430px the sprite is ever drawn at.
sheet.save(${JSON.stringify(path.join(OUT_DIR, 'ball-sheet.webp'))}, 'WEBP', quality=68, method=6)
still = sheet.crop((0, 0, ${SIZE}, ${SIZE})).resize((420, 420), Image.LANCZOS)
still.save(${JSON.stringify(path.join(OUT_DIR, 'ball-still.webp'))}, 'WEBP', quality=88, method=6)
print('sheet', sheet.size)
`], { encoding: 'utf8' });
if (convert.status !== 0) {
  console.error(convert.stderr);
  process.exit(1);
}

const kb = (p) => `${Math.round(fs.statSync(p).size / 1024)}KB`;
console.log(convert.stdout.trim());
console.log(`ball-sheet.webp ${kb(path.join(OUT_DIR, 'ball-sheet.webp'))}, `
  + `ball-still.webp ${kb(path.join(OUT_DIR, 'ball-still.webp'))}`);
fs.rmSync(tmp, { recursive: true, force: true });
