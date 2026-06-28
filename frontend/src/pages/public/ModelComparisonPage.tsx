import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { publicApi } from '../../api/client';
import type { Product } from '../../types';
import { MotionSection } from '../../components/public/MotionSection';
import { PageHero } from '../../components/public/PageHero';
import { Select } from '../../components/ui/Input';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { formatPKR } from '../../lib/format';
import { getSpecDefault, normalizeProductSpecs, type EvSpecKey } from '../../lib/evSpecs';
import { resolveUploadUrl } from '../../lib/media';
import { ctaArrowClass } from '../../lib/publicMotion';

type CompareMode = 'lower' | 'higher' | 'none';

type ComparisonRowDef = {
  label: string;
  getDisplay: (product: Product) => string | null;
  getNumeric?: (product: Product) => number | null;
  compare: CompareMode;
};

function productSpecs(product: Product) {
  return normalizeProductSpecs(product.specs as Record<string, unknown> | null);
}

function pickSpec(product: Product, ...keys: EvSpecKey[]): string | null {
  const specs = productSpecs(product);
  for (const key of keys) {
    const value = getSpecDefault(specs, key);
    if (value) return value;
  }
  return null;
}

function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function productImage(product: Product) {
  const url = product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url;
  return resolveUploadUrl(url);
}

function productPrice(product: Product) {
  return Number(product.salePrice ?? product.price);
}

function shortName(name: string, max = 22) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const COMPARISON_ROWS: ComparisonRowDef[] = [
  {
    label: 'Price',
    getDisplay: (p) => formatPKR(productPrice(p)),
    getNumeric: productPrice,
    compare: 'lower',
  },
  {
    label: 'Top Speed',
    getDisplay: (p) => {
      const max = pickSpec(p, 'speed_max_kmh');
      const min = pickSpec(p, 'speed_min_kmh');
      if (max && min && max !== min) return `${min}–${max} km/h`;
      const value = max ?? min;
      return value ? `${value} km/h` : null;
    },
    getNumeric: (p) =>
      parseNumeric(pickSpec(p, 'speed_max_kmh') ?? pickSpec(p, 'speed_min_kmh')),
    compare: 'higher',
  },
  {
    label: 'Range Per Charge',
    getDisplay: (p) => {
      const max = pickSpec(p, 'range_eco_max_km');
      const min = pickSpec(p, 'range_eco_min_km');
      if (max && min && max !== min) return `${min}–${max} km`;
      const value = max ?? min;
      return value ? `${value} km` : null;
    },
    getNumeric: (p) =>
      parseNumeric(pickSpec(p, 'range_eco_max_km') ?? pickSpec(p, 'range_eco_min_km')),
    compare: 'higher',
  },
  {
    label: 'Motor Power',
    getDisplay: (p) => {
      const max = pickSpec(p, 'motor_watt_max');
      const min = pickSpec(p, 'motor_watt_min');
      if (max && min && max !== min) return `${min}–${max} W`;
      const value = max ?? min;
      return value ? (value.toUpperCase().includes('W') ? value : `${value} W`) : null;
    },
    getNumeric: (p) =>
      parseNumeric(pickSpec(p, 'motor_watt_max') ?? pickSpec(p, 'motor_watt_min')),
    compare: 'higher',
  },
  {
    label: 'Battery Capacity',
    getDisplay: (p) => {
      const ah = pickSpec(p, 'battery_capacity_ah');
      const voltage = pickSpec(p, 'battery_voltage');
      if (ah && voltage) return `${ah} / ${voltage}`;
      return ah ?? voltage;
    },
    getNumeric: (p) => parseNumeric(pickSpec(p, 'battery_capacity_ah')),
    compare: 'higher',
  },
  {
    label: 'Charging Time',
    getDisplay: (p) => {
      const min = pickSpec(p, 'charging_time_min_hrs');
      const max = pickSpec(p, 'charging_time_max_hrs');
      if (min && max && min !== max) return `${min}–${max} hrs`;
      const value = min ?? max;
      return value ? `${value} hrs` : null;
    },
    getNumeric: (p) =>
      parseNumeric(pickSpec(p, 'charging_time_min_hrs') ?? pickSpec(p, 'charging_time_max_hrs')),
    compare: 'lower',
  },
  {
    label: 'Brakes',
    getDisplay: (p) => pickSpec(p, 'braking_system'),
    compare: 'none',
  },
  {
    label: 'Tyre Type',
    getDisplay: (p) => pickSpec(p, 'wheel_size'),
    compare: 'none',
  },
  {
    label: 'Body Type',
    getDisplay: (p) => pickSpec(p, 'frame_material'),
    compare: 'none',
  },
];

