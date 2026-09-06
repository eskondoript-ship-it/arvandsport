/**
 * Prepare a clip for the scrubbed film section.
 *
 * Swapping the footage is one command, because everything that has to be true
 * of a scrubbable video is easy to get wrong and none of it is visible until
 * someone scrolls the finished page.
 *
 * What it does, and why each part is not optional:
 *
 *   - **Finds and cuts leading black.** The first clip handed to this section
 *     opened on 2.5 seconds of black in a 5.8 second file: scroll, and nothing
 *     happened for the first half. It is a common artefact of a clipped
 *     download and it is invisible in a thumbnail, so this measures the first
 *     frames rather than trusting them. The cut lands on the first frame with
 *     real picture in it.
 *   - **Forces a constant frame rate.** A variable-rate file answers a seek
 *     with whatever frame is nearest, which is a stutter no amount of care in
 *     src/scripts/film.js can smooth out. The source here was 46.48fps
 *     average against a 60 timebase.
 *   - **Keeps keyframes close.** Seeking decodes forward from the last
 *     keyframe, so a long interval means a long wait per frame. Ten is the
 *     compromise: all-intra was 1.3MB against 616KB for the same clip.
 *   - **Moves the index to the front.** Without `+faststart` the browser
 *     cannot seek until it has the whole file, which for a scrub is the whole
 *     feature broken on a slow connection.
 *   - **Drops the audio and the resolution.** There is nothing to listen to in
 *     a scrub, and the source was 4K at 12Mbps for a picture displayed at
 *     1280 wide behind a scrim.
 *
 * It writes both codecs the section offers, a poster from the first real
 * frame, and prints the `film.sources` block to paste into content/site.json.
 *
 * Usage:  node tools/encode-scrub.mjs <input> [--name pitch] [--width 1280]
 *                                     [--fps 30] [--crf 26] [--seconds 0]
 * Needs:  python3 with imageio_ffmpeg and PIL. No system ffmpeg required --
 *         imageio_ffmpeg ships its own binary, which is the only reason this
 *         runs in an environment the rest of the repo's tooling lives in.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const INPUT = args.find((a) => !a.startsWith('--') && !(args[args.indexOf(a) - 1] || '').startsWith('--'));

if (!INPUT || !fs.existsSync(INPUT)) {
  console.error('usage: node tools/encode-scrub.mjs <input> [--name pitch] [--width 1280] [--fps 30] [--crf 26] [--seconds 0]');
  process.exit(1);
}

const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const NAME = String(flag('name', 'pitch'));
const WIDTH = Number(flag('width', 1280));
const FPS = Number(flag('fps', 30));
const CRF = Number(flag('crf', 26));
/* Cap the length. A scrub is paced by the section's height, so a long clip
   just means a lot of scrolling per second of footage; 0 keeps all of it. */
const SECONDS = Number(flag('seconds', 0));

const VIDEO_DIR = path.join(ROOT, 'static/assets/video');
const POSTER = path.join(ROOT, 'static/assets/img/ui', `${NAME}-poster.webp`);

const ffmpeg = spawnSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], {
  encoding: 'utf8',
});
if (ffmpeg.status !== 0) {
  console.error('imageio_ffmpeg is not importable; this tool needs it for the ffmpeg binary.\n' + ffmpeg.stderr);
  process.exit(1);
}
const FF = ffmpeg.stdout.trim();

const run = (list) => {
  const out = spawnSync(FF, list, { encoding: 'utf8' });
  if (out.status !== 0) {
    console.error(out.stderr || out.stdout);
    process.exit(1);
  }
  return out;
};

/* ------------------------------------------------------------------ *
 * Where does the picture start?
 * ------------------------------------------------------------------ */

/**
 * Walk forward through the head of the clip until a frame has light in it.
 *
 * Measured rather than detected with ffmpeg's blackdetect, which reported
 * nothing at all on the file this was written for -- its threshold is about
 * runs of black frames and it missed a head of them entirely. A mean
 * brightness per sampled frame is blunt, obvious, and was right.
 */
