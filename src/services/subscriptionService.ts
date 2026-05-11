import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Subscription } from '../types';

const COLLECTION_NAME = 'subscriptions';

export const getUserSubscriptions = async (userId: string) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const subs: Subscription[] = [];
    querySnapshot.forEach((doc) => {
      subs.push({ id: doc.id, ...doc.data() } as Subscription);
    });
    return subs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
};

export const subscribeToUserSubscriptions = (
  userId: string, 
  onSuccess: (subs: Subscription[]) => void, 
  onError: (error: Error) => void
) => {
  const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
  
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const subs: Subscription[] = [];
    snapshot.forEach((doc) => {
      subs.push({ id: doc.id, ...doc.data() } as Subscription);
    });
    onSuccess(subs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    onError(error as Error);
  });
};

const cleanSubscriptionData = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      clean[key] = data[key];
    }
  });
  return clean;
};

export const createSubscription = async (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...cleanSubscriptionData(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Trigger background calendar sync
    triggerCalendarSync(data.userId, docRef.id).catch(console.error);
    
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
};

export const updateSubscription = async (id: string, userId: string, data: Partial<Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...cleanSubscriptionData(data),
      updatedAt: serverTimestamp(),
    });
    
    // Trigger background calendar sync
    triggerCalendarSync(userId, id).catch(console.error);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
};

const triggerCalendarSync = async (userId: string, subscriptionId: string) => {
  try {
    const response = await fetch('/api/calendar/sync-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscriptionId }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error triggering calendar sync:', error);
    return false;
  }
};

const triggerCalendarDelete = async (userId: string, subscriptionId: string) => {
  try {
    const response = await fetch('/api/calendar/delete-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscriptionId }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error triggering calendar delete:', error);
    return false;
  }
};

export const deleteSubscription = async (id: string, userId: string) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    
    // Trigger background calendar event deletion
    triggerCalendarDelete(userId, id).catch(console.error);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
};

export const deleteAllUserSubscriptions = async (userId: string) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    throw error;
  }
};
