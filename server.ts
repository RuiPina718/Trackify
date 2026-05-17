import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase env vars — calendar sync endpoints will not work.');
}

// Service role client bypasses RLS for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('--- Server Startup ---');
console.log('Supabase URL:', supabaseUrl || '(not set)');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0-supabase', env: process.env.NODE_ENV });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'email', 'profile'];

const getRedirectUri = (req: express.Request) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `https://${host?.toString().replace(/\/$/, '')}/auth/callback`;
};

app.get('/api/debug/redirect-uri', (req, res) => {
  res.json({ redirectUri: getRedirectUri(req) });
});

app.get('/api/auth/google/url', (req, res) => {
  const redirectUri = getRedirectUri(req);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    redirect_uri: redirectUri,
    state: req.query.userId as string,
  });
  res.json({ url: authUrl });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('Missing code or userId');

  try {
    const callbackClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    const { tokens } = await callbackClient.getToken(code as string);

    if (tokens.refresh_token) {
      await supabase.from('calendar_integrations').upsert({
        user_id: userId,
        refresh_token: tokens.refresh_token,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    res.send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:white;">
      <div style="text-align:center;">
        <h1 style="color:#22c55e;">Sincronização Ativada!</h1>
        <p>O Google Calendar foi ligado com sucesso ao Trackify.</p>
        <script>setTimeout(()=>{ if(window.opener){window.opener.postMessage({type:'CALENDAR_SYNC_SUCCESS'},'*');window.close();}else{window.location.href='/';} },2000);</script>
      </div></body></html>`);
  } catch (error: any) {
    res.status(500).send(`<html><body style="padding:20px;background:#0f172a;color:white;"><h1 style="color:#ef4444;">Erro de Autenticação</h1><p>${error.message}</p></body></html>`);
  }
});

// ── Calendar Sync ─────────────────────────────────────────────────────────────
async function getRefreshToken(userId: string): Promise<string | null> {
  const { data } = await supabase.from('calendar_integrations').select('refresh_token').eq('user_id', userId).single();
  return data?.refresh_token ?? null;
}

async function deleteCalendarEvent(userId: string, subscriptionId: string, refreshToken: string) {
  const { data: mapping } = await supabase.from('calendar_events')
    .select('id, google_event_id').eq('subscription_id', subscriptionId).single();
  if (!mapping) return;

  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    await calendar.events.delete({ calendarId: 'primary', eventId: mapping.google_event_id });
  } catch (err: any) {
    if (err.code !== 404) console.error('Error deleting Google event:', err);
  }
  await supabase.from('calendar_events').delete().eq('id', mapping.id);
}

async function syncSingleSubscription(userId: string, subscriptionId: string, refreshToken: string) {
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', subscriptionId).single();

  if (!sub || sub.status !== 'active') {
    await deleteCalendarEvent(userId, subscriptionId, refreshToken);
    return;
  }

  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  const today = new Date();
  let nextDate: Date;

  if (sub.billing_cycle === 'yearly' || sub.billing_cycle === 'annual') {
    const month = (sub.billing_month || 1) - 1;
    nextDate = new Date(today.getFullYear(), month, sub.billing_day);
    if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
  } else if (sub.billing_cycle === 'weekly' || sub.billing_cycle === 'biweekly') {
    const start = new Date(sub.start_date || today);
    nextDate = new Date(start);
    const days = sub.billing_cycle === 'weekly' ? 7 : 14;
    while (nextDate < today) nextDate.setDate(nextDate.getDate() + days);
  } else {
    nextDate = new Date(today.getFullYear(), today.getMonth(), sub.billing_day);
    if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
  }

  const event = {
    summary: `Pagamento — ${sub.name}`,
    description: `Cobrança recorrente ${sub.billing_cycle} de ${sub.amount} ${sub.currency}`,
    start: { date: nextDate.toISOString().split('T')[0] },
    end:   { date: nextDate.toISOString().split('T')[0] },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'email', minutes: 2880 }] },
  };

  const { data: existing } = await supabase.from('calendar_events').select('id, google_event_id').eq('subscription_id', subscriptionId).single();

  if (existing) {
    try {
      await calendar.events.update({ calendarId: 'primary', eventId: existing.google_event_id, requestBody: event });
    } catch (err: any) {
      if (err.code === 404) {
        const newEventRes = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
        await supabase.from('calendar_events').update({ google_event_id: newEventRes.data.id, last_synced_at: new Date().toISOString() }).eq('id', existing.id);
      } else throw err;
    }
  } else {
    const newEventRes = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
    await supabase.from('calendar_events').insert({
      user_id: userId,
      subscription_id: subscriptionId,
      google_event_id: newEventRes.data.id,
    });
  }
}

app.post('/api/calendar/sync-subscription', async (req, res) => {
  const { userId, subscriptionId } = req.body;
  if (!userId || !subscriptionId) return res.status(400).json({ error: 'Missing userId or subscriptionId' });
  const token = await getRefreshToken(userId);
  if (!token) return res.status(404).json({ error: 'Calendar not connected' });
  try {
    await syncSingleSubscription(userId, subscriptionId, token);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendar/delete-event', async (req, res) => {
  const { userId, subscriptionId } = req.body;
  if (!userId || !subscriptionId) return res.status(400).json({ error: 'Missing userId or subscriptionId' });
  const token = await getRefreshToken(userId);
  if (!token) return res.status(404).json({ error: 'Calendar not connected' });
  try {
    await deleteCalendarEvent(userId, subscriptionId, token);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendar/disconnect', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  await supabase.from('calendar_integrations').delete().eq('user_id', userId);
  res.json({ success: true });
});

// ── Vite Dev Server ───────────────────────────────────────────────────────────
async function startServer() {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
