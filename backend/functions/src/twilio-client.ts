import twilio from 'twilio';

let _client: twilio.Twilio | null = null;

export function getTwilioClient(accountSid: string, authToken: string): twilio.Twilio {
    if (!_client) {
        _client = twilio(accountSid, authToken);
    }
    return _client;
}

export interface SendWhatsAppParams {
    to: string;
    body: string;
    from: string;
    accountSid: string;
    authToken: string;
    mediaUrl?: string[];
}

/**
 * Send a WhatsApp message via Twilio.
 * `to` and `from` should include the whatsapp: prefix.
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<void> {
    const client = getTwilioClient(params.accountSid, params.authToken);

    const toNumber = params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`;
    const fromNumber = params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`;

    await client.messages.create({
        from: fromNumber,
        to: toNumber,
        body: params.body,
        ...(params.mediaUrl ? { mediaUrl: params.mediaUrl } : {}),
    });
}

/**
 * Send a WhatsApp message with interactive quick-reply buttons.
 * WhatsApp Business API supports up to 3 buttons via content templates.
 * For simplicity we send button labels inline in the message body.
 * When Twilio supports Content API templates you can upgrade this.
 */
export async function sendWhatsAppWithButtons(params: {
    to: string;
    body: string;
    buttons: string[];
    from: string;
    accountSid: string;
    authToken: string;
}): Promise<void> {
    const buttonText = params.buttons.map((b, i) => `${i + 1}. ${b}`).join('\n');
    await sendWhatsApp({
        ...params,
        body: `${params.body}\n\n${buttonText}`,
    });
}

/**
 * Build a TwiML response that says "sorry, please hold" and hangs up.
 * Used as a response body for voice webhooks (Twilio expects TwiML XML).
 */
export function buildSilentTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
}
