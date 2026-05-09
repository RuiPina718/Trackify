import { useState, useEffect } from 'react';
import { Category, PREDEFINED_CATEGORIES } from '../types';
import { subscribeToUserCategories } from '../services/categoryService';

export function useUnifiedCategories(userId: string) {
  const [userCategories, setUserCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const unsub = subscribeToUserCategories(userId, (cats) => {
      setUserCategories(cats);
      setLoading(false);
    });
    
    return () => unsub();
  }, [userId]);

  const unifiedCategories = [
    ...PREDEFINED_CATEGORIES.map(base => {
      const override = userCategories.find(uc => uc.predefinedId === base.id);
      return override || base;
    }),
    ...userCategories.filter(uc => !uc.predefinedId)
  ];

  return { categories: unifiedCategories, userCategories, loading };
}
