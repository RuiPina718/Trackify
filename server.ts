import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Vercel, the file might be in different places relative to the function
const getFirebaseConfig = () => {
  const paths = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(__dirname, '..', 'firebase-applet-config.json')
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`Found firebase config at: ${p}`);
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  throw new Error('Could not find firebase-applet-config.json');
};

const firebaseConfig = getFirebaseConfig();

console.log('--- Server Startup ---');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Database ID:', firebaseConfig.firestoreDatabaseId);
console.log('Gemini API Key configured:', !!process.env.GEMINI_API_KEY);
console.log('Google Client ID configured:', !!(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID));

// Initialize Firebase Client SDK for backend (to use API Key and Rules)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

console.log('Firebase initialized using Client SDK for database:', firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    env: process.env.NODE_ENV,
    configStatus: {
      gemini: !!process.env.GEMINI_API_KEY,
      googleClient: !!(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID),
      googleSecret: !!process.env.GOOGLE_CLIENT_SECRET
    }
  });
});

// Google OAuth Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  // We'll construct the redirect URI dynamically based on the request host
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'email', 'profile'];

// Helper to get Redirect URI
const getRedirectUri = (req: express.Request) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  
  // Ensure we don't have double slashes if host ends with /
  const cleanHost = host?.toString().replace(/\/$/, '');
  
  // Force https as the environment is always served over HTTPS and Google requires it
  return `https://${cleanHost}/auth/callback`;
};

// API Routes
app.get('/api/debug/redirect-uri', (req, res) => {
  res.json({ 
    redirectUri: getRedirectUri(req),
    headers: {
      host: req.headers.host,
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-host': req.headers['x-forwarded-host']
    }
  });
});

