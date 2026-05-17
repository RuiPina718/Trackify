import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { deleteAllUserSubscriptions } from './subscriptionService';
import { deleteAllUserCategories } from './categoryService';
import { createLog } from './auditService';
import { API_BASE_URL } from '../lib/config';

function mapRow(row: any): UserProfile {
  return {
    uid: row.id,
    email: row.email ?? '',
    displayName: row.display_name ?? undefined,
    photoURL: row.photo_url ?? undefined,
    createdAt: row.created_at,
    currency: row.currency ?? 'EUR',
    theme: row.theme ?? 'dark',
    monthlyBudget: row.monthly_budget ?? undefined,
    bio: row.bio ?? undefined,
    location: row.location ?? undefined,
    isAdmin: row.is_admin ?? false,
    isPremium: row.is_premium ?? false,
    notifications: row.notifications ?? undefined,
    dashboardConfig: row.dashboard_config ?? undefined,
  };
}

function toRow(data: Partial<UserProfile>) {
  const row: any = {};
  if (data.uid !== undefined)           row.id             = data.uid;
  if (data.email !== undefined)         row.email          = data.email;
  if (data.displayName !== undefined)   row.display_name   = data.displayName;
  if (data.photoURL !== undefined)      row.photo_url      = data.photoURL;
  if (data.currency !== undefined)      row.currency       = data.currency;
  if (data.theme !== undefined)         row.theme          = data.theme;
  if (data.monthlyBudget !== undefined) row.monthly_budget = data.monthlyBudget;
  if (data.bio !== undefined)           row.bio            = data.bio;
  if (data.location !== undefined)      row.location       = data.location;
  if (data.isAdmin !== undefined)       row.is_admin       = data.isAdmin;
  if (data.isPremium !== undefined)     row.is_premium     = data.isPremium;
  if (data.notifications !== undefined) row.notifications  = data.notifications;
  if (data.dashboardConfig !== undefined) row.dashboard_config = data.dashboardConfig;
  return row;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) return null;
  return mapRow(data);
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const { error } = await supabase.from('profiles').upsert(toRow(profile), { onConflict: 'id' });
  if (error) throw new Error(error.message);
  await createLog('User Created', profile.uid, 'user', `Novo utilizador registado: ${profile.email}`);
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const { error } = await supabase.from('profiles').update(toRow(data)).eq('id', uid);
  if (error) throw new Error(error.message);
  await createLog('User Updated', uid, 'user', 'Perfil de utilizador atualizado', { fields: Object.keys(data) });
};

export const deleteUserProfile = async (uid: string): Promise<void> => {
  await deleteAllUserSubscriptions(uid);
  await deleteAllUserCategories(uid);
  await triggerCalendarDisconnect(uid).catch(console.error);
  const { error } = await supabase.from('profiles').delete().eq('id', uid);
  if (error) throw new Error(error.message);
  await createLog('User Deleted', uid, 'user', 'Conta de utilizador e todos os dados associados foram removidos');
};

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile) => void) => {
  supabase.from('profiles').select('*').eq('id', uid).single()
    .then(({ data }) => { if (data) callback(mapRow(data)); });

  const channel = supabase
    .channel(`profile:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (data) callback(mapRow(data));
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void, errorCallback?: (error: any) => void) => {
  const fetch = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { errorCallback?.(error); return; }
    callback((data ?? []).map(mapRow));
  };

  fetch();

  const channel = supabase
    .channel('all-profiles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

const triggerCalendarDisconnect = async (userId: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/calendar/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch { return false; }
};
