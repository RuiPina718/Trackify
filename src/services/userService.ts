import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
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
  
  await setDoc(doc(db, 'users', profile.uid), profile);
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, data, { merge: true });
};

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile) => void) => {
  return onSnapshot(doc(db, 'users', uid), (doc) => {
    if (doc.exists()) {
      callback({ uid: doc.id, ...doc.data() } as UserProfile);
    }
  });
};
