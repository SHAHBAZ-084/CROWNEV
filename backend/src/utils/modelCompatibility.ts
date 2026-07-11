import type { Prisma } from '@prisma/client';

/** Comma-separated storage for BikePartDetail.modelCompatibility */
export function encodeModelCompatibility(models: string[]): string | null {
  const names = [...new Set(models.map((m) => m.trim()).filter(Boolean))];
  return names.length ? names.join(',') : null;
}

export function parseModelCompatibility(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Prisma filter: stored CSV matches an exact model name token. */
export function modelCompatibilityFilter(modelName: string): Prisma.BikePartDetailWhereInput {
  const name = modelName.trim();
  return {
    OR: [
      { modelCompatibility: name },
      { modelCompatibility: { startsWith: `${name},` } },
      { modelCompatibility: { contains: `,${name},` } },
      { modelCompatibility: { endsWith: `,${name}` } },
    ],
  };
}
