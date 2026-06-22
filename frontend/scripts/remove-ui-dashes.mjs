import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(name)) files.push(full);
  }
  return files;
}

function clean(content) {
  let s = content;
  // En dash ranges → "to"
  s = s.replace(/ – /g, ' to ');
  // Em dash as clause break → period space
  s = s.replace(/ — /g, '. ');
  // Remaining em/en dashes
  s = s.replace(/—/g, '');
  s = s.replace(/–/g, ' to ');
  // Empty-cell placeholder
  s = s.replace(/''/g, "''"); // no-op keep
  s = s.replace(/'—'/g, "''");
  s = s.replace(/"—"/g, '""');
  // Hyphenated UI labels (not CSS classes or routes)
  s = s.replace(/View-only/g, 'View only');
  s = s.replace(/Walk-in/g, 'Walk in');
  // Double spaces after period fix
  s = s.replace(/\.  +/g, '. ');
  // Fix broken line breaks like "carries .\n"
  s = s.replace(/carries \.\s*\n\s*search/g, 'carries. Search');
  return s;
}

let changed = 0;
for (const file of walk(root)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = clean(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
    console.log(path.relative(root, file));
  }
}
console.log(`Updated ${changed} files`);
