import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
const ai = () => _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Types ─────────────────────────────────────────────────────────

export interface FaqPair     { q: string; a: string }
export interface Product     { name: string; description: string; price: string }
export interface ChatMessage { sender: 'customer' | 'forli'; content: string }
export type ForliAction = 'none' | 'schedule' | 'urgent' | 'close';

export interface ForliTurnResult {
    reply: string;
    action: ForliAction;
    callbackTime: string | null;   // ISO 8601, only when action === 'schedule'
}

// ── Forli Customer AI Engine ──────────────────────────────────────
/**
 * Full Claude-powered response engine for customer conversations.
 *
 * Given all available business context and the conversation so far,
 * Claude decides what to say and what action to take next.
 *
 * Uses claude-haiku (fast + cheap) and returns strict JSON.
 */
export async function forliCustomerTurn(params: {
    businessName: string;
    faqs: FaqPair[];
    products: Product[];
    businessHours?: string;
    history: ChatMessage[];
    newMessage: string;
    mediaUrls: string[];
}): Promise<ForliTurnResult> {
    const { businessName, faqs, products, businessHours, history, newMessage, mediaUrls } = params;

    const now = new Date().toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'short',
        timeStyle: 'short',
    });

    const faqBlock = faqs.length
        ? faqs.map(f => `ש: ${f.q}\nת: ${f.a}`).join('\n\n')
        : 'לא הוגדרו שאלות נפוצות.';

    const productBlock = products.length
        ? products.map(p => `• ${p.name} — ${p.description} — ${p.price}₪`).join('\n')
        : 'לא הוגדר קטלוג.';

    const historyBlock = history.length
        ? history.map(m => `${m.sender === 'customer' ? 'לקוח' : 'פורלי'}: ${m.content}`).join('\n')
        : '(תחילת השיחה)';

    const mediaNote = mediaUrls.length ? `\n[הלקוח שלח ${mediaUrls.length} קובץ/תמונה]` : '';

    const system = `אתה פורלי 🦉, העוזרת של העסק "${businessName}".
לקוח ניסה להתקשר ולא נענה. אתה פנית אליו ב-WhatsApp בשמם.

מטרתך:
1. לברר מה הלקוח צריך ולעזור אם אפשר.
2. לענות לפי שאלות נפוצות בלבד — אל תמציא מידע.
3. לקבוע שיחה חוזרת אם הלקוח מבקש.
4. לשלוח התראה דחופה אם הלקוח צריך מענה מיידי.

שעות פעילות: ${businessHours ?? 'לא צוינו'}
שאלות נפוצות:\n${faqBlock}
מוצרים/שירותים:\n${productBlock}
שעה נוכחית (ישראל): ${now}

כללים:
• ענה באותה שפה שהלקוח כותב (עברית / ערבית / אנגלית).
• תשובות קצרות — 2–4 משפטים לכל היותר.
• אם שאלה אינה בשאלות נפוצות: "שאלה טובה! אעביר ליועץ מטעם ${businessName}."

החזר JSON בלבד (ללא markdown):
{
  "reply": "<הטקסט ללקוח>",
  "action": "none" | "schedule" | "urgent" | "close",
  "callbackTime": "<ISO 8601 או null>"
}

action:
• "none"     — שיחה נמשכת
• "schedule" — לקוח קבע שיחה חוזרת (callbackTime חייב להיות מלא)
• "urgent"   — הלקוח רוצה מענה דחוף
• "close"    — השיחה הסתיימה`;

    const userMsg = `היסטוריה:\n${historyBlock}\n\nהודעה חדשה: ${newMessage}${mediaNote}`;

    try {
        const res = await ai().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system,
            messages: [{ role: 'user', content: userMsg }],
        });
        const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
        const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(clean) as ForliTurnResult;
        return {
            reply: parsed.reply ?? '',
            action: parsed.action ?? 'none',
            callbackTime: parsed.callbackTime ?? null,
        };
    } catch (err) {
        console.error('forliCustomerTurn error:', err);
        return { reply: 'אני כאן לעזור — מה הסיבה שהתקשרת?', action: 'none', callbackTime: null };
    }
}

// ── Utilities ─────────────────────────────────────────────────────

/** Generate a concise Hebrew summary of a closed conversation for the business owner. */
export async function summariseConversation(params: {
    businessName: string;
    callerPhone: string;
    history: ChatMessage[];
    callbackTime?: string;
}): Promise<string> {
    const historyText = params.history
        .map(m => `${m.sender === 'customer' ? 'לקוח' : 'פורלי'}: ${m.content}`)
        .join('\n');

    const res = await ai().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
            role: 'user',
            content: `אתה עוזר לעסק "${params.businessName}".
לקוח ${params.callerPhone} פנה דרך פורלי.

שיחה:
${historyText}
${params.callbackTime ? `\nזמן שיחה חוזרת: ${params.callbackTime}` : ''}

כתוב סיכום קצר בעברית (3–5 שורות) לבעל העסק:
• סיבת הפנייה
• פרטים שמסר הלקוח
• זמן שיחה חוזרת (אם נקבע)
כתוב ישירות ללא פתיח.`,
        }],
    });

    const c = res.content[0];
    return c.type === 'text' ? c.text : 'לא ניתן לייצר סיכום.';
}
