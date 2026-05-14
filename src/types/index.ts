export type BillingCycle = 'monthly' | 'annual' | 'weekly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  billingDay: number;
  billingMonth?: number;
  category: string;
  status: SubscriptionStatus;
  startDate: string;
  nextBillingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  billingReminders: boolean;
  reminderDays: number;
  usageAlerts: boolean;
  spendingLimit?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  currency: string;
  theme?: 'light' | 'dark';
  notifications?: NotificationPreferences;
  monthlyBudget?: number | null;
  bio?: string;
  location?: string;
  isAdmin?: boolean;
  isPremium?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  targetId: string;
  targetType: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SystemNotice {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  active: boolean;
  updatedAt: string;
}

export interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  allowAdminsDuringMaintenance: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  color: string;
  icon?: string;
  predefinedId?: string;
}

export const PREDEFINED_CATEGORIES: Category[] = [
  { id: 'streaming', name: 'Streaming', color: '#6366f1', icon: 'Tv' },
  { id: 'software', name: 'Software', color: '#10b981', icon: 'Box' },
  { id: 'gaming', name: 'Gaming', color: '#f43f5e', icon: 'Gamepad2' },
  { id: 'music', name: 'Música', color: '#a855f7', icon: 'Music' },
  { id: 'health', name: 'Saúde', color: '#06b6d4', icon: 'Activity' },
  { id: 'others', name: 'Outros', color: '#94a3b8', icon: 'MoreHorizontal' },
];

export const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f43f5e', '#a855f7', '#06b6d4', 
  '#f97316', '#ec4899', '#eab308'
];

export const CATEGORY_ICONS = [
  'Tag', 'Tv', 'Box', 'Gamepad2', 'Music', 'Activity', 
  'MoreHorizontal', 'ShoppingBag', 'Utensils', 'Car', 
  'Home', 'Heart', 'Zap', 'Coffee', 'Smartphone', 
  'Laptop', 'Book', 'Camera'
];
