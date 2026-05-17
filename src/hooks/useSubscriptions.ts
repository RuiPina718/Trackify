import { useState, useEffect } from 'react';
import { Subscription } from '../types';
import { subscribeToUserSubscriptions } from '../services/subscriptionService';

export function useSubscriptions(userId: string) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToUserSubscriptions(
      userId,
      (subs) => {
        setSubscriptions(subs);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [userId]);

  return { subscriptions, loading };
}
