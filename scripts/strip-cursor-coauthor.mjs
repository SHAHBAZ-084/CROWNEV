/** Strips Cursor co-author trailer from commit messages (used by git filter-branch). */
import { readFileSync, writeFileSync } from 'fs';

const msg = readFileSync(0, 'utf8');
const cleaned = msg.replace(/^Co-authored-by: Cursor <cursoragent@cursor.com>\r?\n/gm, '');
process.stdout.write(cleaned);
