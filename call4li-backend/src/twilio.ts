import twilio from 'twilio';

let _client: ReturnType<typeof twilio> | null = null;

function client(): ReturnType<typeof twilio> {
    if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    return _client;
}

/** Send a WhatsApp message. `to` is an E.164 number (no prefix needed). */
export async function sendWhatsApp(to: string, body: string, mediaUrl?: string[]): Promise<void> {
    const from = process.env.TWILIO_WHATSAPP_NUMBER!;
    await client().messages.create({
        from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body,
        ...(mediaUrl ? { mediaUrl } : {}),
    });
}

/** TwiML response that silently ends the call — returned to Twilio for voice webhooks. */
export function silentTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
}
