import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator } from 'lucide-react';
import { fadeUp, defaultViewport, motionTransition, staggerContainer } from '../../lib/publicMotion';
import { formatPKR } from '../../lib/format';
import { SectionHeadingIcon } from './SectionHeadingIcon';

// ─── Tunable constants (no backend) ───────────────────────────────────────────

const BRAND_NAME = 'Crown Ev';

const ELECTRICITY_COST_PER_UNIT_PKR = 35;

const PETROL_MAINTENANCE_MONTHLY_PKR = 1500;
const ELECTRIC_MAINTENANCE_MONTHLY_PKR = 200;

const PETROL_YEAR_MAINTENANCE_FACTOR = 0.05;

const PETROL_PRICE_MIN = 100;
const PETROL_PRICE_MAX = 700;
const PETROL_PRICE_DEFAULT = 300;

const DAILY_DISTANCE_MIN = 10;
const DAILY_DISTANCE_MAX = 100;
const DAILY_DISTANCE_DEFAULT = 30;

const MODEL_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

const ELECTRIC_BIKE_MODELS = [
  { id: 'pro-x1', label: 'Crown Ev Pro X1', kmPerUnit: 45 },
  { id: 'city-s', label: 'Crown Ev City S', kmPerUnit: 50 },
  { id: 'urban-lite', label: 'Crown Ev Urban Lite', kmPerUnit: 55 },
  { id: 'delivery-max', label: 'Crown Ev Delivery Max', kmPerUnit: 40 },
] as const;

const PETROL_BIKE_MODELS = [
  { id: '70cc', label: '70cc Petrol Bike', kmPerLiter: 50 },
  { id: '100cc', label: '100cc Petrol Bike', kmPerLiter: 45 },
  { id: '125cc', label: '125cc Petrol Bike', kmPerLiter: 40 },
  { id: '150cc', label: '150cc Petrol Bike', kmPerLiter: 35 },
] as const;

const PETROL_CHART_COLORS = ['#f97316', '#ea6c0a'] as const;
const ELECTRIC_CHART_COLORS = ['#ea6c0a', '#f97316', '#22c55e'] as const;

const inputClass =
  'w-full rounded-lg border border-border-light bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/20';

const labelClass = 'mb-1 block text-xs font-medium text-ink-muted';

