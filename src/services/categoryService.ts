import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category } from '../types';

const CATEGORIES_COLLECTION = 'categories';

export const subscribeToUserCategories = (userId: string, callback: (categories: Category[]) => void) => {
  const q = query(
    collection(db, CATEGORIES_COLLECTION),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    // Sort in memory to avoid needing a composite index
    callback(categories.sort((a, b) => a.name.localeCompare(b.name)));
  }, (error) => {
    console.error('Error fetching categories:', error);
    callback([]); // Return empty list on error to allow page to load
  });
};

export const createCategory = async (userId: string, name: string, color: string, predefinedId?: string, icon?: string) => {
  return addDoc(collection(db, CATEGORIES_COLLECTION), {
    userId,
    name,
    color,
    predefinedId,
    icon,
    createdAt: new Date().toISOString()
  });
};

export const updateCategory = async (id: string, updates: Partial<Category>) => {
  return updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const deleteCategory = async (id: string) => {
  return deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
};
