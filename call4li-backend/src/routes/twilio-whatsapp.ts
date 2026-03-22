/**
 * POST /twilio/whatsapp
 * Main handler for all incoming WhatsApp messages.
 *
 * Routing:
 *   1. Sender is a registered business  → onboarding / management engine
 *   2. Sender has an active customer conversation → Claude-powered customer engine
 *   3. Unknown number → prospect onboarding flow
 */

import type { Request, Response } from 'express';
import { sendWhatsApp } from '../twilio';
import { summariseConversation } from '../claude';
import type { ChatMessage } from '../claude';
import { forliCustomerTurn } from '../claude';
import {
    findBusinessByPhone,
    findBusinessById,
    getFaqs,
    getProducts,
    createBusiness,
} from '../db/businesses';
import {
    addMessage,
    loadCustomerState,
    saveCustomerState,
    loadOnboardingState,
    saveOnboardingState,
    closeConversationWithSummary,
    buildConversationId,
    getConversation,
    getMessages,
    getOrCreateConversation,
} from '../db/conversations';
import { getKnownBusinessesForPhone, upsertCustomer } from '../db/customers';
import { saveCallback } from '../db/callbacks';
import { runForliTurn, createInitialState } from '../forli-onboarding';
import type { ForliState } from '../forli-onboarding';
import { normalisePhone, stripWaPrefix } from '../helpers';

// ── Parse incoming Twilio body ────────────────────────────────────

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

async function send(to: string, messages: string[]): Promise<void> {
    for (const msg of messages) {
        await sendWhatsApp(`whatsapp:${to}`, msg);
    }
}

// ── Main handler ──────────────────────────────────────────────────

export async function twilioWhatsAppHandler(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);

    const { from, text, mediaUrls } = parseBody(req.body as Record<string, string>);
    if (!from) return;

    try {
        // 1. Is the sender a registered business?
        const senderBusiness = await findBusinessByPhone(from);
        if (senderBusiness) {
            await handleBusinessMessage(from, text, senderBusiness);
            return;
        }

        // 2. Does the sender have an active customer conversation?
        const knownBizIds = await getKnownBusinessesForPhone(from);
        if (knownBizIds.length > 0) {
            await handleCustomerMessage(from, text, mediaUrls, knownBizIds);
            return;
        }

        // 3. Unknown number — prospect onboarding
        await handleProspectMessage(from, text);
    } catch (err) {
        console.error('twilioWhatsAppHandler error:', err);
    }
}

// ── Business onboarding / management ─────────────────────────────

async function handleBusinessMessage(
    from: string,
    text: string,
    business: Awaited<ReturnType<typeof findBusinessByPhone>> & object,
): Promise<void> {
    const convId = `onboarding_${from.replace(/\+/g, '')}`;

    let state: ForliState = (await loadOnboardingState(convId)) ?? createInitialState();

    await saveOnboardingState(convId, state); // ensure doc exists
    await addMessage(convId, { sender: 'customer', content: text, type: 'text' });

    const result = runForliTurn({
        text,
        state,
        isExistingBusiness: true,
        activeBusinessName: business.businessName,
    });

    await saveOnboardingState(convId, result.state);

    if (result.businessPayload) {
        const { updateBusiness } = await import('../db/businesses');
        await updateBusiness(business.id, {
            ownerName: result.businessPayload.ownerName,
            businessName: result.businessPayload.businessName,
            description: result.businessPayload.description,
        });
    }

    const replyTexts = result.replies.map(r => r.text);
    await addMessage(convId, { sender: 'forli', content: replyTexts.join('\n'), type: 'text' });
    await send(from, replyTexts);
}

// ── Customer conversation (Claude-powered) ────────────────────────

