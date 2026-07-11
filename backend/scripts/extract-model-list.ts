/**
 * One-off: extract candidate bike model names from products-catalog.json.
 * Review output at prisma/seed-assets/model-list.json before seeding BikeModel.
 *
 * Usage: npm run extract:models
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const MANIFEST = path.join(backendRoot, 'prisma/seed-assets/products-catalog.json');
const OUTPUT = path.join(backendRoot, 'prisma/seed-assets/model-list.json');

type CatalogProduct = {
  model?: string;
};

type Manifest = {
  products: CatalogProduct[];
};

function normalizeModel(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

/** Group raw catalog models by shared prefix; shortest member becomes the candidate name. */
function buildModelGroups(distinctModels: string[]) {
  const sorted = [...distinctModels].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const groups: { candidate: string; members: string[] }[] = [];

  for (const model of sorted) {
    const group = groups.find(
      (g) => model === g.candidate || model.startsWith(`${g.candidate} `),
    );
    if (group) {
      group.members.push(model);
      if (model.length < group.candidate.length) {
        group.candidate = model;
      }
    } else {
      groups.push({ candidate: model, members: [model] });
    }
  }

  // Merge groups whose candidates are prefixes of one another (e.g. FLASH vs FLASH EDGE if split).
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i];
        const b = groups[j];
        const short = a.candidate.length <= b.candidate.length ? a : b;
        const long = a.candidate.length <= b.candidate.length ? b : a;
        if (long.candidate === short.candidate || long.candidate.startsWith(`${short.candidate} `)) {
          const combined = {
            candidate: short.candidate,
            members: [...new Set([...short.members, ...long.members])],
          };
          groups.splice(j, 1);
          groups[i] = combined;
          merged = true;
          break outer;
        }
      }
    }
  }

  return groups;
}

function rawToCandidate(raw: string, groups: { candidate: string; members: string[] }[]) {
  const normalized = normalizeModel(raw);
  const group = groups.find(
    (g) => normalized === g.candidate || normalized.startsWith(`${g.candidate} `),
  );
  return group?.candidate ?? normalized;
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`Missing ${MANIFEST}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;
  const products = manifest.products ?? [];

  const distinctRaw = [
    ...new Set(
      products
        .map((p) => (p.model ? normalizeModel(p.model) : ''))
        .filter(Boolean),
    ),
  ];

  const groups = buildModelGroups(distinctRaw);
  const candidates = groups.map((g) => g.candidate).sort((a, b) => a.localeCompare(b));

  const counts = new Map<string, number>();
  for (const p of products) {
    if (!p.model) continue;
    const candidate = rawToCandidate(p.model, groups);
    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'products-catalog.json',
    distinctRawModels: distinctRaw.length,
    candidateCount: candidates.length,
    models: candidates,
  };

  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${OUTPUT}`);
  console.log(`Distinct raw models: ${distinctRaw.length} → ${candidates.length} candidates\n`);
  console.log('Candidate model name'.padEnd(36) + 'Parts matched');
  console.log('-'.repeat(52));

  for (const name of candidates) {
    const count = counts.get(name) ?? 0;
    console.log(`${name.padEnd(36)}${count}`);
  }
}

main();
