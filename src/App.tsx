/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import AuthScreens from './components/auth/AuthScreens';
import Shell from './components/layout/Shell';
import MaintenanceView from './components/MaintenanceView';
import { subscribeToAppConfig } from './services/configService';
import { subscribeToUserProfile } from './services/userService';
import { AppConfig, UserProfile } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [bypassMaintenance, setBypassMaintenance] = useState(false);
  const [showLoginDuringMaintenance, setShowLoginDuringMaintenance] = useState(false);

  useEffect(() => {
    // Force document title in case of caching or overrides
    document.title = "Trackify - Gestão Inteligente";
    
    // 1. Subscribe to App Config
    const unsubConfig = subscribeToAppConfig((newConfig) => {
      setAppConfig(newConfig);
    });

    // 2. Auth State Change
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: authUser.email,
            displayName: authUser.displayName || '',
            createdAt: serverTimestamp(),
            currency: 'EUR',
            isAdmin: false,
            isPremium: false
          });
        }
        setUser(authUser);
        setShowLoginDuringMaintenance(false); // Hide login if successful
      } else {
        setUser(null);
        setUserProfile(null);
        setBypassMaintenance(false);
      }
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubscribeAuth();
    };
  }, []);

  // 3. Subscribe to User Profile when user is logged in
  useEffect(() => {
    if (user) {
      const unsubProfile = subscribeToUserProfile(user.uid, (profile) => {
        setUserProfile(profile);
      });
      return () => unsubProfile();
    }
  }, [user]);

  if (loading || !appConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg">
        <Loader2 className="w-10 h-10 text-accent animate-spin mb-6" />
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Trackify is loading</p>
      </div>
    );
  }

  // Maintenance Mode Logic
  if (appConfig.maintenanceMode) {
    const isAdmin = userProfile?.isAdmin;
    const canEnter = isAdmin && appConfig.allowAdminsDuringMaintenance;

    // Automatic bypass for admins
    if (!canEnter && !bypassMaintenance) {
      // Show Login Screen if requested during maintenance
      if (showLoginDuringMaintenance && !user) {
        return (
          <div className="min-h-screen bg-bg">
            <div className="fixed top-6 left-6 z-50">
              <button 
                onClick={() => setShowLoginDuringMaintenance(false)}
                className="px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-accent transition-all"
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

  if (!user) {
    return <AuthScreens />;
  }

  return <Shell user={user} />;
}

