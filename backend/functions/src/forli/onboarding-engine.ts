/**
 * Forli onboarding engine — server-side port of the frontend forli.ts.
 * Handles the WhatsApp-based business registration flow.
 * Uses the rules-based state machine; no Claude calls needed here.
 */

import type {
    ForliState,
    ForliTurn,
    ForliTurnResult,
    ForliReply,
    Gender,
} from './types';

/* ── Helpers ─────────────────────────────────────────────────────── */

const g = (state: ForliState, m: string, f: string) =>
    state.userGender === 'female' ? f : m;

const extractionPayload = (state: ForliState): Record<string, unknown> => ({
    extracted: {
        ownerName: state.ownerName ?? null,
        businessName: state.businessName ?? null,
        description: state.description ?? null,
        status: 'pending',
        plan: 'basic',
        complete: Boolean(state.ownerName && state.businessName && state.description),
    },
});

export const createInitialState = (): ForliState => ({
    phase: 'welcome',
    collectedFaqs: [],
});

const hydrateBusinessState = (businessName?: string): ForliState => ({
    phase: 'cardReady',
    businessName,
    cardReady: true,
    collectedFaqs: [],
});

/* ── Intent Detection ───────────────────────────────────────────── */

const detectUserGender = (text: string): Gender | undefined => {
    const femaleMarkers = ['מחפשת', 'רוצה', 'מעוניינת', 'מבקשת', 'יודעת', 'צריכה'];
    const maleMarkers = ['מחפש', 'מעוניין', 'מבקש', 'יודע', 'צריך'];
    if (femaleMarkers.some(m => text.includes(m))) return 'female';
    if (maleMarkers.some(m => text.includes(m))) return 'male';
    return undefined;
};

const isHumanHandoff = (text: string) =>
    ['נציג אנושי', 'מענה אנושי', 'לדבר עם אדם', 'representative', 'human help'].some(k =>
        text.toLowerCase().includes(k),
    );

const isNumberSwitch = (text: string) =>
    ['עובר למספר', 'עוברת למספר', 'מספר חדש', 'מספר אחר', 'ממספר אחר', 'number switch'].some(k =>
        text.toLowerCase().includes(k),
    );

const isPriceCheck = (text: string) =>
    ['מחיר', 'כמה עולה', 'עלות', 'תמחור', 'price', 'cost'].some(k =>
        text.toLowerCase().includes(k),
    );

const isDetailsRequest = (text: string) =>
    ['מה זה', 'מי אתה', 'אפשר פרטים', 'תסביר', 'איך זה עובד', 'details', 'info', 'what is'].some(
        k => text.toLowerCase().includes(k),
    );

const isFAQCollectionRequest = (text: string) =>
    ['שאלות ותשובות', 'שאלות נפוצות', 'faq', 'להוסיף שאלה', 'שאלות'].some(k =>
        text.toLowerCase().includes(k),
    );

const isMyInfoRequest = (text: string) =>
    ['מה את יודעת', 'המידע שלי', 'כרטיס העסק', 'הפרטים שלי', 'my info', 'business card'].some(k =>
        text.toLowerCase().includes(k),
    );

const isEditRequest = (text: string) =>
    ['שנה', 'ערוך', 'עדכן', 'תיקון', 'לשנות', 'לערוך', 'edit', 'change', 'fix', 'wrong'].some(k =>
        text.toLowerCase().includes(k),
    );

const isHoursCollectionRequest = (text: string) =>
    ['שעות פתיחה', 'שעות פעילות', 'מתי פתוח', 'opening hours', 'hours'].some(k =>
        text.toLowerCase().includes(k),
    );

const isCatalogCollectionRequest = (text: string) =>
    ['קטלוג', 'מוצרים', 'שירותים', 'מחירון', 'catalog', 'products', 'services'].some(k =>
        text.toLowerCase().includes(k),
    );

const tryParseFaqList = (text: string): string[] => {
    const matches = text.match(/(\d+\.?\s*[^0-9]+)/g);
    return matches ? matches.map(m => m.replace(/^\d+\.?\s*/, '').trim()) : [];
};

const getServiceDescription = () =>
    '• כששיחה לא נענית, הלקוח מקבל ממני הודעת וואטסאפ מיד\n' +
    '• אני שואלת מה הבעיה ואוספת פרטים בסיסיים\n' +
    '• אתה מקבל סיכום מסודר כדי לחזור מהר ולסגור';

const getPriceInfo = () => 'המחיר הוא 159₪ לחודש. החודש הראשון בחינם 🎉';

