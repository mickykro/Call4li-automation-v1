import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { twilioVoiceHandler } from './routes/twilio-voice';
import { twilioWhatsAppHandler } from './routes/twilio-whatsapp';
import { verifyFollowMeHandler } from './routes/verify-followme';
import { onboardHandler } from './routes/onboard';
import { businessUpdateHandler } from './routes/business-update';
import { broadcastHandler } from './routes/broadcast';
import { adminSendAllHandler } from './routes/admin-send-all';
import { getDueCallbacks, markReminderSent } from './db/callbacks';
import { findBusinessById } from './db/businesses';
import { sendWhatsApp } from './twilio';

const app = express();
const PORT = parseInt(process.env.PORT ?? '8080', 10);

// ── Middleware ────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health check ──────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Twilio webhooks ───────────────────────────────────────────────

app.post('/twilio/voice', twilioVoiceHandler);
app.post('/twilio/whatsapp', twilioWhatsAppHandler);
app.post('/verify-followme', verifyFollowMeHandler);

// ── Business management ───────────────────────────────────────────

app.post('/onboard', onboardHandler);
app.put('/business/update', businessUpdateHandler);
app.post('/broadcast', broadcastHandler);

// ── Admin ─────────────────────────────────────────────────────────

app.post('/admin/send-all', adminSendAllHandler);

// ── Callback reminder scheduler (every 5 minutes) ────────────────

async function runCallbackReminders(): Promise<void> {
    const now = new Date().toISOString();
    const due = await getDueCallbacks(now);
    if (due.length === 0) return;

    console.log(`callbackReminder: ${due.length} reminder(s) to send`);

    for (const callback of due) {
        try {
            const biz = await findBusinessById(callback.businessId);
            if (!biz) {
                await markReminderSent(callback.id);
                continue;
            }

            const scheduledDisplay = new Date(callback.scheduledTime).toLocaleString('he-IL', {
                timeZone: 'Asia/Jerusalem',
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
            });

            const msg =
                `⏰ *תזכורת שיחה חוזרת*\n` +
                `לקוח: ${callback.callerPhone}\n` +
                `מועד: ${scheduledDisplay}\n` +
                `זה הזמן לחזור אליו!`;

            await sendWhatsApp(`whatsapp:${callback.businessPhone}`, msg);
            await markReminderSent(callback.id);

            console.log(`callbackReminder: sent for ${callback.id}`);
        } catch (err) {
            console.error(`callbackReminder error for ${callback.id}:`, err);
        }
    }
}

cron.schedule('*/5 * * * *', () => {
    runCallbackReminders().catch(err => console.error('cron error:', err));
});

// ── Start server ──────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`call4li backend listening on port ${PORT}`);
});