function firstLitSecond() {
  const probe = path.join(VIDEO_DIR, `.probe-${NAME}.png`);
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  let lastDark = -1;
  /* Coarse first, then fine around the boundary: sampling every 20ms across a
     long clip is a lot of decodes for a question with one answer. */
  for (const step of [0.5, 0.05]) {
    const from = step === 0.5 ? 0 : Math.max(0, lastDark);
    const to = step === 0.5 ? 20 : lastDark + 0.6;
    for (let t = from; t <= to; t += step) {
      run(['-v', 'error', '-y', '-ss', String(t.toFixed(3)), '-i', INPUT,
        '-frames:v', '1', '-vf', 'scale=160:-1', probe]);
      if (!fs.existsSync(probe)) break;
      const mean = spawnSync('python3', ['-c',
        `from PIL import Image; import numpy as np; print(np.asarray(Image.open(${JSON.stringify(probe)}).convert('L'),dtype=float).mean())`,
      ], { encoding: 'utf8' }).stdout.trim();
      if (Number(mean) >= 3) {
        if (step === 0.05) {
          fs.rmSync(probe, { force: true });
          /* One frame past the last dark one, so a boundary frame that is
             half-faded up does not become the poster. */
          return Math.min(t + 1 / FPS, t + 0.04);
        }
        break;
      }
      lastDark = t;
    }
  }
  fs.rmSync(probe, { force: true });
  return lastDark < 0 ? 0 : lastDark + 0.05;
}

const start = firstLitSecond();
if (start > 0.001) {
  console.log(`leading black: ${start.toFixed(2)}s cut from the head`);
} else {
  console.log('leading black: none');
}

/* ------------------------------------------------------------------ *
 * Encode
 * ------------------------------------------------------------------ */

const vf = `scale=${WIDTH}:-2:flags=lanczos,fps=${FPS}`;
/* -ss AFTER -i. Before it, ffmpeg seeks to the nearest keyframe at or before
   the time asked for and starts there, which puts the black straight back. */
const trim = ['-ss', String(start.toFixed(3)), ...(SECONDS > 0 ? ['-t', String(SECONDS)] : [])];

const mp4 = path.join(VIDEO_DIR, `${NAME}.mp4`);
run(['-v', 'error', '-y', '-i', INPUT, ...trim, '-an', '-vf', vf,
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', String(CRF),
  '-g', '10', '-keyint_min', '10', '-sc_threshold', '0', '-movflags', '+faststart', mp4]);

const webm = path.join(VIDEO_DIR, `${NAME}.webm`);
run(['-v', 'error', '-y', '-i', mp4, '-an',
  '-c:v', 'libvpx-vp9', '-crf', String(CRF + 8), '-b:v', '0',
  '-g', '10', '-keyint_min', '10', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3',
  '-pix_fmt', 'yuv420p', webm]);

/* Poster from the first frame of the trimmed file, so it is by construction
   the frame the section shows before the scrub starts. */
const posterPng = path.join(VIDEO_DIR, `.poster-${NAME}.png`);
run(['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', '-vf', `scale=${WIDTH}:-2`, posterPng]);
const poster = spawnSync('python3', ['-c', `
from PIL import Image
Image.open(${JSON.stringify(posterPng)}).convert('RGB').save(${JSON.stringify(POSTER)}, 'WEBP', quality=80, method=6)
`], { encoding: 'utf8' });
if (poster.status !== 0) {
  console.error(poster.stderr);
  process.exit(1);
}
fs.rmSync(posterPng, { force: true });

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const kb = (p) => `${Math.round(fs.statSync(p).size / 1024)}KB`;
const probe = spawnSync(FF, ['-i', mp4], { encoding: 'utf8' }).stderr;
const duration = /Duration: ([0-9:.]+)/.exec(probe)?.[1] ?? '?';
const stream = /Video: .*/.exec(probe)?.[0]?.slice(0, 90) ?? '';

console.log(`${NAME}.mp4  ${kb(mp4)}`);
console.log(`${NAME}.webm ${kb(webm)}`);
console.log(`${NAME}-poster.webp ${kb(POSTER)}`);
console.log(`duration ${duration}`);
console.log(`  ${stream}`);
console.log('\ncontent/site.json -> film:');
console.log(JSON.stringify({
  sources: [
    { src: `/assets/video/${NAME}.webm`, type: 'video/webm' },
    { src: `/assets/video/${NAME}.mp4`, type: 'video/mp4' },
  ],
  poster: `/assets/img/ui/${NAME}-poster.webp`,
}, null, 2));