async function handleCustomerMessage(
    from: string,
    text: string,
    mediaUrls: string[],
    knownBizIds: string[],
): Promise<void> {
    // Find the most recent active conversation
    let targetBizId = knownBizIds[0];
    let convId = buildConversationId(targetBizId, from);

    if (knownBizIds.length > 1) {
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
        await send(from, ['היי! איך אפשר לעזור?']);
        return;
    }

    const customerState = await loadCustomerState(convId);
    if (!customerState) {
        await send(from, ['היי! איך אפשר לעזור?']);
        return;
    }

    // Load business context for Claude
    const [biz, faqs, products] = await Promise.all([
        findBusinessById(targetBizId),
        getFaqs(targetBizId),
        getProducts(targetBizId),
    ]);

    if (!biz) return;

    // Log inbound message
    await addMessage(convId, {
        sender: 'customer',
        content: text || '[media]',
        type: mediaUrls.length > 0 ? 'media' : 'text',
        mediaUrl: mediaUrls[0],
    });

    // Build conversation history for Claude
    const rawMessages = await getMessages(convId);
    const history: ChatMessage[] = rawMessages
        .filter(m => m.sender === 'customer' || m.sender === 'forli')
        .map(m => ({
            sender: m.sender === 'customer' ? 'customer' : 'forli',
            content: m.content,
        }));

    // Claude customer turn
    const result = await forliCustomerTurn({
        businessName: biz.businessName,
        faqs,
        products,
        businessHours: biz.businessHours,
        history,
        newMessage: text || '[media]',
        mediaUrls,
    });

    // Update state
    customerState.messageCount += 1;
    customerState.lastMessageAt = Date.now();
    if (result.callbackTime) customerState.callbackTime = result.callbackTime;
    await saveCustomerState(convId, customerState);

    // Send reply
    if (result.reply) {
        await addMessage(convId, { sender: 'forli', content: result.reply, type: 'text' });
        await send(from, [result.reply]);
    }

    // Handle callback scheduling
    if (result.action === 'schedule' && result.callbackTime) {
        await saveCallback({
            businessId: targetBizId,
            callerPhone: from,
            businessPhone: biz.phone,
            scheduledIso: result.callbackTime,
            conversationId: convId,
        });
    }

    // Handle urgent — alert business
    if (result.action === 'urgent') {
        const alertMsg =
            `🔴 *שיחה דחופה!*\nלקוח ${from} מבקש שתחזור אליו עכשיו.`;
        await sendWhatsApp(`whatsapp:${biz.phone}`, alertMsg);
    }

    // Close conversation on schedule / urgent / close actions
    const shouldClose = result.action === 'schedule' || result.action === 'urgent' || result.action === 'close';
    if (shouldClose) {
        const allMessages = await getMessages(convId);
        const historyForSummary: ChatMessage[] = allMessages
            .filter(m => m.sender === 'customer' || m.sender === 'forli')
            .map(m => ({
                sender: m.sender === 'customer' ? 'customer' : 'forli',
                content: m.content,
            }));

        const summary = await summariseConversation({
            businessName: biz.businessName,
            callerPhone: from,
            history: historyForSummary,
            callbackTime: result.callbackTime ?? undefined,
        });

        await closeConversationWithSummary(convId, summary, result.callbackTime ?? undefined);

        // Send summary to business
        await sendWhatsApp(
            `whatsapp:${biz.phone}`,
            `📋 *סיכום שיחה*\nמספר: ${from}\n${summary}`,
        );

        // Send closing message to customer
        const closingMsg = result.callbackTime
            ? `תודה! קבעתי שיחה חוזרת. ${biz.businessName} יצור איתך קשר.`
            : `תודה על פנייתך! ${biz.businessName} יחזור אליך בהקדם.`;
        await sendWhatsApp(`whatsapp:${from}`, closingMsg);
    }
}

// ── Prospect onboarding ───────────────────────────────────────────

async function handleProspectMessage(from: string, text: string): Promise<void> {
    const convId = `prospect_${from.replace(/\+/g, '')}`;

    let state: ForliState = (await loadOnboardingState(convId)) ?? createInitialState();

    await saveOnboardingState(convId, state);
    await addMessage(convId, { sender: 'customer', content: text, type: 'text' });

    const result = runForliTurn({ text, state, isExistingBusiness: false });

    await saveOnboardingState(convId, result.state);

    if (result.businessPayload) {
        const bizId = await createBusiness(from, {
            ownerName: result.businessPayload.ownerName,
            businessName: result.businessPayload.businessName,
            description: result.businessPayload.description,
            plan: 'basic',
            status: 'pending',
        });

        await upsertCustomer(from, bizId, true);

        // Create the initial onboarding conversation doc
        await getOrCreateConversation(bizId, from, 'business');

        const onboardUrl = `${process.env.APP_BASE_URL}/onboard/${bizId}`;
        result.replies.push({ text: `הלינק שלך להרשמה:\n${onboardUrl}` });
    }

    const replyTexts = result.replies.map(r => r.text);
    if (replyTexts.length > 0) {
        await addMessage(convId, { sender: 'forli', content: replyTexts.join('\n'), type: 'text' });
        await send(from, replyTexts);
    }
}
