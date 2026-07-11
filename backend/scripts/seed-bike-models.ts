/**
 * Seed BikeModel rows from prisma/seed-assets/model-list.json.
 * Run only after manually reviewing model-list.json (Part A output).
 *
 * Usage:
 *   npm run db:seed-bike-models
 *   npm run db:seed-bike-models -- --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const MODEL_LIST = path.join(backendRoot, 'prisma/seed-assets/model-list.json');

type ModelListFile = {
  models: string[];
};

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs();

  if (!fs.existsSync(MODEL_LIST)) {
    throw new Error(
      `Missing ${MODEL_LIST}. Run npm run extract:models first, then review and fix the list.`,
    );
  }

  const data = JSON.parse(fs.readFileSync(MODEL_LIST, 'utf8')) as ModelListFile;
  const names = [...new Set((data.models ?? []).map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

  if (!names.length) {
    throw new Error('model-list.json contains no model names.');
  }

  console.log(`BikeModel seed: ${names.length} names from model-list.json${dryRun ? ' (dry run)' : ''}`);

  if (dryRun) {
    names.forEach((name, i) => console.log(`  ${String(i + 1).padStart(2)}. ${name}`));
    console.log('\nDry run complete — no database writes.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const name of names) {
    const existing = await prisma.bikeModel.findUnique({ where: { name } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.bikeModel.create({ data: { name } });
    created += 1;
  }

  console.log(`Done. Created: ${created} | Already existed: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
