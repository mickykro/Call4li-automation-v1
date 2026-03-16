import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
    if (!_client) {
        _client = new Anthropic({ apiKey });
    }
    return _client;
}

export interface FaqPair {
    q: string;
    a: string;
}

export interface ConversationMessage {
    sender: 'customer' | 'forli';
    text: string;
}

/**
 * Use Claude to generate a concise conversation summary for the business.
 * Returns a Hebrew summary string.
 */
export async function generateConversationSummary(params: {
    apiKey: string;
    businessName: string;
    callerPhone: string;
    messages: ConversationMessage[];
    callbackTime?: string;
}): Promise<string> {
    const client = getClient(params.apiKey);
    const history = params.messages
        .map(m => `${m.sender === 'customer' ? 'לקוח' : 'פורלי'}: ${m.text}`)
        .join('\n');

    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [
            {
                role: 'user',
                content: `אתה עוזר לעסק "${params.businessName}". לקוח עם מספר ${params.callerPhone} פנה דרך פורלי לאחר שלא נענה.

שיחה:
${history}

${params.callbackTime ? `זמן שיחה חוזרת שנקבע: ${params.callbackTime}` : ''}

כתוב סיכום קצר בעברית (3-5 שורות) לבעל העסק הכולל:
• סיבת הפנייה
• הפרטים שמסר הלקוח
• זמן שיחה חוזרת (אם נקבע)
• כל מידע חשוב אחר

כתוב ישירות ללא פתיח.`,
            },
        ],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'לא ניתן לייצר סיכום';
}

/**
 * Use Claude to parse a natural-language time expression into a structured datetime.
 * Returns an ISO string or null if parsing fails.
 */
export async function parseCallbackTime(params: {
    apiKey: string;
    text: string;
    nowIso: string;
}): Promise<{ iso: string; display: string } | null> {
    const client = getClient(params.apiKey);

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [
            {
                role: 'user',
                content: `עכשיו: ${params.nowIso}

המשתמש אמר: "${params.text}"

פרש את הזמן שביקש לשיחה חוזרת. החזר JSON בלבד בפורמט הבא (ללא תגיות markdown):
{"iso": "2026-03-15T10:00:00+02:00", "display": "מחר ב-10:00"}

אם לא ניתן לפרש, החזר: null`,
            },
        ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    try {
        const trimmed = content.text.trim();
        if (trimmed === 'null') return null;
        return JSON.parse(trimmed) as { iso: string; display: string };
    } catch {
        return null;
    }
}

/**
 * Use Claude to answer a customer question using the business's FAQ data.
 * Returns an answer string, or null if the FAQ doesn't cover this question.
 */
export async function answerFromFaq(params: {
    apiKey: string;
    businessName: string;
    faqs: FaqPair[];
    question: string;
}): Promise<string | null> {
    if (params.faqs.length === 0) return null;

    const client = getClient(params.apiKey);

    const faqText = params.faqs.map(f => `ש: ${f.q}\nת: ${f.a}`).join('\n\n');

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
            {
                role: 'user',
                content: `אתה פורלי, העוזרת של "${params.businessName}". ענה לשאלת הלקוח בהסתמך על השאלות הנפוצות בלבד.

שאלות נפוצות:
${faqText}

שאלת הלקוח: "${params.question}"

אם השאלה מכוסה בשאלות הנפוצות, ענה בעברית טבעית קצר וממוקד.
אם השאלה אינה מכוסה, החזר רק המילה: NULL`,
            },
        ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    const answer = content.text.trim();
    if (answer === 'NULL') return null;
    return answer;
}

/**
 * Use Claude to detect the language of a message.
 * Returns 'he' | 'ar' | 'en' | 'other'.
 */
export async function detectLanguage(params: {
    apiKey: string;
    text: string;
}): Promise<'he' | 'ar' | 'en' | 'other'> {
    const client = getClient(params.apiKey);

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [
            {
                role: 'user',
                content: `Identify the language of the following text. Reply with ONLY one of: he, ar, en, other

Text: "${params.text.slice(0, 200)}"`,
            },
        ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return 'other';
    const lang = content.text.trim().toLowerCase();
    if (['he', 'ar', 'en'].includes(lang)) return lang as 'he' | 'ar' | 'en';
    return 'other';
}
