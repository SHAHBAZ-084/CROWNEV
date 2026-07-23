/**
 * One-off: update products-catalog.json retail prices from EV C.P & R.P LIST Excel.
 * Usage: npx tsx scripts/update-catalog-prices-from-xlsx.ts [--write]
 * Without --write: dry-run summary only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(backendRoot, '..');
const XLSX_PATH = path.join(repoRoot, 'EV C.P & R.P LIST (12-Feb-2026) (1).xlsx');
const CATALOG_PATH = path.join(backendRoot, 'prisma/seed-assets/products-catalog.json');

type CatalogProduct = {
  item_code: string;
  price: number;
  [key: string]: unknown;
};

type CatalogFile = {
  products: CatalogProduct[];
  [key: string]: unknown;
};

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function parsePrice(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const raw = String(value).replace(/,/g, '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function loadSheetRows(): Map<string, number> {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Missing Excel file: ${XLSX_PATH}`);
  }

  const wb = XLSX.readFile(XLSX_PATH, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  let headerRowIdx = -1;
  let colItem = -1;
  let colRp = -1;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? [];
    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeader(row[c]);
      if (h === 'ITEM CODE' || h === 'ITEMS CODE') colItem = c;
      if (h === 'RP' || h === 'R.P' || h === 'R P' || h === 'RETAIL PRICE') colRp = c;
    }
    if (colItem >= 0 && colRp >= 0) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) {
    throw new Error('Could not find header row with ITEM CODE and RP columns');
  }

  const priceByCode = new Map<string, number>();

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const itemCode = String(row[colItem] ?? '').trim();
    if (!itemCode) continue;

    const rp = parsePrice(row[colRp]);
    if (rp == null) continue;

    priceByCode.set(itemCode, rp);
  }

  return priceByCode;
}

function main() {
  const write = process.argv.includes('--write');

  const catalog: CatalogFile = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const sheetPrices = loadSheetRows();

  const catalogCodes = new Set(catalog.products.map((p) => p.item_code));
  const matchedCodes = new Set<string>();
  let updated = 0;
  let unchangedPrice = 0;

  for (const product of catalog.products) {
    const code = product.item_code;
    if (!sheetPrices.has(code)) continue;

    matchedCodes.add(code);
    const newPrice = sheetPrices.get(code)!;
    if (product.price === newPrice) {
      unchangedPrice++;
      continue;
    }
    product.price = newPrice;
    updated++;
  }

  const unmatchedInSheet: string[] = [];
  for (const code of sheetPrices.keys()) {
    if (!catalogCodes.has(code)) unmatchedInSheet.push(code);
  }
  unmatchedInSheet.sort();

  const untouchedInCatalog = catalog.products.filter((p) => !sheetPrices.has(p.item_code)).length;

  console.log('=== Retail price update summary ===');
  console.log(`Sheet rows with item_code + RP: ${sheetPrices.size}`);
  console.log(`Catalog products total:       ${catalog.products.length}`);
  console.log(`Matched & price changed:      ${updated}`);
  console.log(`Matched & price unchanged:    ${unchangedPrice}`);
  console.log(`Catalog products untouched:   ${untouchedInCatalog} (no item_code in sheet)`);
  console.log(`Sheet rows skipped (no JSON): ${unmatchedInSheet.length}`);

  if (unmatchedInSheet.length > 0) {
    console.log('\n--- Unmatched sheet item_codes (not in catalog) ---');
    for (const code of unmatchedInSheet) {
      console.log(code);
    }
  }

  const untouchedCodes = catalog.products
    .filter((p) => !sheetPrices.has(p.item_code))
    .map((p) => p.item_code);
  if (untouchedCodes.length > 0) {
    console.log('\n--- Catalog item_codes with no sheet match (untouched) ---');
    for (const code of untouchedCodes) {
      console.log(code);
    }
  }

  if (write) {
    fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(`\nWrote updated prices to ${CATALOG_PATH}`);
  } else {
    console.log('\nDry run only — re-run with --write to save changes.');
  }
}

main();
