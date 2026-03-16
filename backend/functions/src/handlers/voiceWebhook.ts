/**
 * POST /twilio/voice
 * Triggered by Twilio when an unanswered call is forwarded via Follow-Me.
 * Identifies the business from the ForwardedFrom header, then sends an
 * opening WhatsApp message to the caller on behalf of the business.
 */

import type { Request, Response } from 'express';
import { buildSilentTwiML, sendWhatsApp } from '../twilio-client';
import { findBusinessByPhone } from '../db/businesses';
import { getOrCreateConversation, addMessage } from '../db/conversations';
import { upsertCustomer } from '../db/customers';
import { createCustomerState, buildOpeningMessage } from '../forli/customer-engine';
import { saveCustomerState } from '../db/conversations';
import { normalisePhone, stripWaPrefix } from '../config';

export async function voiceWebhookHandler(
    req: Request,
    res: Response,
    secrets: {
        accountSid: string;
        authToken: string;
        whatsappNumber: string;
    },
): Promise<void> {
    // Always return TwiML immediately so Twilio doesn't time out
    res.type('text/xml').send(buildSilentTwiML());

    const body = req.body as Record<string, string>;
    const callerRaw: string = body['From'] ?? '';
    const forwardedFromRaw: string = body['ForwardedFrom'] ?? body['OriginalCalledNumber'] ?? '';

    if (!callerRaw || !forwardedFromRaw) {
        // Not a forwarded call — nothing to do
        return;
    }

    const callerPhone = normalisePhone(stripWaPrefix(callerRaw));
    const businessPhone = normalisePhone(stripWaPrefix(forwardedFromRaw));

    try {
        const business = await findBusinessByPhone(businessPhone);
        if (!business || business.status !== 'active') {
            console.log(`voiceWebhook: no active business for phone ${businessPhone}`);
            return;
        }

        // Create or update customer record
        await upsertCustomer(callerPhone, business.businessId);

        // Create conversation
        const conv = await getOrCreateConversation(business.businessId, callerPhone, 'customer');

        // Build initial customer conversation state
        const customerState = createCustomerState({
            businessId: business.businessId,
            businessName: business.businessName,
            callerPhone,
        });

        await saveCustomerState(conv.id, customerState);

        // Build opening message (with custom buttons if premium)
        const customButtons =
            business.plan === 'premium' && business.customButtons?.length
                ? business.customButtons
                : undefined;

        const openingMsg = buildOpeningMessage(business.businessName, 'he', customButtons);

        // Use custom opening message if the business set one (premium)
        const messageBody =
            business.plan === 'premium' && business.openingMessage
                ? business.openingMessage
                : openingMsg;

        // Send to customer via WhatsApp
        await sendWhatsApp({
            to: `whatsapp:${callerPhone}`,
            from: `whatsapp:${secrets.whatsappNumber}`,
            body: messageBody,
            accountSid: secrets.accountSid,
            authToken: secrets.authToken,
        });

        // Log opening message in conversation
        await addMessage(conv.id, {
            sender: 'forli',
            content: messageBody,
            type: 'text',
        });
    } catch (err) {
        console.error('voiceWebhookHandler error:', err);
    }
}
