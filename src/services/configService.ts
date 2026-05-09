import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppConfig } from '../types';

const CONFIG_DOC_ID = 'main';
const COLLECTION_NAME = 'config';

export const getAppConfig = async (): Promise<AppConfig | null> => {
  const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as AppConfig;
  }
  
  // Default config if none exists
  const defaultConfig: AppConfig = {
    maintenanceMode: false,
    maintenanceMessage: 'Estamos a realizar algumas melhorias técnicas. Voltamos já!',
    allowAdminsDuringMaintenance: true,
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(docRef, defaultConfig);
  return defaultConfig;
};

export const updateAppConfig = async (data: Partial<AppConfig>): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
  await setDoc(docRef, { 
    ...data, 
    updatedAt: new Date().toISOString() 
  }, { merge: true });
};

export const subscribeToAppConfig = (callback: (config: AppConfig) => void) => {
  const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as AppConfig);
    } else {
      // Initialize if doesn't exist
      getAppConfig().then(config => config && callback(config));
    }
  }, (error) => {
    console.error('Error in subscribeToAppConfig:', error);
  });
};