const getStepsRemaining = (state: ForliState): string => {
    let step = 1;
    if (state.ownerName) step = 2;
    if (state.businessName) step = 3;
    if (state.description) step = 0;
    if (step === 0) return '';
    const remaining = 4 - step;
    if (remaining > 0 && remaining <= 2 && state.hasGreeted) {
        return remaining === 1
            ? '\nנשארה עוד שאלה קצרה וזה מוכן.'
            : '\nנשארו עוד 2 שאלות קצרות וזה מוכן.';
    }
    return '';
};

const formatSummary = (state: ForliState): string => {
    const lines = ['הינה המידע שיש לי על העסק שלך עד כה: 🦉'];
    if (state.ownerName) lines.push(`• שם בעלים: ${state.ownerName}`);
    if (state.businessName) lines.push(`• שם העסק: ${state.businessName}`);
    if (state.description) lines.push(`• תיאור: ${state.description}`);
    if (state.hours) lines.push(`• שעות פעילות: ${state.hours}`);
    if (state.collectedProducts?.length) {
        lines.push(`• קטלוג: ${state.collectedProducts.length} מוצרים.`);
        state.collectedProducts.forEach(p => lines.push(`  - ${p.name} (${p.price}₪)`));
    }
    if (state.collectedFaqs?.length) {
        lines.push(`• שאלות נפוצות: נאספו ${state.collectedFaqs.length} שאלות.`);
    }
    lines.push(`\n${g(state, 'תרצה', 'תרצי')} לעדכן או להוסיף משהו נוסף?`);
    return lines.join('\n');
};

/* ── Main Engine ────────────────────────────────────────────────── */

