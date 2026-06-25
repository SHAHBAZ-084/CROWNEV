import type { Branch } from '../../types';
import { BranchCardsSection } from './BranchCard';

export function FindBranchSection({ branches }: { branches: Branch[] }) {
  return (
    <BranchCardsSection
      branches={branches}
      eyebrow="Nationwide network"
      title="Our Branches"
      subtitle="Visit a Crown Ev showroom near you for test rides, service, and parts."
      showDescription
      variant="featured"
      className="bg-subtle pt-14 pb-10 lg:pt-16 lg:pb-12"
    />
  );
}
