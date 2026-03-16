/**
 * POST /admin/send-all
 * Admin-only: broadcast a WhatsApp message to all (or filtered) businesses.
 * Requires the X-Admin-Secret header to match the ADMIN_SECRET env var.
 */

import type { Request, Response } from 'express';
import { getAllBusinesses } from '../db/businesses';
import { sendWhatsApp } from '../twilio-client';

interface AdminSendAllBody {
    message?: string;
    filter?: {
        plan?: 'basic' | 'premium';
        status?: 'pending' | 'active' | 'suspended';
    };
}

interface Secrets {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    adminSecret: string;
}

export async function adminSendAllHandler(
    req: Request,
    res: Response,
    secrets: Secrets,
): Promise<void> {
    const providedSecret = req.headers['x-admin-secret'];
    if (providedSecret !== secrets.adminSecret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const body = req.body as AdminSendAllBody;
    if (!body.message) {
        res.status(400).json({ error: 'message is required' });
        return;
    }

    const businesses = await getAllBusinesses(body.filter);

    res.json({ success: true, recipientCount: businesses.length });

    let sent = 0;
    let failed = 0;
    for (const biz of businesses) {
        if (!biz.phone) continue;
        try {
            await sendWhatsApp({
                to: `whatsapp:${biz.phone}`,
                from: `whatsapp:${secrets.whatsappNumber}`,
                body: body.message!,
                accountSid: secrets.accountSid,
                authToken: secrets.authToken,
            });
            sent++;
        } catch (err) {
            console.error(`adminSendAll: failed for ${biz.id} (${biz.phone}):`, err);
            failed++;
        }
    }

    console.log(`adminSendAll: sent=${sent}, failed=${failed}`);
}
