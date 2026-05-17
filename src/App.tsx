import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthScreens from './components/auth/AuthScreens';
import Shell from './components/layout/Shell';
import MaintenanceView from './components/MaintenanceView';
import { subscribeToAppConfig } from './services/configService';
import { subscribeToUserProfile } from './services/userService';
import { AppConfig, UserProfile } from './types';
import { ADMIN_EMAIL } from './lib/config';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [bypassMaintenance, setBypassMaintenance] = useState(false);
  const [showLoginDuringMaintenance, setShowLoginDuringMaintenance] = useState(false);

  useEffect(() => {
    document.title = 'Trackify - Gestão Inteligente';

    const unsubConfig = subscribeToAppConfig(setAppConfig);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setUserProfile(null);
      setLoading(false);
    });

    return () => {
      unsubConfig();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProfile(user.id, setUserProfile);
    return unsub;
  }, [user]);

  if (loading || !appConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg">
        <Loader2 className="w-10 h-10 text-accent animate-spin mb-6" />
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em]">Trackify is loading</p>
      </div>
    );
  }

  if (appConfig.maintenanceMode) {
    const isAdmin = !!(userProfile?.isAdmin || user?.email?.toLowerCase().trim() === ADMIN_EMAIL);
    const canEnter = isAdmin && appConfig.allowAdminsDuringMaintenance;

    if (!canEnter && !bypassMaintenance) {
      if (showLoginDuringMaintenance && !user) {
        return (
          <div className="min-h-screen bg-bg">
            <div className="fixed top-6 left-6 z-50">
              <button
                onClick={() => setShowLoginDuringMaintenance(false)}
                className="px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-accent transition-all"
              >
                Voltar
              </button>
            </div>
            <AuthScreens />
          </div>
        );
      }

      return (
        <MaintenanceView
          message={appConfig.maintenanceMessage}
          isAdmin={isAdmin && appConfig.allowAdminsDuringMaintenance}
          onEnterAnyway={() => setBypassMaintenance(true)}
          onStaffLogin={() => setShowLoginDuringMaintenance(true)}
        />
      );
    }
  }

  if (!user) return <AuthScreens />;

  return <Shell user={user} userProfile={userProfile} />;
}
