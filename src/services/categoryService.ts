import { supabase } from '../lib/supabase';
import { Category } from '../types';

const TABLE = 'categories';

function mapRow(row: any): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    predefinedId: row.predefined_id ?? undefined,
  };
}

export const subscribeToUserCategories = (userId: string, callback: (categories: Category[]) => void) => {
  const fetch = async () => {
    const { data } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('name');
    callback((data ?? []).map(mapRow));
  };

  fetch();

  const channel = supabase
    .channel(`categories:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const createCategory = async (userId: string, name: string, color: string, predefinedId?: string, icon?: string) => {
  const { data, error } = await supabase.from(TABLE).insert({
    user_id: userId,
    name,
    color,
    predefined_id: predefinedId,
    icon,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateCategory = async (id: string, updates: Partial<Category>) => {
  const row: any = {};
  if (updates.name !== undefined)        row.name         = updates.name;
  if (updates.color !== undefined)       row.color        = updates.color;
  if (updates.icon !== undefined)        row.icon         = updates.icon;
  if (updates.predefinedId !== undefined) row.predefined_id = updates.predefinedId;

  const { error } = await supabase.from(TABLE).update(row).eq('id', id);
  if (error) throw new Error(error.message);
};

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const deleteAllUserCategories = async (userId: string) => {
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
};
