import { supabase } from '../lib/supabase';
import { Subscription } from '../types';
import { createLog } from './auditService';
import { API_BASE_URL } from '../lib/config';

const TABLE = 'subscriptions';

function mapRow(row: any): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    amount: row.amount,
    currency: row.currency,
    billingCycle: row.billing_cycle,
    billingDay: row.billing_day,
    billingMonth: row.billing_month ?? undefined,
    category: row.category,
    status: row.status,
    startDate: row.start_date,
    nextBillingDate: row.next_billing_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(data: Partial<Omit<Subscription, 'id'>>) {
  const row: any = {};
  if (data.userId !== undefined)       row.user_id       = data.userId;
  if (data.name !== undefined)         row.name          = data.name;
  if (data.icon !== undefined)         row.icon          = data.icon;
  if (data.amount !== undefined)       row.amount        = data.amount;
  if (data.currency !== undefined)     row.currency      = data.currency;
  if (data.billingCycle !== undefined) row.billing_cycle = data.billingCycle;
  if (data.billingDay !== undefined)   row.billing_day   = data.billingDay;
  if (data.billingMonth !== undefined) row.billing_month = data.billingMonth;
  if (data.category !== undefined)     row.category      = data.category;
  if (data.status !== undefined)       row.status        = data.status;
  if (data.startDate !== undefined)    row.start_date    = data.startDate;
  return row;
}

export const getUserSubscriptions = async (userId: string): Promise<Subscription[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
};

export const subscribeToUserSubscriptions = (
  userId: string,
  onSuccess: (subs: Subscription[]) => void,
  onError: (error: Error) => void
) => {
  const fetch = async () => {
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error) onError(new Error(error.message));
    else onSuccess((data ?? []).map(mapRow));
  };

  fetch();

  const channel = supabase
    .channel(`subscriptions:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const createSubscription = async (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | undefined> => {
  const { data: row, error } = await supabase
    .from(TABLE)
    .insert(toRow(data))
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  triggerCalendarSync(data.userId, row.id).catch(console.error);
  await createLog('Subscription Created', row.id, 'subscription', `Nova subscrição adicionada: ${data.name}`);
  return row.id;
};

export const updateSubscription = async (
  id: string,
  userId: string,
  data: Partial<Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const { error } = await supabase.from(TABLE).update(toRow(data)).eq('id', id);
  if (error) throw new Error(error.message);

  triggerCalendarSync(userId, id).catch(console.error);
  await createLog('Subscription Updated', id, 'subscription', `Subscrição atualizada: ${data.name || 'Alteração de dados'}`, { fields: Object.keys(data) });
};

export const deleteSubscription = async (id: string, userId: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);

  triggerCalendarDelete(userId, id).catch(console.error);
  await createLog('Subscription Deleted', id, 'subscription', 'Subscrição removida definitivamente');
};

export const deleteAllUserSubscriptions = async (userId: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
};

const triggerCalendarSync = async (userId: string, subscriptionId: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/calendar/sync-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscriptionId }),
    });
    return res.ok;
  } catch { return false; }
};

const triggerCalendarDelete = async (userId: string, subscriptionId: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/calendar/delete-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscriptionId }),
    });
    return res.ok;
  } catch { return false; }
};
