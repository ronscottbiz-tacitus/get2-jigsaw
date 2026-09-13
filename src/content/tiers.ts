/**
 * Free / Premium tiers.
 *
 * This phase ships Free only. Premium is "coming soon" — a waitlist, no purchase
 * flow, no price. `getTier()` is the single choke point: today it always returns
 * `'free'`, and the Premium waitlist signup is stored device-locally just so the
 * CTA has somewhere to go. When Premium goes live this is where entitlement
 * lookup slots in.
 */
import type { Tier } from './library';

const WAITLIST_KEY = 'jigsaw_premium_waitlist_v1';

export function getTier(): Tier {
  return 'free';
}

export function canAccess(_itemTier: Tier): boolean {
  return true;
}

export function isOnWaitlist(): boolean {
  try {
    return !!localStorage.getItem(WAITLIST_KEY);
  } catch {
    return false;
  }
}

export function joinWaitlist(): void {
  try {
    localStorage.setItem(WAITLIST_KEY, new Date().toISOString());
  } catch {
    /* storage unavailable */
  }
}

export const PREMIUM_PERKS = [
  'Full curated library — every image, every clip',
  'Upload your own photos and videos',
] as const;

export const FREE_PERKS = [
  'Classic and Live modes',
  'A curated selection from every category',
  'All three difficulty tiers',
] as const;