function bestSide(a: number | null, b: number | null, mode: CompareMode): 0 | 1 | null {
  if (mode === 'none' || a === null || b === null || a === b) return null;
  if (mode === 'lower') return a < b ? 0 : 1;
  return a > b ? 0 : 1;
}

const winnerCellClass = 'bg-green-50 font-semibold text-green-700';
const valueCellClass = 'bg-subtle text-ink';

function BikePicker({
  label,
  bikes,
  value,
  onChange,
  disabledIds,
}: {
  label: string;
  bikes: Product[];
  value: string;
  onChange: (id: string) => void;
  disabledIds?: string[];
}) {
  return (
    <Select
      id={label.replace(/\s+/g, '-').toLowerCase()}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-base sm:text-sm"
    >
      {bikes.map((bike) => (
        <option key={bike.id} value={bike.id} disabled={disabledIds?.includes(bike.id)}>
          {bike.name}
        </option>
      ))}
    </Select>
  );
}

function BikePreview({
  product,
  slotLabel,
}: {
  product: Product | null;
  slotLabel: string;
}) {
  const imageAreaClass = 'relative aspect-[4/3] overflow-hidden bg-subtle';

  if (!product) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] border border-border-light bg-subtle">
        <p className="text-xs text-ink-muted sm:text-sm">Select a model</p>
      </div>
    );
  }

  const image = productImage(product);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]">
      <p className="border-b border-border-light bg-subtle px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand sm:hidden">
        {slotLabel}
      </p>
      <div className={imageAreaClass}>
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-subtle via-elevated to-accent/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-elevated shadow-sm ring-1 ring-border-light sm:h-16 sm:w-16">
              <Zap className="h-6 w-6 text-accent/60 sm:h-8 sm:w-8" aria-hidden />
            </div>
            <p className="mt-2 text-[10px] font-medium text-ink-muted/70 sm:text-xs">No image</p>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3
          className="line-clamp-2 font-display text-base font-semibold leading-snug text-ink"
          title={product.name}
        >
          {product.name}
        </h3>
        <Link
          to={`/shop/${product.id}`}
          className="group mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-brand transition-colors hover:text-brand-light"
        >
          Learn More
          <ArrowRight className={`h-4 w-4 ${ctaArrowClass}`} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function ComparisonValue({
  label,
  value,
  isWinner,
}: {
  label: string;
  value: string | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg px-2.5 py-2.5 sm:px-3 sm:py-3 ${isWinner ? winnerCellClass : valueCellClass}`}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand" title={label}>
        {shortName(label, 18)}
      </p>
      <p className="mt-1 break-words text-xs leading-snug sm:text-sm">{value ?? '—'}</p>
    </div>
  );
}

function MobileComparisonTable({
  leftBike,
  rightBike,
}: {
  leftBike: Product | null;
  rightBike: Product | null;
}) {
  return (
    <div className="mt-8 space-y-3 md:hidden">
      <div className="grid grid-cols-2 gap-2 px-0.5">
        <p className="truncate text-center text-[11px] font-semibold text-brand" title={leftBike?.name}>
          {leftBike ? shortName(leftBike.name, 16) : 'Model A'}
        </p>
        <p className="truncate text-center text-[11px] font-semibold text-brand" title={rightBike?.name}>
          {rightBike ? shortName(rightBike.name, 16) : 'Model B'}
        </p>
      </div>

      {COMPARISON_ROWS.map((row) => {
        const leftDisplay = leftBike ? row.getDisplay(leftBike) : null;
        const rightDisplay = rightBike ? row.getDisplay(rightBike) : null;
        const leftNum = leftBike && row.getNumeric ? row.getNumeric(leftBike) : null;
        const rightNum = rightBike && row.getNumeric ? row.getNumeric(rightBike) : null;
        const winner = bestSide(leftNum, rightNum, row.compare);

        return (
          <div
            key={row.label}
            className="overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]"
          >
            <p className="border-b border-border-light bg-subtle px-3 py-2 text-xs font-semibold text-ink">
              {row.label}
            </p>
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <ComparisonValue
                label={leftBike?.name ?? 'Model A'}
                value={leftDisplay}
                isWinner={winner === 0}
              />
              <ComparisonValue
                label={rightBike?.name ?? 'Model B'}
                value={rightDisplay}
                isWinner={winner === 1}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesktopComparisonTable({
  leftBike,
  rightBike,
}: {
  leftBike: Product | null;
  rightBike: Product | null;
}) {
  return (
    <div className="mt-10 hidden overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)] md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-light bg-subtle">
              <th scope="col" className="w-[28%] px-6 py-4 font-display font-semibold text-ink">
                Specification
              </th>
              <th scope="col" className="px-6 py-4 font-display font-semibold text-brand">
                {leftBike?.name ?? 'Model A'}
              </th>
              <th scope="col" className="px-6 py-4 font-display font-semibold text-brand">
                {rightBike?.name ?? 'Model B'}
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => {
              const leftDisplay = leftBike ? row.getDisplay(leftBike) : null;
              const rightDisplay = rightBike ? row.getDisplay(rightBike) : null;
              const leftNum = leftBike && row.getNumeric ? row.getNumeric(leftBike) : null;
              const rightNum = rightBike && row.getNumeric ? row.getNumeric(rightBike) : null;
              const winner = bestSide(leftNum, rightNum, row.compare);

              return (
                <tr key={row.label} className="border-b border-border-light last:border-0">
                  <th scope="row" className="px-6 py-4 font-medium text-ink-muted">
                    {row.label}
                  </th>
                  <td className={`px-6 py-4 ${winner === 0 ? winnerCellClass : 'text-ink'}`}>
                    {leftDisplay ?? '—'}
                  </td>
                  <td className={`px-6 py-4 ${winner === 1 ? winnerCellClass : 'text-ink'}`}>
                    {rightDisplay ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ModelComparisonPage() {
  const [bikes, setBikes] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  useEffect(() => {
    publicApi
      .shop({ type: 'BIKE', limit: '100' })
      .then((res) => {
        const list = res.data;
        setBikes(list);
        if (list.length > 0) setLeftId(list[0].id);
        if (list.length > 1) setRightId(list[1].id);
        else if (list.length === 1) setRightId(list[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const leftBike = useMemo(() => bikes.find((b) => b.id === leftId) ?? null, [bikes, leftId]);
  const rightBike = useMemo(() => bikes.find((b) => b.id === rightId) ?? null, [bikes, rightId]);

  return (
    <>
      <PageHero
        page="compare"
        eyebrow="Electric bikes"
        title="Model Comparison"
        subtitle="Compare electric bikes by range, performance and features. Find the one that fits your lifestyle best."
      />

      <MotionSection className="bg-subtle py-8 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <ProductGridSkeleton count={2} />
          ) : bikes.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-8 text-center shadow-[var(--shadow-elevated)] sm:p-10">
              <p className="font-display text-base font-semibold text-ink sm:text-lg">
                No bikes available to compare yet.
              </p>
              <Link to="/shop" className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-light">
                Browse the shop →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:gap-6">
                <BikePicker
                  label="Model A"
                  bikes={bikes}
                  value={leftId}
                  onChange={setLeftId}
                  disabledIds={rightId ? [rightId] : undefined}
                />
                <BikePicker
                  label="Model B"
                  bikes={bikes}
                  value={rightId}
                  onChange={setRightId}
                  disabledIds={leftId ? [leftId] : undefined}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:mt-8 sm:gap-6 lg:mt-10">
                <BikePreview product={leftBike} slotLabel="Model A" />
                <BikePreview product={rightBike} slotLabel="Model B" />
              </div>

              <MobileComparisonTable leftBike={leftBike} rightBike={rightBike} />
              <DesktopComparisonTable leftBike={leftBike} rightBike={rightBike} />
            </>
          )}
        </div>
      </MotionSection>
    </>
  );
}
