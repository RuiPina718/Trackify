import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Subscription } from '../types';

const COLLECTION_NAME = 'subscriptions';

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

export const createSubscription = async (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
};

export const updateSubscription = async (id: string, data: Partial<Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
};

export const deleteSubscription = async (id: string) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
};
