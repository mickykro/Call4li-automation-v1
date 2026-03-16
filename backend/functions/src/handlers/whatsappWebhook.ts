/**
 * POST /twilio/whatsapp
 * Main handler for all incoming WhatsApp messages.
 * Routes to:
 *   - Business onboarding engine  (sender is a registered/prospective business)
 *   - Customer conversation engine (sender has an active customer conversation)
 *   - Prospect flow               (unknown number contacting Forli directly)
 */

import type { Request, Response } from 'express';
import { sendWhatsApp } from '../twilio-client';
import { generateConversationSummary } from '../claude';
import { findBusinessByPhone, getFaqs } from '../db/businesses';
import {
    addMessage,
    loadCustomerState,
    saveCustomerState,
    loadOnboardingState,
    saveOnboardingState,
    closeConversationWithSummary,
    buildConversationId,
    getConversation,
} from '../db/conversations';
import { getKnownBusinessesForPhone, upsertCustomer } from '../db/customers';
import { saveCallback } from '../db/callbacks';
import { createBusiness } from '../db/businesses';
import { runCustomerTurn } from '../forli/customer-engine';
import { runForliTurn, createInitialState } from '../forli/onboarding-engine';
import { normalisePhone, stripWaPrefix } from '../config';
import type { ForliState } from '../forli/types';

interface Secrets {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    anthropicApiKey: string;
    appBaseUrl: string;
}

// Parse Twilio WhatsApp webhook body
function parseBody(body: Record<string, string>) {
    const from = normalisePhone(stripWaPrefix(body['From'] ?? ''));
    const text = (body['Body'] ?? '').trim();
    const mediaUrls: string[] = [];
    const numMedia = parseInt(body['NumMedia'] ?? '0', 10);
    for (let i = 0; i < numMedia; i++) {
        const url = body[`MediaUrl${i}`];
        if (url) mediaUrls.push(url);
    }
    return { from, text, mediaUrls };
}

async function sendReply(
    to: string,
    messages: string[],
    secrets: Secrets,
): Promise<void> {
    for (const msg of messages) {
        await sendWhatsApp({
            to: `whatsapp:${to}`,
            from: `whatsapp:${secrets.whatsappNumber}`,
            body: msg,
            accountSid: secrets.accountSid,
            authToken: secrets.authToken,
        });
    }
}

export async function whatsappWebhookHandler(
    req: Request,
    res: Response,
    secrets: Secrets,
): Promise<void> {
    res.sendStatus(200);

    const { from, text, mediaUrls } = parseBody(req.body as Record<string, string>);
    if (!from) return;

    try {
        // 1. Is this sender a registered business?
        const senderBusiness = await findBusinessByPhone(from);

        if (senderBusiness) {
            await handleBusinessMessage({ from, text, mediaUrls, business: senderBusiness, secrets });
            return;
        }

        // 2. Does this sender have an active customer conversation?
        const knownBizIds = await getKnownBusinessesForPhone(from);
        if (knownBizIds.length > 0) {
            await handleCustomerMessage({ from, text, mediaUrls, knownBizIds, secrets });
            return;
        }

        // 3. Unknown number — prospect flow
        await handleProspectMessage({ from, text, secrets });
    } catch (err) {
        console.error('whatsappWebhookHandler error:', err);
    }
}

// ── Business onboarding / management ─────────────────────────────

async function handleBusinessMessage(params: {
    from: string;
    text: string;
    mediaUrls: string[];
    business: Awaited<ReturnType<typeof findBusinessByPhone>> & object;
    secrets: Secrets;
}) {
    const { from, text, business, secrets } = params;
    const convId = `onboarding_${from.replace(/\+/g, '')}`;

    // Load or create onboarding state
    let state: ForliState = (await loadOnboardingState(convId)) ?? createInitialState();

    // Log inbound
    await saveOnboardingState(convId, state); // ensure doc exists
    await addMessage(convId, { sender: 'customer', content: text, type: 'text' });

    const result = runForliTurn({
        text,
        state,
        isExistingBusiness: true,
        activeBusinessName: business.businessName,
    });

    // Persist new state
    await saveOnboardingState(convId, result.state);

    // If business payload returned (shouldn't happen for existing businesses, but handle gracefully)
    if (result.businessPayload) {
        // Update their record rather than create a new one
        const { updateBusiness } = await import('../db/businesses');
        await updateBusiness(business.id, {
            ownerName: result.businessPayload.ownerName,
            businessName: result.businessPayload.businessName,
            description: result.businessPayload.description,
        });
    }

    // Send replies
    const replyTexts = result.replies.map(r => r.text);
    await addMessage(convId, { sender: 'forli', content: replyTexts.join('\n'), type: 'text' });
    await sendReply(from, replyTexts, secrets);
}

// ── Customer conversation ─────────────────────────────────────────

