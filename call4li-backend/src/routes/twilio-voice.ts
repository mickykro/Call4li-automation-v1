/**
 * POST /twilio/voice
 * Twilio Follow-Me webhook. Fires when an unanswered call is forwarded to our Twilio number.
 * Identifies the business, then sends an opening WhatsApp message to the caller.
 */

import type { Request, Response } from 'express';
import { silentTwiML, sendWhatsApp } from '../twilio';
import { findBusinessByPhone } from '../db/businesses';
import { getOrCreateConversation, addMessage, saveCustomerState } from '../db/conversations';
import { upsertCustomer } from '../db/customers';
import { createCustomerState, buildOpeningMessage } from '../forli-onboarding';
import { normalisePhone, stripWaPrefix } from '../helpers';

export async function twilioVoiceHandler(req: Request, res: Response): Promise<void> {
    // Respond immediately with silent TwiML so Twilio doesn't time out
    res.type('text/xml').send(silentTwiML());

    const body = req.body as Record<string, string>;
    const callerRaw: string = body['From'] ?? '';
    const forwardedFromRaw: string = body['ForwardedFrom'] ?? body['OriginalCalledNumber'] ?? '';

    if (!callerRaw || !forwardedFromRaw) return;

    const callerPhone = normalisePhone(stripWaPrefix(callerRaw));
    const businessPhone = normalisePhone(stripWaPrefix(forwardedFromRaw));

    try {
        const business = await findBusinessByPhone(businessPhone);
        if (!business || business.status !== 'active') {
            console.log(`twilioVoice: no active business for ${businessPhone}`);
            return;
        }

        await upsertCustomer(callerPhone, business.businessId);

        const conv = await getOrCreateConversation(business.businessId, callerPhone, 'customer');

        const customerState = createCustomerState({
            businessId: business.businessId,
            businessName: business.businessName,
            callerPhone,
        });
        await saveCustomerState(conv.id, customerState);

        const customButtons =
            business.plan === 'premium' && business.customButtons?.length
                ? business.customButtons
                : undefined;

        const messageBody =
            business.plan === 'premium' && business.openingMessage
                ? business.openingMessage
                : buildOpeningMessage(business.businessName, 'he', customButtons);

        await sendWhatsApp(`whatsapp:${callerPhone}`, messageBody);

        await addMessage(conv.id, { sender: 'forli', content: messageBody, type: 'text' });
    } catch (err) {
        console.error('twilioVoiceHandler error:', err);
    }
}
