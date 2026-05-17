import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';

export const createLog = async (
  action: string,
  targetId: string,
  targetType: string,
  details: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      user_id:     user?.id    ?? 'system',
      user_email:  user?.email ?? 'system',
      action,
      target_id:   targetId,
      target_type: targetType,
      details,
      metadata:    metadata ?? {},
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};

export const subscribeToLogs = (callback: (logs: AuditLog[]) => void, maxLogs = 50) => {
  const fetch = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(maxLogs);
    callback((data ?? []).map(row => ({
      id:         row.id,
      userId:     row.user_id,
      userEmail:  row.user_email,
      action:     row.action,
      targetId:   row.target_id,
      targetType: row.target_type,
      details:    row.details,
      timestamp:  row.timestamp,
      metadata:   row.metadata,
    } as AuditLog)));
  };

  fetch();

  const channel = supabase
    .channel('audit-logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};
