/**
 * POST /verify-followme
 * Called by the test Twilio number webhook to verify that Follow-Me
 * is active on a business's phone. When the test number calls the business
 * and the call gets forwarded to Twilio, this handler fires, marks the
 * business as verified, and sends a WhatsApp confirmation.
 */

import type { Request, Response } from 'express';
import { findBusinessByPhone, setFollowMeVerified } from '../db/businesses';
import { sendWhatsApp } from '../twilio-client';
import { normalisePhone, stripWaPrefix } from '../config';

interface Secrets {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    testNumber: string;
}

export async function verifyFollowMeHandler(
    req: Request,
    res: Response,
    secrets: Secrets,
): Promise<void> {
    res.sendStatus(200);

    const body = req.body as Record<string, string>;
    const callerRaw = body['From'] ?? '';
    const forwardedFromRaw = body['ForwardedFrom'] ?? body['OriginalCalledNumber'] ?? '';

    const callerPhone = normalisePhone(stripWaPrefix(callerRaw));
    const businessPhone = normalisePhone(stripWaPrefix(forwardedFromRaw));

    // Verify the caller is our test number
    const testNumber = normalisePhone(secrets.testNumber);
    if (callerPhone !== testNumber) {
        console.log(`verifyFollowMe: unexpected caller ${callerPhone}, expected ${testNumber}`);
        return;
    }

    if (!businessPhone) {
        console.log('verifyFollowMe: no ForwardedFrom in request');
        return;
    }

    try {
        const business = await findBusinessByPhone(businessPhone);
        if (!business) {
            console.log(`verifyFollowMe: no business found for phone ${businessPhone}`);
            return;
        }

        await setFollowMeVerified(business.id, true);

        await sendWhatsApp({
            to: `whatsapp:${businessPhone}`,
            from: `whatsapp:${secrets.whatsappNumber}`,
            body: `✅ מעולה! ה-Follow-Me הושלם בהצלחה.\nפורלי מוכנה לקבל לקוחות בשמך!`,
            accountSid: secrets.accountSid,
            authToken: secrets.authToken,
        });

        console.log(`verifyFollowMe: verified business ${business.id} (${businessPhone})`);
    } catch (err) {
        console.error('verifyFollowMeHandler error:', err);
    }
}
