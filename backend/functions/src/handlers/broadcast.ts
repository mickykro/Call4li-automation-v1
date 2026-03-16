/**
 * POST /broadcast
 * Sends a WhatsApp message to all customers who have interacted with a business.
 */

import type { Request, Response } from 'express';
import { findBusinessById } from '../db/businesses';
import { getAllConversationsForBusiness } from '../db/conversations';
import { sendWhatsApp } from '../twilio-client';

interface BroadcastBody {
    bizId?: string;
    message?: string;
}

interface Secrets {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
}

export async function broadcastHandler(
    req: Request,
    res: Response,
    secrets: Secrets,
): Promise<void> {
    const body = req.body as BroadcastBody;

    if (!body.bizId || !body.message) {
        res.status(400).json({ error: 'bizId and message are required' });
        return;
    }

    const business = await findBusinessById(body.bizId);
    if (!business) {
        res.status(404).json({ error: 'Business not found' });
        return;
    }

    const conversations = await getAllConversationsForBusiness(body.bizId);
    const uniquePhones = [...new Set(conversations.map(c => c.callerPhone))];

    // Acknowledge immediately, send in background
    res.json({ success: true, recipientCount: uniquePhones.length });

    let sent = 0;
    let failed = 0;
    for (const phone of uniquePhones) {
        try {
            await sendWhatsApp({
                to: `whatsapp:${phone}`,
                from: `whatsapp:${secrets.whatsappNumber}`,
                body: body.message!,
                accountSid: secrets.accountSid,
                authToken: secrets.authToken,
            });
            sent++;
        } catch (err) {
            console.error(`broadcast: failed to send to ${phone}:`, err);
            failed++;
        }
    }

    console.log(`broadcast for ${body.bizId}: sent=${sent}, failed=${failed}`);
}
