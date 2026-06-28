import { type ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone } from 'lucide-react';
import { getBranchCardImage } from '../../lib/placeholders';
import { resolveBranchCoords } from '../../lib/branchMapCoords';
import { resolveUploadUrl } from '../../lib/media';
import type { Branch } from '../../types';

type BranchCardProps = {
  branch: Branch;
  index?: number;
  variant?: 'featured' | 'compact';
  showDescription?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`;
}

function mapsUrl(branch: Branch) {
  const coords = resolveBranchCoords(branch);
  if (coords) {
    return `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.location)}`;
}

function InfoRow({
  icon: Icon,
  label,
  children,
  href,
  external,
}: {
  icon: typeof MapPin;
  label: string;
  children: ReactNode;
  href?: string;
  external?: boolean;
}) {
  const content = (
    <>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="min-w-0">{children}</span>
    </>
  );

  const className =
    'flex w-full items-start gap-2 text-sm leading-snug text-ink-muted transition-colors hover:text-brand';

  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={(e) => e.stopPropagation()}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {content}
      </a>
    );
  }

  return <p className={className}>{content}</p>;
}

/** Long branch copy is clamped until the user expands it. */
function BranchDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  const needsToggle = trimmed.length > 90 || trimmed.includes('\n');

  if (!trimmed) return null;

  return (
    <div className="mt-2">
      <p
        className={`text-xs leading-relaxed text-ink-muted sm:text-sm ${
          expanded || !needsToggle ? '' : 'line-clamp-2'
        }`}
      >
        {trimmed}
      </p>
      {needsToggle ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((open) => !open);
          }}
          className="mt-1.5 text-xs font-semibold text-brand-light transition-colors hover:text-brand hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? 'View less' : 'View more'}
        </button>
      ) : null}
    </div>
  );
}

export function BranchCard({
  branch,
  index = 0,
  variant = 'featured',
  showDescription = true,
  selected = false,
  onSelect,
}: BranchCardProps) {
  const isCompact = variant === 'compact';
  const imageSrc = resolveUploadUrl(branch.imageUrl) ?? getBranchCardImage(branch);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.07, duration: 0.42, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-elevated shadow-[var(--shadow-elevated)] transition-[box-shadow,border-color,ring-color] hover:border-accent/30 hover:shadow-[var(--shadow-elevated-hover)] sm:flex-row ${
        selected ? 'border-accent ring-2 ring-accent/25' : 'border-border-light'
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-subtle ${
          isCompact
            ? 'aspect-[16/10] w-full sm:aspect-auto sm:w-[38%]'
            : 'aspect-[16/10] w-full sm:aspect-auto sm:w-[40%]'
        }`}
      >
        <motion.img
          src={imageSrc}
          alt={branch.name}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
            isCompact
              ? 'sm:min-h-[7.25rem] sm:max-h-[8.25rem]'
              : 'sm:min-h-[8rem] sm:max-h-[9.25rem]'
          }`}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-transparent"
          aria-hidden
        />
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col justify-center ${
          isCompact ? 'px-4 py-3.5 sm:px-4 sm:py-3.5' : 'px-4 py-4 sm:px-5 sm:py-4'
        }`}
      >
        <h3
          className={`font-display font-bold leading-tight text-ink ${
            isCompact ? 'text-base sm:text-base' : 'text-lg sm:text-lg'
          }`}
        >
          {branch.name}
        </h3>

        <div className={`flex flex-col gap-1.5 ${isCompact ? 'mt-2' : 'mt-2.5'}`}>
          <InfoRow icon={MapPin} label="Location" href={mapsUrl(branch)} external>
            {branch.location}
          </InfoRow>
          <InfoRow icon={Phone} label="Contact" href={telHref(branch.phone)}>
            {branch.phone}
          </InfoRow>
        </div>

        {showDescription && branch.description && !isCompact ? (
          <BranchDescription text={branch.description} />
        ) : null}
      </div>
    </motion.article>
  );
}

type BranchCardsSectionProps = {
  branches: Branch[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  showDescription?: boolean;
  variant?: 'featured' | 'compact';
  className?: string;
  tone?: 'light' | 'dark';
};

export function BranchCardsSection({
  branches,
  eyebrow = 'Nationwide network',
  title = 'Our Branches',
  subtitle = 'Visit a Crown Ev showroom for test rides, service, parts, and expert advice.',
  showDescription = true,
  variant = 'featured',
  className = '',
  tone = 'light',
}: BranchCardsSectionProps) {
  if (branches.length === 0) return null;

  const heading = tone === 'dark' ? 'text-text' : 'text-ink';
  const sub = tone === 'dark' ? 'text-text-muted' : 'text-ink-muted';

  return (
    <section className={`py-16 lg:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-10 max-w-2xl text-center lg:mb-12"
        >
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
          )}
          <h2 className={`mt-2 font-display text-2xl font-bold sm:text-3xl ${heading}`}>{title}</h2>
          {subtitle && <p className={`mt-3 text-sm leading-relaxed lg:text-base ${sub}`}>{subtitle}</p>}
        </motion.div>

        <div className="mx-auto flex max-w-3xl flex-col gap-4 lg:max-w-4xl lg:gap-5">
          {branches.map((b, i) => (
            <BranchCard
              key={b.id}
              branch={b}
              index={i}
              variant={variant}
              showDescription={showDescription}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
