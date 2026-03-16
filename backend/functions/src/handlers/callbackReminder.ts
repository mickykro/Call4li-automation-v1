/**
 * Scheduled function — runs every 5 minutes.
 * Finds pending callback reminders and sends them to the business via WhatsApp.
 */

import { getDueCallbacks, markReminderSent } from '../db/callbacks';
import { findBusinessById } from '../db/businesses';
import { sendWhatsApp } from '../twilio-client';

interface Secrets {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
}

export async function runCallbackReminders(secrets: Secrets): Promise<void> {
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

            await sendWhatsApp({
                to: `whatsapp:${callback.businessPhone}`,
                from: `whatsapp:${secrets.whatsappNumber}`,
                body: msg,
                accountSid: secrets.accountSid,
                authToken: secrets.authToken,
            });

            await markReminderSent(callback.id);
            console.log(`callbackReminder: sent for ${callback.id}`);
        } catch (err) {
            console.error(`callbackReminder error for ${callback.id}:`, err);
        }
    }
}
