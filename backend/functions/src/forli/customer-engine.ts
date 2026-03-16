/**
 * Customer conversation engine.
 * Handles the flow after a customer's call goes unanswered and Forli
 * reaches out via WhatsApp on behalf of the business.
 * Uses Claude (via claude.ts) for time parsing, FAQ answers, and summaries.
 */

import type { CustomerConversationState, CustomerTurnResult, Lang } from './types';
import { parseCallbackTime, answerFromFaq } from '../claude';
import type { FaqPair } from '../claude';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ── Intent Detection ──────────────────────────────────────────────

const isUrgentCallbackRequest = (text: string): boolean => {
    const keywords = [
        'שיחה עכשיו', 'התקשר אלי', 'דחוף', 'urgent', 'call me now', 'call back now',
        'עכשיו', '1', '١',
    ];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isScheduleRequest = (text: string): boolean => {
    const keywords = [
        'קביעת שיחה', 'לקבוע שיחה', 'שיחה בתאריך', 'שיחה בשעה', 'שיחה ב',
        'מחר', 'בשבוע', 'schedule', 'set a time', 'book', 'appointment',
        'פגישה', '2', '٢',
    ];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isMediaMessage = (mediaUrls: string[]): boolean => mediaUrls.length > 0;

// ── Helpers ───────────────────────────────────────────────────────

const detectLang = (text: string): Lang => {
    // Simple heuristic: presence of Hebrew/Arabic unicode ranges
    if (/[\u0590-\u05FF]/.test(text)) return 'he';
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    return 'en';
};

const openingMessage = (businessName: string, lang: Lang, buttons: string[]): string => {
    const buttonList = buttons.map((b, i) => `${i + 1}. ${b}`).join('\n');
    switch (lang) {
        case 'ar':
            return `مرحباً، أنا فورلي مساعدة ${businessName}. لاحظت أنك حاولت الاتصال بنا — كيف يمكنني مساعدتك؟\n\n${buttonList}`;
        case 'en':
            return `Hi, I'm Forli, ${businessName}'s assistant. I noticed you tried to reach us — how can I help?\n\n${buttonList}`;
        default: // he
            return `היי, אני פורלי העוזרת של ${businessName}. ראיתי שניסית להתקשר אלינו — איך אפשר לעזור?\n\n${buttonList}`;
    }
};

// ── Public API ────────────────────────────────────────────────────

export function createCustomerState(params: {
    businessId: string;
    businessName: string;
    callerPhone: string;
}): CustomerConversationState {
    return {
        phase: 'awaiting',
        businessId: params.businessId,
        businessName: params.businessName,
        callerPhone: params.callerPhone,
        lastMessageAt: Date.now(),
        messageCount: 0,
    };
}

export function buildOpeningMessage(
    businessName: string,
    lang: Lang = 'he',
    customButtons?: string[],
): string {
    const defaultButtons =
        lang === 'ar'
            ? ['اتصل الآن', 'تحديد موعد']
            : lang === 'en'
                ? ['Call me now', 'Schedule a call']
                : ['שיחה עכשיו', 'קביעת שיחה'];
    return openingMessage(businessName, lang, customButtons ?? defaultButtons);
}

export async function runCustomerTurn(params: {
    text: string;
    mediaUrls: string[];
    state: CustomerConversationState;
    faqs: FaqPair[];
    apiKey: string;
    customButtons?: string[];
}): Promise<CustomerTurnResult> {
    const { text, mediaUrls, state, faqs, apiKey } = params;
    const s: CustomerConversationState = { ...state };
    const replies: string[] = [];

    let shouldClose = false;
    let callbackSet = false;
    let urgentCallback = false;

    s.messageCount += 1;

    // Detect language on first customer message
    if (!s.lang) {
        s.lang = detectLang(text);
    }

    const lang = s.lang;

    // Timeout check
    const timedOut = Date.now() - s.lastMessageAt > TIMEOUT_MS;
    s.lastMessageAt = Date.now();

    if (timedOut && s.phase === 'collecting') {
        // Will be handled by the scheduler — just mark for closure
        shouldClose = true;
        return { replies: [], state: s, shouldClose, callbackSet: false, urgentCallback: false };
    }

    s.phase = 'collecting';

    // Handle media
    if (isMediaMessage(mediaUrls)) {
        s.issueDescription = (s.issueDescription ?? '') + ' [קובץ/תמונה שנשלחה]';
        switch (lang) {
            case 'ar':
                replies.push('تم استلام الملف، سأرسله إلى الفريق مع الملخص.');
                break;
            case 'en':
                replies.push("Got your file — I'll include it in the summary for the team.");
                break;
            default:
                replies.push('קיבלתי את הקובץ — אעביר אותו לצוות עם הסיכום.');
        }
        return { replies, state: s, shouldClose: false, callbackSet: false, urgentCallback: false };
    }

    // Urgent callback
    if (isUrgentCallbackRequest(text)) {
        urgentCallback = true;
        shouldClose = true;
        switch (lang) {
            case 'ar':
                replies.push(`سأُبلغ ${s.businessName} فوراً وسيتصلون بك في أقرب وقت ممكن.`);
                break;
            case 'en':
                replies.push(`I'll alert ${s.businessName} right away — they'll call you back as soon as possible.`);
                break;
            default:
                replies.push(`מעביר הודעה דחופה ל${s.businessName} עכשיו — הם יחזרו אליך בהקדם.`);
        }
        return { replies, state: s, shouldClose, callbackSet, urgentCallback };
    }

    // Schedule callback
    if (isScheduleRequest(text)) {
        // Try to parse the time
        const parsed = await parseCallbackTime({
            apiKey,
            text,
            nowIso: new Date().toISOString(),
        });

        if (parsed) {
            s.callbackTime = parsed.iso;
            s.callbackDisplay = parsed.display;
            callbackSet = true;
            shouldClose = true;
            switch (lang) {
                case 'ar':
                    replies.push(`ممتاز! حجزت موعداً لـ${parsed.display}. سيتصل بك ${s.businessName}.`);
                    break;
                case 'en':
                    replies.push(`Perfect! I've scheduled a call for ${parsed.display}. ${s.businessName} will call you then.`);
                    break;
                default:
                    replies.push(`מעולה! קבעתי שיחה חוזרת ל${parsed.display}. ${s.businessName} יתקשר אליך אז.`);
            }
        } else {
            // Couldn't parse — ask for clarification
            switch (lang) {
                case 'ar':
                    replies.push('متى يناسبك؟ (مثال: غداً الساعة 10، بين 4 و6)');
                    break;
                case 'en':
                    replies.push('When works for you? (e.g. "tomorrow at 10", "between 4 and 6")');
                    break;
                default:
                    replies.push('מתי נוח לך? (למשל: "מחר ב-10", "בין 4 ל-6")');
            }
            return { replies, state: s, shouldClose: false, callbackSet: false, urgentCallback: false };
        }

        return { replies, state: s, shouldClose, callbackSet, urgentCallback };
    }

    // FAQ answer via Claude
    if (text.trim().length > 3) {
        const faqAnswer = await answerFromFaq({ apiKey, businessName: s.businessName, faqs, question: text });
        if (faqAnswer) {
            replies.push(faqAnswer);
            // Offer further options
            switch (lang) {
                case 'ar':
                    replies.push('هل هناك شيء آخر يمكنني مساعدتك به؟\n1. اتصل الآن\n2. تحديد موعد');
                    break;
                case 'en':
                    replies.push('Anything else I can help with?\n1. Call me now\n2. Schedule a call');
                    break;
                default:
                    replies.push('יש עוד משהו שאפשר לעזור בו?\n1. שיחה עכשיו\n2. קביעת שיחה');
            }
            return { replies, state: s, shouldClose: false, callbackSet: false, urgentCallback: false };
        }
    }

    // No FAQ match — collect issue description and escalate
    s.issueDescription = text.trim();
    switch (lang) {
        case 'ar':
            replies.push(`سؤال جيد! سأُرسل رسالة إلى المستشار من قِبَل ${s.businessName}.`);
            replies.push('في غضون ذلك، هل تريد تحديد موعد للاتصال؟\n1. اتصل الآن\n2. تحديد موعد');
            break;
        case 'en':
            replies.push(`Good question! I'll pass it on to a representative from ${s.businessName}.`);
            replies.push('Meanwhile, would you like to schedule a call?\n1. Call me now\n2. Schedule a call');
            break;
        default:
            replies.push(`שאלה טובה! אעביר ליועץ מטעם ${s.businessName}.`);
            replies.push('בינתיים, תרצה לקבוע שיחה?\n1. שיחה עכשיו\n2. קביעת שיחה');
    }

    return { replies, state: s, shouldClose: false, callbackSet: false, urgentCallback: false };
}