function clampPetrolPrice(value: number) {
  return Math.min(PETROL_PRICE_MAX, Math.max(PETROL_PRICE_MIN, value));
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

type ChartRow = { name: string; value: number; color: string };

function donutGradient(data: ChartRow[]) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return 'conic-gradient(#f0c9a8 0deg 360deg)';

  let angle = 0;
  const stops = data.map((row) => {
    const sweep = (row.value / total) * 360;
    const start = angle;
    angle += sweep;
    return `${row.color} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function DonutChart({ data }: { data: ChartRow[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-[7.5rem] w-[7.5rem] shrink-0 rounded-full"
        style={{
          background: donutGradient(data),
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))',
        }}
        role="img"
        aria-label={`Cost breakdown chart, total ${formatPKR(total)}`}
      />
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {data.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              {row.name}
            </span>
            <span className="shrink-0 tabular-nums text-brand">
              {formatPKR(row.value)} <span className="text-text-muted">({pct(row.value, total)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function SavingsCalculator() {
  const [electricModelId, setElectricModelId] = useState<string>(ELECTRIC_BIKE_MODELS[0].id);
  const [petrolModelId, setPetrolModelId] = useState<string>(PETROL_BIKE_MODELS[1].id);
  const [petrolPrice, setPetrolPrice] = useState(PETROL_PRICE_DEFAULT);
  const [modelYear, setModelYear] = useState<number>(2024);
  const [dailyDistance, setDailyDistance] = useState(DAILY_DISTANCE_DEFAULT);

  const results = useMemo(() => {
    const electricBike = ELECTRIC_BIKE_MODELS.find((m) => m.id === electricModelId) ?? ELECTRIC_BIKE_MODELS[0];
    const petrolBike = PETROL_BIKE_MODELS.find((m) => m.id === petrolModelId) ?? PETROL_BIKE_MODELS[1];
    const price = clampPetrolPrice(petrolPrice);

    const monthlyDistanceKm = dailyDistance * 30;
    const petrolFuelMonthly = (monthlyDistanceKm / petrolBike.kmPerLiter) * price;
    const electricityMonthly = (monthlyDistanceKm / electricBike.kmPerUnit) * ELECTRICITY_COST_PER_UNIT_PKR;

    const yearAge = Math.max(0, 2026 - modelYear);
    const petrolMaintenance =
      PETROL_MAINTENANCE_MONTHLY_PKR * (1 + yearAge * PETROL_YEAR_MAINTENANCE_FACTOR);
    const electricMaintenance = ELECTRIC_MAINTENANCE_MONTHLY_PKR;

    const petrolMonthlyTotal = petrolFuelMonthly + petrolMaintenance;
    const electricMonthlyTotal = electricityMonthly + electricMaintenance;
    const fuelSavings = Math.max(0, petrolFuelMonthly - electricityMonthly);

    return {
      petrolFuelMonthly,
      electricityMonthly,
      petrolMonthlyTotal,
      electricMonthlyTotal,
      fuelSavings,
      petrolChart: [
        { name: 'Petrol', value: petrolFuelMonthly, color: PETROL_CHART_COLORS[0] },
        { name: 'Maint.', value: petrolMaintenance, color: PETROL_CHART_COLORS[1] },
      ] as ChartRow[],
      electricChart: [
        { name: 'Maint.', value: electricMaintenance, color: ELECTRIC_CHART_COLORS[0] },
        { name: 'Electric', value: electricityMonthly, color: ELECTRIC_CHART_COLORS[1] },
        { name: 'Savings', value: fuelSavings, color: ELECTRIC_CHART_COLORS[2] },
      ] as ChartRow[],
    };
  }, [electricModelId, petrolModelId, petrolPrice, modelYear, dailyDistance]);

  return (
    <motion.section
      className="border-y border-border-light bg-elevated py-10 lg:py-12"
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
      variants={staggerContainer}
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Inputs */}
          <motion.div
            variants={fadeUp}
            transition={motionTransition}
            className="rounded-[var(--radius-card)] border border-border-light bg-subtle p-4 shadow-[var(--shadow-elevated)] lg:p-5"
          >
            <h2 className="font-display text-lg font-bold leading-snug text-ink lg:text-xl">
              Calculate Your Ride &amp; Save with {BRAND_NAME}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Compare monthly petrol vs electric costs. Updates instantly.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field id="electric-model" label="Electric Bike Model">
                <select
                  id="electric-model"
                  value={electricModelId}
                  onChange={(e) => setElectricModelId(e.target.value)}
                  className={inputClass}
                >
                  {ELECTRIC_BIKE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>

              <Field id="petrol-model" label="Petrol Bike Model">
                <select
                  id="petrol-model"
                  value={petrolModelId}
                  onChange={(e) => setPetrolModelId(e.target.value)}
                  className={inputClass}
                >
                  {PETROL_BIKE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Field>

              <Field id="petrol-price" label="Petrol Price (Rs/L)">
                <input
                  id="petrol-price"
                  type="number"
                  min={PETROL_PRICE_MIN}
                  max={PETROL_PRICE_MAX}
                  value={petrolPrice}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setPetrolPrice(Number.isFinite(n) ? clampPetrolPrice(n) : PETROL_PRICE_DEFAULT);
                  }}
                  className={inputClass}
                />
              </Field>

              <Field id="model-year" label="Bike Model Year">
                <select
                  id="model-year"
                  value={modelYear}
                  onChange={(e) => setModelYear(parseInt(e.target.value, 10))}
                  className={inputClass}
                >
                  {MODEL_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center gap-2">
                  <label htmlFor="daily-distance" className="text-xs font-medium text-brand">
                    Daily Distance (km)
                  </label>
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {dailyDistance} km
                  </span>
                </div>
                <input
                  id="daily-distance"
                  type="range"
                  min={DAILY_DISTANCE_MIN}
                  max={DAILY_DISTANCE_MAX}
                  value={dailyDistance}
                  onChange={(e) => setDailyDistance(parseInt(e.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer accent-accent"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border-light bg-elevated px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Petrol / mo</p>
                <p className="font-display text-sm font-bold tabular-nums text-brand">
                  {formatPKR(results.petrolFuelMonthly)}
                </p>
              </div>
              <div className="rounded-lg border border-border-light bg-elevated px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Electric / mo</p>
                <p className="font-display text-sm font-bold tabular-nums text-brand">
                  {formatPKR(results.electricityMonthly)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            variants={fadeUp}
            transition={motionTransition}
            className="overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center gap-2 bg-brand px-4 py-2.5 text-white">
              <SectionHeadingIcon>
                <Calculator className="h-4 w-4" aria-hidden />
              </SectionHeadingIcon>
              <h3 className="font-display text-sm font-bold">Savings Calculator</h3>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Petrol Bike</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-brand">
                  {formatPKR(results.petrolMonthlyTotal)}/mo
                </p>
                <div className="mt-2">
                  <DonutChart data={results.petrolChart} />
                </div>
              </div>

              <div className="sm:border-l sm:border-border-light sm:pl-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Electric Bike</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-brand">
                  {formatPKR(results.electricMonthlyTotal)}/mo
                </p>
                <p className="text-[11px] text-success">
                  Save {formatPKR(results.fuelSavings)}/mo on fuel
                </p>
                <div className="mt-2">
                  <DonutChart data={results.electricChart} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
