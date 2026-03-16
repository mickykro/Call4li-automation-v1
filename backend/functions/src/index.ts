/**
 * Firebase Cloud Functions — Call4li backend
 *
 * Exports:
 *   api                       — Express HTTP app (all REST endpoints)
 *   scheduledCallbackReminders — PubSub cron every 5 minutes
 */

import * as functions from 'firebase-functions/v2/https';
import * as scheduler from 'firebase-functions/v2/scheduler';
import express from 'express';
import cors from 'cors';

import {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER,
    TWILIO_TEST_NUMBER,
    ANTHROPIC_API_KEY,
    ADMIN_SECRET,
    APP_BASE_URL,
} from './config';

import { voiceWebhookHandler } from './handlers/voiceWebhook';
import { whatsappWebhookHandler } from './handlers/whatsappWebhook';
import { verifyFollowMeHandler } from './handlers/verifyFollowMe';
import { onboardHandler } from './handlers/onboard';
import { businessUpdateHandler } from './handlers/businessUpdate';
import { broadcastHandler } from './handlers/broadcast';
import { adminSendAllHandler } from './handlers/adminSendAll';
import { runCallbackReminders } from './handlers/callbackReminder';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio sends URL-encoded bodies

// ── Routes ────────────────────────────────────────────────────────

// Twilio Voice webhook
app.post('/twilio/voice', async (req, res) => {
    await voiceWebhookHandler(req, res, {
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
    });
});

// Twilio WhatsApp webhook
app.post('/twilio/whatsapp', async (req, res) => {
    await whatsappWebhookHandler(req, res, {
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
        anthropicApiKey: ANTHROPIC_API_KEY.value(),
        appBaseUrl: APP_BASE_URL.value(),
    });
});

// Follow-Me verification
app.post('/verify-followme', async (req, res) => {
    await verifyFollowMeHandler(req, res, {
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
        testNumber: TWILIO_TEST_NUMBER.value(),
    });
});

// Business onboarding (from web form)
app.post('/onboard', async (req, res) => {
    await onboardHandler(req, res, APP_BASE_URL.value());
});

// Business data update
app.put('/business/update', async (req, res) => {
    await businessUpdateHandler(req, res);
});

// Broadcast to business's customers
app.post('/broadcast', async (req, res) => {
    await broadcastHandler(req, res, {
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
    });
});

// Admin broadcast to all businesses
app.post('/admin/send-all', async (req, res) => {
    await adminSendAllHandler(req, res, {
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
        adminSecret: ADMIN_SECRET.value(),
    });
});

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Cloud Function: HTTP ──────────────────────────────────────────

export const api = functions.onRequest(
    {
        region: 'me-west1', // Tel Aviv
        secrets: [
            TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN,
            TWILIO_WHATSAPP_NUMBER,
            TWILIO_TEST_NUMBER,
            ANTHROPIC_API_KEY,
            ADMIN_SECRET,
            APP_BASE_URL,
        ],
        timeoutSeconds: 60,
        minInstances: 0,
    },
    app,
);

// ── Cloud Function: Scheduled callback reminders ──────────────────

export const scheduledCallbackReminders = scheduler.onSchedule(
    {
        schedule: 'every 5 minutes',
        region: 'me-west1',
        secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER],
        timeoutSeconds: 120,
    },
    async () => {
        await runCallbackReminders({
            accountSid: TWILIO_ACCOUNT_SID.value(),
            authToken: TWILIO_AUTH_TOKEN.value(),
            whatsappNumber: TWILIO_WHATSAPP_NUMBER.value(),
        });
    },
);