export const runForliTurn = ({
    text,
    state,
    isExistingBusiness,
    activeBusinessName,
    action,
}: ForliTurn): ForliTurnResult => {
    const now = Date.now();
    const s: ForliState = {
        ...state,
        collectedFaqs: [...(state.collectedFaqs ?? [])],
        collectedProducts: [...(state.collectedProducts ?? [])],
    };
    const replies: ForliReply[] = [];

    // Timeout: return to cardReady if idle > 10 min in an optional sub-phase
    if (s.lastInteractionTime && now - s.lastInteractionTime > 10 * 60 * 1000) {
        if (s.phase === 'faqs' || s.phase === 'hours' || s.phase === 'catalog') {
            s.phase = 'cardReady';
        }
    }
    s.lastInteractionTime = now;

    // Gender detection
    const detectedGender = detectUserGender(text);
    if (detectedGender) s.userGender = detectedGender;

    if (s.phase === 'welcome') s.hasGreeted = true;

    // Existing business: jump straight to cardReady
    if (isExistingBusiness && s.phase === 'welcome') {
        const namePart = activeBusinessName ? ` ${activeBusinessName}` : '';
        replies.push({
            text: `ברוכים הבאים${namePart}! כבר יש לי את הפרופיל העסקי שלך. רוצה לעדכן שעות, שאלות נפוצות, או קטלוג?`,
            showActions: true,
        });
        return { replies, state: hydrateBusinessState(activeBusinessName) };
    }

    // Action buttons from dashboard / web
    if (action) {
        if (action === 'add_hours') {
            s.phase = 'hours';
            replies.push({
                text: `${g(s, 'מעולה. שתף', 'מעולה. שתפי')} את שעות הפתיחה שלך.`,
                showActions: true,
            });
        } else if (action === 'add_faqs') {
            s.phase = 'faqs';
            s.faqSubPhase = 'asking';
            replies.push({ text: 'סבבה. מה השאלה הראשונה שהלקוחות בדרך כלל שואלים?', showActions: true });
        } else if (action === 'done') {
            s.phase = 'done';
            replies.push({ text: 'הכל מוכן. אני כאן: פשוט תגיד כשתרצה להוסיף עוד.' });
        }
        return { replies, state: s };
    }

    const isCollectionPhase = ['collectName', 'collectBusiness', 'collectDescription', 'faqs', 'hours', 'catalog'].includes(s.phase);

    // Human handoff
    if (isHumanHandoff(text) && (!isCollectionPhase || text.split(' ').length <= 4)) {
        return {
            replies: [{ text: 'לחץ על הכפתור למטה כדי לשוחח עם נציג אנושי.' }],
            state: s,
            humanHandoff: true,
        };
    }

    // Number switch
    if (isNumberSwitch(text)) {
        return {
            replies: [{ text: `${g(s, 'מעולה. תשלח', 'מעולה. תשלחי')} מהמספר החדש הודעה קצרה כאן, ואני אחבר גם אותו.` }],
            state: s,
            numberSwitch: true,
        };
    }

    // Info summary (only outside collection phases)
    if (isMyInfoRequest(text) && !isCollectionPhase && (s.ownerName || s.businessName)) {
        return { replies: [{ text: formatSummary(s), showActions: true }], state: s };
    }

    // Details / pricing questions
    if (isDetailsRequest(text) || isPriceCheck(text)) {
        let response = '';
        if (isDetailsRequest(text)) response += `אני פורלי 🦉 הבוטית של Call4li.\n${getServiceDescription()}\n`;
        if (isPriceCheck(text)) response += `${getPriceInfo()}\n`;
        response += getStepsRemaining(s);
        switch (s.phase) {
            case 'welcome': case 'collectName': response += '\nאיך קוראים לך?'; break;
            case 'collectBusiness': response += '\nמה שם העסק שלך?'; break;
            case 'collectDescription': response += '\nמה העסק עושה בקצרה?'; break;
            default: response += `\nאיך אני יכולה לעזור ${g(s, 'אותך', 'אותך')}?`; break;
        }
        return { replies: [{ text: response.trim() }], state: s };
    }

    // State machine
    switch (s.phase) {
        case 'welcome': {
            replies.push({ text: 'נעים להכיר 👋 מה השם שלך?' });
            s.phase = 'collectName';
            break;
        }

        case 'collectName': {
            s.ownerName = text.trim();
            replies.push({
                text: `תודה, ${s.ownerName}. מה שם העסק שלך?${getStepsRemaining(s)}`,
                json: extractionPayload(s),
            });
            s.phase = 'collectBusiness';
            break;
        }

        case 'collectBusiness': {
            s.businessName = text.trim();
            replies.push({
                text: `מעולה. ${g(s, 'תן', 'תני')} לי תיאור קצר של ${s.businessName}.${getStepsRemaining(s)}`,
                json: extractionPayload(s),
            });
            s.phase = 'collectDescription';
            break;
        }

        case 'collectDescription': {
            s.description = text.trim();
            s.phase = 'cardReady';
            s.cardReady = true;
            replies.push({ text: 'כרטיס העסק שלך מוכן! 🎉' });
            replies.push({
                text: 'רוצה להגדיר שעות פתיחה, שאלות נפוצות, או קטלוג עכשיו?',
                json: extractionPayload(s),
                showActions: true,
            });
            return {
                replies,
                state: s,
                businessPayload: {
                    ownerName: s.ownerName ?? '',
                    businessName: s.businessName ?? '',
                    description: s.description ?? '',
                    status: 'pending',
                    plan: 'basic',
                },
            };
        }

        case 'cardReady':
        case 'done': {
            const faqList = tryParseFaqList(text);
            if (faqList.length > 0 || isFAQCollectionRequest(text)) {
                s.phase = 'faqs';
                if (faqList.length > 0) {
                    for (let i = 0; i < faqList.length; i += 2) {
                        if (faqList[i]) s.collectedFaqs!.push({ q: faqList[i], a: faqList[i + 1] ?? '—' });
                    }
                    replies.push({ text: 'מעולה, קלטתי את הרשימה! שמרתי אותה בכרטיס שלך. יש עוד משהו שתרצה להוסיף?', showActions: true });
                    s.phase = 'cardReady';
                } else {
                    s.faqSubPhase = 'asking';
                    replies.push({ text: 'סבבה. מה השאלה הראשונה שהלקוחות בדרך כלל שואלים?', showActions: true });
                }
            } else if (isHoursCollectionRequest(text)) {
                s.phase = 'hours';
                replies.push({ text: `${g(s, 'מעולה. שתף', 'מעולה. שתפי')} את שעות הפתיחה שלך.`, showActions: true });
            } else if (isCatalogCollectionRequest(text)) {
                s.phase = 'catalog';
                s.catalogSubPhase = 'askingName';
                replies.push({ text: `${g(s, 'מצוין. מה שם המוצר או השירות הראשון שתרצה להוסיף?', 'מצוין. מה שם המוצר או השירות הראשון שתרצי להוסיף?')}`, showActions: true });
            } else if (isMyInfoRequest(text)) {
                replies.push({ text: formatSummary(s), showActions: true });
            } else {
                replies.push({
                    text: s.phase === 'done'
                        ? `אני כאן מתי שתצטרך${g(s, '', 'י')}. ${g(s, 'תרצה', 'תרצי')} להוסיף עוד שעות, שאלות נפוצות או קטלוג?`
                        : 'כבר יש לי את כרטיס העסק שלך. רוצה להוסיף שעות, שאלות נפוצות, או קטלוג?',
                    showActions: true,
                });
            }
            break;
        }

        case 'hours': {
            s.hours = text.trim();
            replies.push({ text: `תודה, שמרתי את השעות. רוצה להוסיף משהו נוסף?`, showActions: true });
            s.phase = 'cardReady';
            break;
        }

        case 'catalog': {
            if (!s.collectedProducts) s.collectedProducts = [];

            if (isEditRequest(text)) {
                if (s.collectedProducts.length > 0) {
                    const removed = s.collectedProducts.pop();
                    s.catalogSubPhase = 'askingName';
                    s.currentProductName = undefined;
                    s.currentProductDescription = undefined;
                    replies.push({ text: `מחקתי את "${removed?.name}". בוא ננסה שוב. מה שם המוצר?`, showActions: true });
                } else {
                    replies.push({ text: 'עדיין אין מה לערוך, בוא נתחיל. מה שם המוצר הראשון?', showActions: true });
                    s.catalogSubPhase = 'askingName';
                }
                break;
            }

            if (s.catalogSubPhase === 'askingName' || !s.catalogSubPhase) {
                s.currentProductName = text.trim();
                s.catalogSubPhase = 'askingDescription';
                replies.push({ text: `מה התיאור של ${s.currentProductName}?`, showActions: true });
            } else if (s.catalogSubPhase === 'askingDescription') {
                s.currentProductDescription = text.trim();
                s.catalogSubPhase = 'askingPrice';
                replies.push({ text: `ומה המחיר של ${s.currentProductName}? (רק מספר בבקשה)`, showActions: true });
            } else if (s.catalogSubPhase === 'askingPrice') {
                const price = text.replace(/[^0-9.]/g, '');
                s.collectedProducts.push({
                    name: s.currentProductName ?? 'מוצר ללא שם',
                    description: s.currentProductDescription ?? '',
                    price: price || '0',
                });
                replies.push({ text: `מעולה, שמרתי! ${g(s, 'תרצה', 'תרצי')} להוסיף מוצר נוסף? (או כתוב "סיום")`, showActions: true });
                s.catalogSubPhase = 'askingName';
                s.currentProductName = undefined;
                s.currentProductDescription = undefined;
            }
            break;
        }

        case 'faqs': {
            const faqList = tryParseFaqList(text);

            if (isEditRequest(text)) {
                if (s.collectedFaqs?.length) {
                    const removed = s.collectedFaqs.pop();
                    s.faqSubPhase = 'asking';
                    s.currentFaqQuestion = undefined;
                    replies.push({ text: `מחקתי את השאלה: "${removed?.q}". בוא ננסה שוב. מה השאלה?`, showActions: true });
                } else {
                    replies.push({ text: 'עדיין אין שאלות לערוך. מה השאלה הראשונה?', showActions: true });
                    s.faqSubPhase = 'asking';
                }
                break;
            }

            if (faqList.length > 0) {
                for (let i = 0; i < faqList.length; i += 2) {
                    if (faqList[i]) s.collectedFaqs!.push({ q: faqList[i], a: faqList[i + 1] ?? '—' });
                }
                replies.push({ text: 'מעולה, קלטתי את הרשימה! שמרתי אותה בכרטיס שלך. יש עוד משהו שתרצה להוסיף?', showActions: true });
                s.phase = 'cardReady';
                s.faqSubPhase = undefined;
                s.currentFaqQuestion = undefined;
            } else if (s.faqSubPhase === 'asking') {
                s.currentFaqQuestion = text.trim();
                s.faqSubPhase = 'answering';
                replies.push({ text: 'ומה התשובה לשאלה הזאת?', showActions: true });
            } else {
                if (s.currentFaqQuestion) {
                    s.collectedFaqs!.push({ q: s.currentFaqQuestion, a: text.trim() });
                }
                replies.push({ text: 'שמרתי! יש עוד שאלה שתרצה להוסיף? (אפשר גם לכתוב "סיום")', showActions: true });
                s.faqSubPhase = 'asking';
                s.currentFaqQuestion = undefined;
            }
            break;
        }

        default:
            replies.push({ text: `${g(s, 'ספר', 'ספרי')} לי איך אני יכולה לעזור.` });
    }

    return { replies, state: s };
};
