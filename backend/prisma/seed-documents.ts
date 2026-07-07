import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DOCUMENTS = [
  { name: 'Warranty Card', sortOrder: 1 },
  { name: 'Registration Card', sortOrder: 2 },
  { name: 'Registration Letter', sortOrder: 3 },
  { name: 'Sale Tax Invoice', sortOrder: 4 },
  { name: 'Form F', sortOrder: 5 },
];

async function main() {
  console.log('Seeding document types...');
  for (const doc of DEFAULT_DOCUMENTS) {
    await prisma.documentType.upsert({
      where: { name: doc.name },
      update: { sortOrder: doc.sortOrder },
      create: { name: doc.name, sortOrder: doc.sortOrder },
    });
  }
  console.log('Document types seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