app.get('/api/auth/google/url', (req, res) => {
  const redirectUri = getRedirectUri(req);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get a refresh token
    scope: SCOPES,
    prompt: 'consent',
    redirect_uri: redirectUri,
    state: req.query.userId as string, // Pass userId in state to link account
  });
  res.json({ url: authUrl });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    return res.status(400).send('Missing code or userId');
  }

  try {
    const redirectUri = getRedirectUri(req);
    
    // Create a fresh client for token exchange to ensure redirect_uri consistency
    const callbackClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await callbackClient.getToken(code as string);

    if (tokens.refresh_token) {
      console.log(`Attempting to save refresh token for user: ${userId} to database: ${firebaseConfig.firestoreDatabaseId}`);
      try {
        // Store the refresh token securely in Firestore using Client SDK
        const integrationRef = doc(db, 'calendar_integrations', userId as string);
        await setDoc(integrationRef, {
          userId,
          refreshToken: tokens.refresh_token,
          status: 'connected',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
        console.log('Successfully saved to Firestore');
      } catch (dbError: any) {
        console.error('Firestore operation failed:', dbError);
        throw new Error(`Firestore Error: ${dbError.message} (Status: ${dbError.code || 'unknown'})`);
      }
    }

    // Return success page that closes itself
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;">
          <div style="text-align: center;">
            <h1 style="color: #22c55e;">Sincronização Ativada!</h1>
            <p>O Google Calendar foi ligado com sucesso ao Trackify.</p>
            <p>Esta janela irá fechar automaticamente...</p>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'CALENDAR_SYNC_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white;">
          <h1 style="color: #ef4444;">Erro de Autenticação</h1>
          <p>Não foi possível completar a ligação ao Google Calendar.</p>
          <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Erro:</strong> ${error.message}</p>
            <p><strong>User ID:</strong> ${userId || 'Não recebido'}</p>
            <p><strong>Project ID:</strong> ${firebaseConfig.projectId}</p>
            <p><strong>Database:</strong> ${firebaseConfig.firestoreDatabaseId}</p>
          </div>
          <button onclick="window.close()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Fechar Janela</button>
        </body>
      </html>
    `);
  }
});

// Helper function to delete a calendar event
async function deleteCalendarEvent(userId: string, subscriptionId: string, refreshToken: string) {
  const eventsColl = collection(db, 'calendar_events');
  const q = query(eventsColl, where('subscriptionId', '==', subscriptionId), limit(1));
  const eventMappingSnapshot = await getDocs(q);
  
  if (eventMappingSnapshot.empty) return;

  const mapping = eventMappingSnapshot.docs[0];
  const googleEventId = mapping.data().googleEventId;

  const userOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  userOAuth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
  } catch (err: any) {
    if (err.code !== 404) console.error('Error deleting google event:', err);
  }

  await deleteDoc(mapping.ref);
}

// Helper function to sync a single subscription to Google Calendar
async function syncSingleSubscription(userId: string, subscriptionId: string, refreshToken: string) {
  // 1. Get Subscription
  const subRef = doc(db, 'subscriptions', subscriptionId);
  const subDoc = await getDoc(subRef);
  
  // If subscription doesn't exist or is not active, remove from calendar
  if (!subDoc.exists() || subDoc.data()?.status !== 'active') {
    await deleteCalendarEvent(userId, subscriptionId, refreshToken);
    return;
  }
  
  const subData = subDoc.data()!;

  // 2. Setup Google Calendar Client
  const userOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  userOAuth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

  // 3. Check if we already have an event
  const eventsColl = collection(db, 'calendar_events');
  const q = query(eventsColl, where('subscriptionId', '==', subscriptionId), limit(1));
  const eventMappingSnapshot = await getDocs(q);
  
  let existingMapping = !eventMappingSnapshot.empty ? eventMappingSnapshot.docs[0] : null;

  // 4. Prepare Event Data
  let nextDate: Date;
  const today = new Date();
  
  if (subData.billingCycle === 'yearly' || subData.billingCycle === 'annual') {
    const month = (subData.billingMonth || 1) - 1;
    nextDate = new Date(today.getFullYear(), month, subData.billingDay);
    if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
  } else if (subData.billingCycle === 'weekly') {
    const start = new Date(subData.startDate);
    nextDate = new Date(start);
    while (nextDate < today) {
      nextDate.setDate(nextDate.getDate() + 7);
    }
  } else {
    nextDate = new Date(today.getFullYear(), today.getMonth(), subData.billingDay);
    if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
  }

  const event = {
    summary: `Pagamento — ${subData.name}`,
    description: `Cobrança recorrente ${subData.billingCycle} de ${subData.amount} ${subData.currency}`,
    start: {
      date: nextDate.toISOString().split('T')[0],
    },
    end: {
      date: nextDate.toISOString().split('T')[0],
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
        { method: 'email', minutes: 2 * 24 * 60 }, // 2 days before
      ],
    },
  };

  if (existingMapping) {
    const googleEventId = existingMapping.data().googleEventId;
    try {
      await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: event,
      });
    } catch (err: any) {
      if (err.code === 404) {
        // Event deleted in Google, recreate
        const newEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: event,
        });
        await updateDoc(existingMapping.ref, { 
          googleEventId: newEvent.data.id,
          lastSyncedAt: serverTimestamp()
        });
      } else {
        throw err;
      }
    }
  } else {
    const newEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    await addDoc(collection(db, 'calendar_events'), {
      userId,
      subscriptionId,
      googleEventId: newEvent.data.id,
      lastSyncedAt: serverTimestamp(),
    });
  }
}

// Sync Subscription to Google Calendar
app.post('/api/calendar/sync-subscription', async (req, res) => {
  const { userId, subscriptionId } = req.body;

  if (!userId || !subscriptionId) {
    return res.status(400).json({ error: 'Missing userId or subscriptionId' });
  }

  try {
    const integrationRef = doc(db, 'calendar_integrations', userId);
    const integrationDoc = await getDoc(integrationRef);
    if (!integrationDoc.exists()) {
      return res.status(404).json({ error: 'Calendar integration not found. Reconnect your calendar.' });
    }
    const { refreshToken } = integrationDoc.data()!;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token. Please reconnect your calendar.' });
    }

    await syncSingleSubscription(userId, subscriptionId, refreshToken);

    // Update integration lastSyncAt
    await updateDoc(doc(db, 'calendar_integrations', userId), {
      lastSyncAt: serverTimestamp(),
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error syncing to calendar:', error);
    res.status(500).json({ 
      error: 'Failed to sync with Google Calendar',
      details: error.message || 'Unknown error'
    });
  }
});

// Sync All Subscriptions to Google Calendar
app.post('/api/calendar/sync-all', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const integrationRef = doc(db, 'calendar_integrations', userId);
    const integrationDoc = await getDoc(integrationRef);
    if (!integrationDoc.exists()) {
      return res.status(404).json({ error: 'Calendar integration not found' });
    }
    const { refreshToken } = integrationDoc.data()!;
    if (!refreshToken) {
      console.error(`User ${userId} has a connected status but no refresh token in database.`);
      return res.status(400).json({ error: 'Refresh token missing. Reconnect your calendar.' });
    }

    // Get all active subscriptions for the user
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where('userId', '==', userId), where('status', '==', 'active'));
    const subsSnapshot = await getDocs(q);

    console.log(`Syncing ${subsSnapshot.size} subscriptions for user ${userId}`);

    // Sync each one in sequence (to avoid rate limits and complexity)
    for (const subDoc of subsSnapshot.docs) {
      try {
        await syncSingleSubscription(userId, subDoc.id, refreshToken);
      } catch (err) {
        console.error(`Failed to sync subscription ${subDoc.id}:`, err);
      }
    }

    // Update integration lastSyncAt
    await updateDoc(doc(db, 'calendar_integrations', userId), {
      lastSyncAt: serverTimestamp(),
    });

    res.json({ success: true, count: subsSnapshot.size });
  } catch (error: any) {
    console.error('Error syncing all subscriptions:', error);
    res.status(500).json({ 
      error: 'Failed to sync all subscriptions',
      details: error.message || 'Unknown error'
    });
  }
});

async function disconnectCalendar(userId: string) {
  await deleteDoc(doc(db, 'calendar_integrations', userId));
  
  const eventsColl = collection(db, 'calendar_events');
  const q = query(eventsColl, where('userId', '==', userId));
  const eventsSnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  eventsSnapshot.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

app.post('/api/calendar/disconnect', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    await disconnectCalendar(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

app.post('/api/calendar/delete-event', async (req, res) => {
  const { userId, subscriptionId } = req.body;
  if (!userId || !subscriptionId) return res.status(400).json({ error: 'Missing userId or subscriptionId' });

  try {
    const integrationRef = doc(db, 'calendar_integrations', userId);
    const integrationDoc = await getDoc(integrationRef);
    if (!integrationDoc.exists()) return res.json({ success: true }); 

    const { refreshToken } = integrationDoc.data()!;
    await deleteCalendarEvent(userId, subscriptionId, refreshToken);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in delete-event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// AI Chat Endpoint - DEPRECATED: Use client-side Gemini SDK
// AI Insights Endpoint - DEPRECATED: Use client-side Gemini SDK

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: {
        port: 24679 // Try a different port for HMR if 24678 is stuck
      }
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;

