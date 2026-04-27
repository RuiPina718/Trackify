import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() } as UserProfile;
  }
  return null;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  await setDoc(doc(db, 'users', profile.uid), profile);
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, data);
};

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile) => void) => {
  return onSnapshot(doc(db, 'users', uid), (doc) => {
    if (doc.exists()) {
      callback({ uid: doc.id, ...doc.data() } as UserProfile);
    }
  });
};
