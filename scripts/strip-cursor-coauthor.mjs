/** Strips Cursor co-author trailer from commit messages. */
import { readFileSync, writeFileSync } from 'fs';

const CURSOR_COAUTHOR =
  /^Co-authored-by:\s*Cursor\s*<cursoragent@cursor\.com>\s*(\r?\n|$)/gim;

const strip = (msg) =>
  msg
    .replace(CURSOR_COAUTHOR, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '');

const file = process.argv[2];
if (file) {
  writeFileSync(file, strip(readFileSync(file, 'utf8')), 'utf8');
} else {
  process.stdout.write(strip(readFileSync(0, 'utf8')));
}
