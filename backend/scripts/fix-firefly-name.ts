/**
 * One-off migration: rename "FIRE FLY" → "FIREFLY" in live database rows.
 *
 * Usage:
 *   npm run db:fix-firefly-name
 *   npm run db:fix-firefly-name -- --dry-run
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FROM = 'FIRE FLY';
const TO = 'FIREFLY';

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

function replaceIfNeeded(value: string | null | undefined): string | null | undefined {
  if (value == null || !value.includes(FROM)) return undefined;
  return value.replaceAll(FROM, TO);
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(`Fix Firefly name: "${FROM}" → "${TO}"${dryRun ? ' (dry run)' : ''}`);

  let productUpdates = 0;
  let bikePartDetailUpdates = 0;
  let bikeModelUpdates = 0;

  await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        OR: [{ name: { contains: FROM } }, { model: { contains: FROM } }],
      },
      select: { id: true, name: true, model: true },
    });

    for (const product of products) {
      const data: { name?: string; model?: string | null } = {};
      const name = replaceIfNeeded(product.name);
      const model = replaceIfNeeded(product.model);
      if (name !== undefined) data.name = name;
      if (model !== undefined) data.model = model;
      if (Object.keys(data).length === 0) continue;

      if (!dryRun) {
        await tx.product.update({ where: { id: product.id }, data });
      }
      productUpdates += 1;
    }

    const partDetails = await tx.bikePartDetail.findMany({
      where: { modelCompatibility: { contains: FROM } },
      select: { id: true, modelCompatibility: true },
    });

    for (const detail of partDetails) {
      const modelCompatibility = replaceIfNeeded(detail.modelCompatibility);
      if (modelCompatibility === undefined) continue;

      if (!dryRun) {
        await tx.bikePartDetail.update({
          where: { id: detail.id },
          data: { modelCompatibility },
        });
      }
      bikePartDetailUpdates += 1;
    }

    const bikeModels = await tx.bikeModel.findMany({
      where: { name: { contains: FROM } },
      select: { id: true, name: true },
    });

    for (const bikeModel of bikeModels) {
      const name = replaceIfNeeded(bikeModel.name);
      if (name === undefined) continue;

      if (!dryRun) {
        await tx.bikeModel.update({
          where: { id: bikeModel.id },
          data: { name },
        });
      }
      bikeModelUpdates += 1;
    }
  });

  console.log('Summary:');
  console.log(`  Product rows updated:       ${productUpdates}`);
  console.log(`  BikePartDetail rows updated: ${bikePartDetailUpdates}`);
  console.log(`  BikeModel rows updated:      ${bikeModelUpdates}`);

  if (dryRun) {
    console.log('\nDry run complete — no database writes.');
  } else {
    console.log('\nDone.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
