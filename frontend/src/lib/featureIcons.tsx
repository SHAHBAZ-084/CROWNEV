import { Battery, Gauge, Shield, Zap, type LucideIcon } from 'lucide-react';
import { FEATURE_ICON_IDS, type FeatureIconId } from './placeholders';

const ICON_MAP: Record<FeatureIconId, LucideIcon> = {
  zap: Zap,
  battery: Battery,
  gauge: Gauge,
  shield: Shield,
};

export function getFeatureIcon(id: string): LucideIcon {
  if ((FEATURE_ICON_IDS as readonly string[]).includes(id)) {
    return ICON_MAP[id as FeatureIconId];
  }
  return Zap;
}
