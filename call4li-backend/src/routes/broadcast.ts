/**
 * POST /broadcast
 * Sends a WhatsApp message to all customers of a given business.
 */

import type { Request, Response } from 'express';
import { findBusinessById } from '../db/businesses';
import { getAllConversationsForBusiness } from '../db/conversations';
import { sendWhatsApp } from '../twilio';

export async function broadcastHandler(req: Request, res: Response): Promise<void> {
    const { bizId, message } = req.body as { bizId?: string; message?: string };

    if (!bizId || !message) {
        res.status(400).json({ error: 'bizId and message are required' });
        return;
    }

    const business = await findBusinessById(bizId);
    if (!business) {
        res.status(404).json({ error: 'Business not found' });
        return;
    }

    const conversations = await getAllConversationsForBusiness(bizId);
    const uniquePhones = [...new Set(conversations.map(c => c.callerPhone))];

    // Acknowledge immediately, send in background
    res.json({ success: true, recipientCount: uniquePhones.length });

    let sent = 0;
    let failed = 0;
    for (const phone of uniquePhones) {
        try {
            await sendWhatsApp(`whatsapp:${phone}`, message);
            sent++;
        } catch (err) {
            console.error(`broadcast: failed to send to ${phone}:`, err);
            failed++;
        }
    }

    console.log(`broadcast for ${bizId}: sent=${sent}, failed=${failed}`);
}
