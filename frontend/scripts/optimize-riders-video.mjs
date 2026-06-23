import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const input = resolve(root, 'lv_0_20260623101516.mp4');
const outDir = resolve(__dirname, '../public/videos');

if (!ffmpegPath) {
  console.error('ffmpeg-static binary not found');
  process.exit(1);
}
if (!existsSync(input)) {
  console.error('Source video not found:', input);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const ff = (args) => execFileSync(ffmpegPath, args, { stdio: 'inherit' });

const mp4 = join(outDir, 'riders-say.mp4');
const mp4Mobile = join(outDir, 'riders-say-mobile.mp4');
const webm = join(outDir, 'riders-say.webm');
const posterJpg = join(outDir, '_poster-temp.jpg');

console.log('Encoding desktop MP4…');
ff([
  '-y', '-i', input,
  '-an',
  '-vf', 'scale=1280:-2',
  '-c:v', 'libx264',
  '-crf', '28',
  '-preset', 'medium',
  '-movflags', '+faststart',
  '-pix_fmt', 'yuv420p',
  mp4,
]);

console.log('Encoding mobile MP4…');
ff([
  '-y', '-i', input,
  '-an',
  '-vf', 'scale=720:-2',
  '-c:v', 'libx264',
  '-crf', '30',
  '-preset', 'medium',
  '-movflags', '+faststart',
  '-pix_fmt', 'yuv420p',
  mp4Mobile,
]);

console.log('Encoding WebM…');
ff([
  '-y', '-i', input,
  '-an',
  '-vf', 'scale=1280:-2',
  '-c:v', 'libvpx-vp9',
  '-crf', '35',
  '-b:v', '0',
  '-row-mt', '1',
  webm,
]);

console.log('Extracting poster frame…');
ff(['-y', '-ss', '1', '-i', input, '-frames:v', '1', '-vf', 'scale=1280:-2', '-update', '1', posterJpg]);

console.log('Creating WebP posters…');
await sharp(posterJpg)
  .webp({ quality: 82, effort: 4 })
  .toFile(join(outDir, 'riders-say-poster.webp'));

await sharp(posterJpg)
  .resize(768)
  .webp({ quality: 78, effort: 4 })
  .toFile(join(outDir, 'riders-say-poster-sm.webp'));

unlinkSync(posterJpg);
console.log('Done. Assets written to', outDir);
