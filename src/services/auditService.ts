import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { AuditLog } from '../types';

/**
 * Logs an action to the audit logs collection.
 */
export const createLog = async (
  action: string, 
  targetId: string, 
  targetType: string, 
  details: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const user = auth.currentUser;
    const logData = {
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      action,
      targetId,
      targetType,
      details,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    };

    await addDoc(collection(db, 'audit_logs'), logData);
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};

/**
 * Subscribes to the latest audit logs.
 */
export const subscribeToLogs = (callback: (logs: AuditLog[]) => void, maxLogs: number = 50) => {
  const logsQuery = query(
    collection(db, 'audit_logs'),
    orderBy('timestamp', 'desc'),
    limit(maxLogs)
  );

  return onSnapshot(logsQuery, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
    callback(logs);
  }, (error) => {
    console.error('Error in subscribeToLogs:', error);
  });
};
