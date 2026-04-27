export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  billingDay: number;
  category: string;
  status: SubscriptionStatus;
  startDate: string;
  nextBillingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: string;
  currency: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  color: string;
}

export const PREDEFINED_CATEGORIES: Category[] = [
  { id: 'cat_streaming', name: 'Streaming', color: '#6366f1' },
  { id: 'cat_software', name: 'Software', color: '#10b981' },
  { id: 'cat_gaming', name: 'Gaming', color: '#f43f5e' },
  { id: 'cat_health', name: 'Saúde', color: '#06b6d4' },
  { id: 'cat_others', name: 'Outros', color: '#94a3b8' },
];
