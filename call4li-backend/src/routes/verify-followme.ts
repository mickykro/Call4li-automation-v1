/**
 * POST /verify-followme
 * Called by our Twilio test number webhook. When the test number calls a business's phone
 * and the call is forwarded here, we mark that business as Follow-Me verified and send
 * a WhatsApp confirmation.
 */

import type { Request, Response } from 'express';
import { findBusinessByPhone, setFollowMeVerified } from '../db/businesses';
import { sendWhatsApp } from '../twilio';
import { normalisePhone, stripWaPrefix } from '../helpers';

export async function verifyFollowMeHandler(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);

    const body = req.body as Record<string, string>;
    const callerRaw = body['From'] ?? '';
    const forwardedFromRaw = body['ForwardedFrom'] ?? body['OriginalCalledNumber'] ?? '';

    const callerPhone = normalisePhone(stripWaPrefix(callerRaw));
    const businessPhone = normalisePhone(stripWaPrefix(forwardedFromRaw));

    const testNumber = normalisePhone(process.env.TWILIO_TEST_NUMBER ?? '');
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
            console.log(`verifyFollowMe: no business found for ${businessPhone}`);
            return;
        }

        await setFollowMeVerified(business.id, true);

        await sendWhatsApp(
            `whatsapp:${businessPhone}`,
            '✅ מעולה! ה-Follow-Me הושלם בהצלחה.\nפורלי מוכנה לקבל לקוחות בשמך!',
        );

        console.log(`verifyFollowMe: verified business ${business.id} (${businessPhone})`);
    } catch (err) {
        console.error('verifyFollowMeHandler error:', err);
    }
}