async function handleCustomerMessage(params: {
    from: string;
    text: string;
    mediaUrls: string[];
    knownBizIds: string[];
    secrets: Secrets;
}) {
    const { from, text, mediaUrls, knownBizIds, secrets } = params;

    // If multiple businesses, pick the one with an active conversation
    let targetBizId = knownBizIds[0];
    let convId = buildConversationId(targetBizId, from);

    if (knownBizIds.length > 1) {
        // Find the most recent active conversation
        for (const bizId of knownBizIds) {
            const cid = buildConversationId(bizId, from);
            const conv = await getConversation(cid);
            if (conv?.status === 'active') {
                targetBizId = bizId;
                convId = cid;
                break;
            }
        }
    }

    const conv = await getConversation(convId);
    if (!conv || conv.status !== 'active') {
        // No active conversation — start fresh
        await sendReply(from, ['היי! איך אפשר לעזור?'], secrets);
        return;
    }

    const customerState = await loadCustomerState(convId);
    if (!customerState) {
        await sendReply(from, ['היי! איך אפשר לעזור?'], secrets);
        return;
    }

    // Load FAQs for this business
    const faqs = await getFaqs(targetBizId);

    // Log inbound
    await addMessage(convId, {
        sender: 'customer',
        content: text || '[media]',
        type: mediaUrls.length > 0 ? 'media' : 'text',
        mediaUrl: mediaUrls[0],
    });

    // Run customer engine
    const result = await runCustomerTurn({
        text,
        mediaUrls,
        state: customerState,
        faqs,
        apiKey: secrets.anthropicApiKey,
    });

    // Persist new state
    await saveCustomerState(convId, result.state);

    // Send replies
    if (result.replies.length > 0) {
        await addMessage(convId, { sender: 'forli', content: result.replies.join('\n'), type: 'text' });
        await sendReply(from, result.replies, secrets);
    }

    // Handle callback scheduling
    if (result.callbackSet && result.state.callbackTime) {
        const { findBusinessById } = await import('../db/businesses');
        const biz = await findBusinessById(targetBizId);
        if (biz) {
            await saveCallback({
                businessId: targetBizId,
                callerPhone: from,
                businessPhone: biz.phone,
                scheduledIso: result.state.callbackTime,
                conversationId: convId,
            });
        }
    }

    // Handle urgent callback — send alert to business
    if (result.urgentCallback) {
        const { findBusinessById } = await import('../db/businesses');
        const biz = await findBusinessById(targetBizId);
        if (biz) {
            const alertMsg =
                `🔴 *שיחה דחופה!*\nלקוח ${from} מבקש שתחזור אליו עכשיו.\nסיבה: ${result.state.issueDescription ?? 'לא צוינה'}`;
            await sendWhatsApp({
                to: `whatsapp:${biz.phone}`,
                from: `whatsapp:${secrets.whatsappNumber}`,
                body: alertMsg,
                accountSid: secrets.accountSid,
                authToken: secrets.authToken,
            });
        }
    }

    // Close conversation if needed
    if (result.shouldClose) {
        const messages = await import('../db/conversations').then(m => m.getMessages(convId));
        const history = messages.map(msg => ({
            sender: msg.sender === 'customer' ? 'customer' as const : 'forli' as const,
            text: msg.content,
        }));

        const { findBusinessById } = await import('../db/businesses');
        const biz = await findBusinessById(targetBizId);

        const summary = await generateConversationSummary({
            apiKey: secrets.anthropicApiKey,
            businessName: result.state.businessName,
            callerPhone: from,
            messages: history,
            callbackTime: result.state.callbackDisplay,
        });

        await closeConversationWithSummary(convId, summary, result.state.callbackTime);

        // Send summary to business
        if (biz) {
            const summaryMsg = `📋 *סיכום שיחה*\nמספר: ${from}\n${summary}`;
            await sendWhatsApp({
                to: `whatsapp:${biz.phone}`,
                from: `whatsapp:${secrets.whatsappNumber}`,
                body: summaryMsg,
                accountSid: secrets.accountSid,
                authToken: secrets.authToken,
            });
        }

        // Send summary to customer
        const customerSummaryMsg =
            result.state.callbackDisplay
                ? `תודה! קבעתי שיחה חוזרת ל${result.state.callbackDisplay}. ${result.state.businessName} יצור איתך קשר.`
                : `תודה על פנייתך! ${result.state.businessName} יחזור אליך בהקדם.`;
        await sendWhatsApp({
            to: `whatsapp:${from}`,
            from: `whatsapp:${secrets.whatsappNumber}`,
            body: customerSummaryMsg,
            accountSid: secrets.accountSid,
            authToken: secrets.authToken,
        });
    }
}

// ── Prospect flow ─────────────────────────────────────────────────

async function handleProspectMessage(params: {
    from: string;
    text: string;
    secrets: Secrets;
}) {
    const { from, text, secrets } = params;
    const convId = `prospect_${from.replace(/\+/g, '')}`;

    let state: ForliState = (await loadOnboardingState(convId)) ?? createInitialState();

    await saveOnboardingState(convId, state);
    await addMessage(convId, { sender: 'customer', content: text, type: 'text' });

    const result = runForliTurn({
        text,
        state,
        isExistingBusiness: false,
    });

    await saveOnboardingState(convId, result.state);

    // If onboarding complete — create business record
    if (result.businessPayload) {
        const bizId = await createBusiness(from, {
            ownerName: result.businessPayload.ownerName,
            businessName: result.businessPayload.businessName,
            description: result.businessPayload.description,
            plan: 'basic',
            status: 'pending',
        });

        await upsertCustomer(from, bizId, true);

        const onboardUrl = `${secrets.appBaseUrl}/onboard/${bizId}`;
        result.replies.push({
            text: `הלינק שלך להרשמה:\n${onboardUrl}`,
        });
    }

    const replyTexts = result.replies.map(r => r.text);
    if (replyTexts.length > 0) {
        await addMessage(convId, { sender: 'forli', content: replyTexts.join('\n'), type: 'text' });
        await sendReply(from, replyTexts, secrets);
    }
}
