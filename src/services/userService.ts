import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { deleteAllUserSubscriptions } from './subscriptionService';
import { deleteAllUserCategories } from './categoryService';

/**
 * Removes undefined values from an object to prevent Firestore errors.
 */
const cleanObject = <T extends object>(obj: T): T => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as T);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() } as UserProfile;
  }
  return null;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  // Check if email already exists for another user to prevent duplicates
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', profile.email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const existingDoc = querySnapshot.docs[0];
    if (existingDoc.id !== profile.uid) {
      console.warn('User profile with this email already exists for a different UID:', existingDoc.id);
      // If a profile with this email exists under a different UID, we might want to link them
      // but for security/simplicity, we standardise on the UID from the auth event.
    }
  }
  
  await setDoc(doc(db, 'users', profile.uid), cleanObject(profile));
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, cleanObject(data), { merge: true });
};

export const deleteUserProfile = async (uid: string): Promise<void> => {
  try {
    // 1. Delete all subscriptions
    await deleteAllUserSubscriptions(uid);
    // 2. Delete all custom categories
    await deleteAllUserCategories(uid);
    // 3. Delete user profile document
    const docRef = doc(db, 'users', uid);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile) => void) => {
  return onSnapshot(doc(db, 'users', uid), (doc) => {
    if (doc.exists()) {
      callback({ uid: doc.id, ...doc.data() } as UserProfile);
    }
  }, (error) => {
    console.error('Error in subscribeToUserProfile:', error);
  });
};

export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void, errorCallback?: (error: any) => void) => {
  const usersQuery = collection(db, 'users');
  return onSnapshot(usersQuery, (snapshot) => {
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      let createdAt = '';
      try {
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate().toISOString();
        } else {
          createdAt = data.createdAt || '';
        }
      } catch (e) {
        createdAt = String(data.createdAt || '');
      }
      
      return { 
        uid: doc.id, 
        ...data,
        createdAt,
      } as UserProfile;
    });
    
    // Sort in memory for now to avoid index errors or type mismatch sorting issues
    const sortedUsers = [...users].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA;
    });
    
    callback(sortedUsers);
  }, (error) => {
    console.error('Error in subscribeToAllUsers:', error);
    if (errorCallback) errorCallback(error);
  });
};
