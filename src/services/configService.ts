import { supabase } from '../lib/supabase';
import { AppConfig } from '../types';
import { createLog } from './auditService';

const TABLE = 'app_config';
const CONFIG_ID = 'main';

function mapRow(row: any): AppConfig {
  return {
    maintenanceMode: row.maintenance_mode ?? false,
    maintenanceMessage: row.maintenance_message ?? '',
    allowAdminsDuringMaintenance: row.allow_admins_during_maintenance ?? true,
    updatedAt: row.updated_at,
  };
}

const DEFAULT_CONFIG: AppConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'Estamos a realizar algumas melhorias técnicas. Voltamos já!',
  allowAdminsDuringMaintenance: true,
  updatedAt: new Date().toISOString(),
};

export const getAppConfig = async (): Promise<AppConfig> => {
  const { data } = await supabase.from(TABLE).select('*').eq('id', CONFIG_ID).single();
  return data ? mapRow(data) : DEFAULT_CONFIG;
};

export const updateAppConfig = async (data: Partial<AppConfig>): Promise<void> => {
  const row: any = { updated_at: new Date().toISOString() };
  if (data.maintenanceMode !== undefined)               row.maintenance_mode                = data.maintenanceMode;
  if (data.maintenanceMessage !== undefined)            row.maintenance_message             = data.maintenanceMessage;
  if (data.allowAdminsDuringMaintenance !== undefined)  row.allow_admins_during_maintenance = data.allowAdminsDuringMaintenance;

  const { error } = await supabase.from(TABLE).update(row).eq('id', CONFIG_ID);
  if (error) throw new Error(error.message);

  if (data.maintenanceMode !== undefined) {
    await createLog('System Mode Changed', 'system', 'config', `Modo manutenção ${data.maintenanceMode ? 'ativado' : 'desativado'}`);
  }
};

export const subscribeToAppConfig = (callback: (config: AppConfig) => void) => {
  getAppConfig().then(callback);

  const channel = supabase
    .channel('app-config')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${CONFIG_ID}` }, async () => {
      const config = await getAppConfig();
      callback(config);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};
