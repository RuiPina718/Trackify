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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName || '',
            createdAt: serverTimestamp(),
            currency: 'EUR',
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg">
        <Loader2 className="w-10 h-10 text-accent animate-spin mb-6" />
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Trackify is loading</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreens />;
  }

  return <Shell user={user} />;
}

