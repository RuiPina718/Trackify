import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BillingCycle } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'EUR') {
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch (e) {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
}

/** Returns true for any billing cycle variant that means "yearly". */
export function isYearlyCycle(cycle: BillingCycle | string | undefined): boolean {
  return cycle === 'yearly' || cycle === 'annual';
}
