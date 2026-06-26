/** Strips Cursor co-author trailer from commit messages. */
import { readFileSync, writeFileSync } from 'fs';

const strip = (msg) =>
  msg.replace(/^Co-authored-by: Cursor <cursoragent@cursor.com>\r?\n/gm, '');

const file = process.argv[2];
if (file) {
  writeFileSync(file, strip(readFileSync(file, 'utf8')), 'utf8');
} else {
  process.stdout.write(strip(readFileSync(0, 'utf8')));
}
