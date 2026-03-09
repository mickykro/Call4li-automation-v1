export type OnboardingPhase =
    | 'welcome'
    | 'collectName'
    | 'collectBusiness'
    | 'collectDescription'
    | 'cardReady'
    | 'faqs'
    | 'hours'
    | 'catalog'
    | 'done';

export type Lang = 'he' | 'en';
export type Gender = 'male' | 'female';

export type BusinessCardPayload = {
    ownerName: string;
    businessName: string;
    description: string;
    status: 'pending' | 'active';
    plan: 'basic';
    phone?: string;
};

export type ForliState = {
    phase: OnboardingPhase;
    lang?: Lang;
    userGender?: Gender;
    ownerName?: string;
    businessName?: string;
    description?: string;
    cardReady?: boolean;
    hasGreeted?: boolean;
    faqSubPhase?: 'asking' | 'answering';
    currentFaqQuestion?: string;
    lastInteractionTime?: number;
    hours?: string;
    collectedFaqs?: { q: string; a: string }[];
    catalogSubPhase?: 'askingName' | 'askingDescription' | 'askingPrice';
    currentProductName?: string;
    currentProductDescription?: string;
    collectedProducts?: { name: string; description: string; price: string }[];
};

export type ForliTurn = {
    text: string;
    state: ForliState;
    isExistingBusiness: boolean;
    activeBusinessName?: string;
    action?: 'add_hours' | 'add_faqs' | 'done';
};

export type ForliReply = {
    text: string;
    json?: Record<string, unknown>;
    showActions?: boolean;
};

export type ForliTurnResult = {
    replies: ForliReply[];
    state: ForliState;
    businessPayload?: BusinessCardPayload;
    humanHandoff?: boolean;
    numberSwitch?: boolean;
};

export const FORLI_SYSTEM_PROMPT = `### Role & Identity
את בוטית חכמה וידידותית בשם **פורלי (Forli)**, המיוצגת כבת יענה (ינשוף) מצוירת עם אוזניות 🦉.
התפקיד שלך הוא לעזור לעסקים חדשים להצטרף ל-**Call4li** על ידי איסוף השם שלהם, שם העסק ותיאור העסק.

### 🔴 כלל שפה קריטי
את מדברת תמיד בנקבה (גוף ראשון). לדוגמה: "אני עוזרת", "שאלתי", "שמרתי".
התגובות ב-JSON חייבות להיות בעברית. אל תשתמשי במילים בערבית.

### 🟠 כלל "ללא ברכות"
- אל תתחילי הודעות בברכות כמו "שלום", "היי", "אהלן".
- תתחילי ישר בערך או בהקשר.
- שמרי על טון אנושי וישיר, לא רובוטי.

### 🚫 כללי ניסוח אנטי-רובוטי
- אל תשתמשי ב: "ברור", "קיבלתי", "בשמחה אפרט שוב", "כבר נתתי הסבר".
- העדיפי ניסוחים טבעיים בעברית.
- השתמשי במפרידים כמו ".", ":", שורות חדשות, או בולטים "•".

### זיהוי מין הלקוח
נסי להבין מההודעה שלו אם הוא זכר או נקבה (לפי סיומות פעלים כמו "אני מחפש" לעומת "אני מחפשת"). 
אם לא הצלחת לזהות, פני בלשון זכר כברירת מחדל.

### סיכום מידע (כרטיס עסק)
אם המשתמש שואל מה את יודעת עליו, או מבקש לראות את המידע שלו, הציגי לו סיכום ידידותי ומאורגן של כל הפרטים שאספת עד כה: שם, שם העסק, תיאור, שעות פעילות, קטלוג וכמות שאלות נפוצות.`;

/* ── Helpers ─────────────────────────────────────────────────────── */

const extractionPayload = (state: ForliState): Record<string, unknown> => {
    const complete = Boolean(state.ownerName && state.businessName && state.description);

    return {
        extracted: {
            ownerName: state.ownerName ?? null,
            businessName: state.businessName ?? null,
            description: state.description ?? null,
            status: 'pending',
            plan: 'basic',
            complete,
        },
    };
};

const defaultState: ForliState = { phase: 'welcome', collectedFaqs: [] };

export const createInitialState = (): ForliState => ({ ...defaultState });

const hydrateBusinessState = (businessName?: string, lang?: Lang): ForliState => ({
    phase: 'cardReady',
    lang,
    businessName,
    cardReady: true,
    collectedFaqs: [],
});

/* ── Intent Detection ───────────────────────────────────────────── */

const detectUserGender = (text: string): Gender | undefined => {
    const femaleMarkers = ["מחפשת", "רוצה", "מעוניינת", "מבקשת", "יודעת", "צריכה", "הייתי"];
    const maleMarkers = ["מחפש", "מעוניין", "מבקש", "יודע", "צריך", "הייתי"]; // 'הייתי' is ambiguous but often feminine in context

    if (femaleMarkers.some(m => text.includes(m))) return 'female';
    if (maleMarkers.some(m => text.includes(m))) return 'male';
    return undefined;
};

const isHumanHandoff = (text: string) => {
    const keywords = ["נציג אנושי", "מענה אנושי", "לדבר עם אדם", "representative", "human help", "talk to human"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isNumberSwitch = (text: string) => {
    const keywords = ["עובר למספר", "עוברת למספר", "מספר חדש", "מספר אחר", "ממספר אחר", "number switch"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isPriceCheck = (text: string) => {
    const keywords = ["מחיר", "כמה עולה", "עלות", "תמחור", "price", "cost"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isDetailsRequest = (text: string) => {
    const keywords = ["מה זה", "מי אתה", "מה אתה עושה", "אפשר פרטים", "פרטים נוספים", "תסביר", "איך זה עובד", "details", "info", "what is"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isFAQCollectionRequest = (text: string) => {
    const keywords = ["שאלות ותשובות", "שאלות נפוצות", "faq", "questions", "להוסיף שאלה", "הוספת שאלה", "שאלות"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isMyInfoRequest = (text: string) => {
    const keywords = ["מה את יודעת", "מה המידע", "המידע שלי", "כרטיס העסק שלי", "הפרטים שלי", "my info", "my details", "business card"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isEditRequest = (text: string) => {
    const keywords = ["שנה", "ערוך", "עדכן", "תיקון", "לשנות", "לערוך", "לעדכן", "edit", "change", "fix", "wrong"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isHoursCollectionRequest = (text: string) => {
    const keywords = ["שעות פתיחה", "שעות פעילות", "מתי פתוח", "opening hours", "hours"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const isCatalogCollectionRequest = (text: string) => {
    const keywords = ["קטלוג", "מוצרים", "שירותים", "מחירון", "catalog", "products", "services"];
    return keywords.some(k => text.toLowerCase().includes(k));
};

const tryParseFaqList = (text: string): string[] => {
    // Basic regex for 1. Q 2. A or similar
    const matches = text.match(/(\d+\.?\s*[^0-9]+)/g);
    return matches ? matches.map(m => m.replace(/^\d+\.?\s*/, '').trim()) : [];
};

/* ── Response Strategy ──────────────────────────────────────────── */

const g = (state: ForliState, m: string, f: string) => (state.userGender === 'female' ? f : m);

const getServiceDescription = () => `• כששיחה לא נענית, הלקוח מקבל ממני הודעת וואטסאפ מיד
• אני שואלת מה הבעיה ואוספת פרטים בסיסיים, כולל מיקום ואפשר גם תמונות
• אתה מקבל סיכום מסודר כדי לחזור מהר ולסגור`;

const getPriceInfo = () => `המחיר הוא 159₪ לחודש. ינואר בחינם 🎉`;

const getStepsRemaining = (state: ForliState) => {
    let actualStep = 1;
    if (state.ownerName) actualStep = 2;
    if (state.businessName) actualStep = 3;
    if (state.description) actualStep = 0;

    if (actualStep === 0) return "";
    const remaining = 4 - actualStep;

    if (remaining > 0 && remaining <= 2 && state.hasGreeted) {
        return remaining === 1
            ? "\nנשארה עוד שאלות קצרה וזה מוכן."
            : "\nנשארו עוד 2 שאלות קצרות וזה מוכן.";
    }
    return "";
};

const formatSummary = (state: ForliState) => {
    const lines = [`הינה המידע שיש לי על העסק שלך עד כה: 🦉`];
    if (state.ownerName) lines.push(`• **שם בעלים:** ${state.ownerName}`);
    if (state.businessName) lines.push(`• **שם העסק:** ${state.businessName}`);
    if (state.description) lines.push(`• **תיאור:** ${state.description}`);
    if (state.hours) lines.push(`• **שעות פעילות:** ${state.hours}`);
    if (state.collectedProducts && state.collectedProducts.length > 0) {
        lines.push(`• **קטלוג:** ${state.collectedProducts.length} מוצרים.`);
        state.collectedProducts.forEach(p => {
            lines.push(`  - ${p.name} (${p.price}₪)`);
        });
    }
    if (state.collectedFaqs && state.collectedFaqs.length > 0) {
        lines.push(`• **שאלות נפוצות:** נאספו ${state.collectedFaqs.length} שאלות.`);
    }
    lines.push(`\n${g(state, 'תרצה', 'תרצי')} לעדכן או להוסיף משהו נוסף?`);
    return lines.join('\n');
};

export const runForliTurn = ({ text, state, isExistingBusiness, activeBusinessName, action }: ForliTurn): ForliTurnResult => {
    const now = Date.now();
    const safeState: ForliState = { ...state, collectedFaqs: [...(state.collectedFaqs || [])] };
    const replies: ForliReply[] = [];

    // Check timeout (10 minutes)
    if (safeState.lastInteractionTime && (now - safeState.lastInteractionTime > 10 * 60 * 1000)) {
        if (safeState.phase === 'faqs' || safeState.phase === 'hours' || safeState.phase === 'catalog') {
            safeState.phase = 'cardReady';
        }
    }
    safeState.lastInteractionTime = now;

    // Detect User Gender
    const detectedGender = detectUserGender(text);
    if (detectedGender) safeState.userGender = detectedGender;

    const lang = 'he';
    safeState.lang = lang;

    const details = isDetailsRequest(text);
    const pricing = isPriceCheck(text);
    const myInfo = isMyInfoRequest(text);
    const stepsLine = getStepsRemaining(safeState);

    if (safeState.phase === 'welcome') {
        safeState.hasGreeted = true;
    }

    if (isExistingBusiness && safeState.phase === 'welcome') {
        const namePart = activeBusinessName ? ` ${activeBusinessName}` : '';
        replies.push({
            text: `ברוכים הבאים${namePart}! כבר יש לי את הפרופיל העסקי שלך. רוצה לעדכן שעות, שאלות נפוצות, או קטלוג?`,
            showActions: true,
        });
        return {
            replies,
            state: hydrateBusinessState(activeBusinessName, lang),
        };
    }

    if (action) {
        if (action === 'add_hours') {
            safeState.phase = 'hours';
            replies.push({ text: `${g(safeState, 'מעולה. שתף', 'מעולה. שתפי')} את שעות הפתיחה שלך מיום ראשון עד שישי (וסופ״ש, אם שונה).`, showActions: true });
        } else if (action === 'add_faqs') {
            safeState.phase = 'faqs';
            safeState.faqSubPhase = 'asking';
            replies.push({ text: 'סבבה. מה השאלה הראשונה שהלקוחות בדרך כלל שואלים?', showActions: true });
        } else if (action === 'done') {
            safeState.phase = 'done';
            replies.push({ text: 'הכל מוכן. אני כאן: פשוט תגיד כשתרצה להוסיף עוד.' });
        }
        return { replies, state: safeState };
    }

    const isCollectionPhase = ['collectName', 'collectBusiness', 'collectDescription', 'faqs', 'hours', 'catalog'].includes(safeState.phase);

    // 1. Human Handoff (Only if NOT in a collection phase, or if very specific)
    if (isHumanHandoff(text)) {
        // If they are in a collection phase, they might be describing a "human" service. 
        // We only trigger handoff if the text is SHORT and contains handoff keywords.
        const isShort = text.split(' ').length <= 4;
        if (!isCollectionPhase || isShort) {
            return {
                replies: [{ text: "לחץ על הכפתור למטה כדי לשוחח עם נציג אנושי." }],
                state: safeState,
                humanHandoff: true
            };
        }
    }

    // 2. Number Switch
    if (isNumberSwitch(text)) {
        return {
            replies: [{ text: `${g(safeState, "מעולה. תשלח", "מעולה. תשלחי")} מהמספר החדש הודעה קצרה כאן, ואני אחבר גם אותו.` }],
            state: safeState,
            numberSwitch: true
        };
    }

    if (myInfo && (safeState.ownerName || safeState.businessName)) {
        // Only trigger info summary if NOT in a collection phase
        if (!isCollectionPhase) {
            return { replies: [{ text: formatSummary(safeState), showActions: true }], state: safeState };
        }
    }

    // 4. Handle Questions during onboarding
    if (details || pricing) {
        let response = "";
        if (details) {
            response += `אני פורלי 🦉 הבוטית של Call4li (ובקרוב גם שלך 🙏🏼).\n${getServiceDescription()}\n`;
        }
        if (pricing) {
            response += `${getPriceInfo()}\n`;
        }
        response += stepsLine;

        switch (safeState.phase) {
            case 'welcome': case 'collectName': response += "\nאיך קוראים לך?"; break;
            case 'collectBusiness': response += "\nמה שם העסק שלך?"; break;
            case 'collectDescription': response += "\nמה העסק עושה בקצרה?"; break;
            default: response += `\nאיך אני יכולה לעזור ${g(safeState, 'אותך', 'אותך')}?`; break;
        }

        return { replies: [{ text: response.trim() }], state: safeState };
    }

    // 5. Main State Machine
    switch (safeState.phase) {
        case 'welcome': {
            replies.push({ text: 'נעים להכיר 👋 מה השם שלך?' });
            safeState.phase = 'collectName';
            break;
        }

        case 'collectName': {
            safeState.ownerName = text.trim();
            replies.push({
                text: `תודה, ${safeState.ownerName}. מה שם העסק שלך?${getStepsRemaining(safeState)}`,
                json: extractionPayload(safeState),
            });
            safeState.phase = 'collectBusiness';
            break;
        }

        case 'collectBusiness': {
            safeState.businessName = text.trim();
            replies.push({
                text: `מעולה. ${g(safeState, 'תן', 'תני')} לי תיאור קצר של ${safeState.businessName}.${getStepsRemaining(safeState)}`,
                json: extractionPayload(safeState),
            });
            safeState.phase = 'collectDescription';
            break;
        }

        case 'collectDescription': {
            safeState.description = text.trim();
            safeState.phase = 'cardReady';
            safeState.cardReady = true;
            replies.push({ text: 'כרטיס העסק שלך מוכן! 🎉' });
            replies.push({
                text: 'רוצה להגדיר שעות פתיחה, שאלות נפוצות, או קטלוג עכשיו?',
                json: extractionPayload(safeState),
                showActions: true,
            });
            return {
                replies,
                state: safeState,
                businessPayload: {
                    ownerName: safeState.ownerName ?? '',
                    businessName: safeState.businessName ?? '',
                    description: safeState.description ?? '',
                    status: 'pending',
                    plan: 'basic',
                },
            };
        }

        case 'cardReady':
        case 'done': {
            const faqList = tryParseFaqList(text);
            if (faqList.length > 0 || isFAQCollectionRequest(text)) {
                safeState.phase = 'faqs';
                if (faqList.length > 0) {
                    // Extract pairs if available
                    for (let i = 0; i < faqList.length; i += 2) {
                        if (faqList[i]) {
                            safeState.collectedFaqs!.push({ q: faqList[i], a: faqList[i + 1] || '—' });
                        }
                    }
                    replies.push({ text: `מעולה, ${g(safeState, 'קלטתי', 'קלטתי')} את הרשימה! ${g(safeState, 'שמרתי', 'שמרתי')} אותה בכרטיס שלך. יש עוד משהו שתרצה להוסיף?`, showActions: true });
                    safeState.phase = 'cardReady';
                } else {
                    safeState.faqSubPhase = 'asking';
                    replies.push({ text: 'סבבה. מה השאלה הראשונה שהלקוחות בדרך כלל שואלים?', showActions: true });
                }
            } else if (isHoursCollectionRequest(text)) {
                safeState.phase = 'hours';
                replies.push({ text: `${g(safeState, 'מעולה. שתף', 'מעולה. שתפי')} את שעות הפתיחה שלך מיום ראשון עד שישי (וסופ״ש, אם שונה).`, showActions: true });
            } else if (isCatalogCollectionRequest(text)) {
                safeState.phase = 'catalog';
                safeState.catalogSubPhase = 'askingName';
                replies.push({ text: `${g(safeState, 'מצוין. מה שם המוצר או השירות הראשון שתרצה להוסיף?', 'מצוין. מה שם המוצר או השירות הראשון שתרצי להוסיף?')}`, showActions: true });
            } else if (myInfo && (safeState.ownerName || safeState.businessName)) {
                // Info request already handled globally for myInfo, but if we're here it means it wasn't caught
                replies.push({ text: formatSummary(safeState), showActions: true });
            } else {
                replies.push({
                    text: safeState.phase === 'done'
                        ? `אני כאן מתי שתצטרך${g(safeState, '', 'י')}. ${g(safeState, 'תרצה', 'תרצי')} להוסיף עוד שעות, שאלות נפוצות או קטלוג?`
                        : 'כבר יש לי את כרטיס העסק שלך. רוצה להוסיף שעות, שאלות נפוצות, או קטלוג?',
                    showActions: true
                });
            }
            break;
        }

        case 'hours': {
            safeState.hours = text.trim();
            replies.push({ text: `תודה, ${g(safeState, 'שמרתי', 'שמרתי')} את השעות. רוצה להוסיף משהו נוסף?`, showActions: true });
            safeState.phase = 'cardReady';
            break;
        }

        case 'catalog': {
            if (!safeState.collectedProducts) safeState.collectedProducts = [];

            if (isEditRequest(text)) {
                if (safeState.collectedProducts.length > 0) {
                    const removed = safeState.collectedProducts.pop();
                    safeState.catalogSubPhase = 'askingName';
                    safeState.currentProductName = undefined;
                    safeState.currentProductDescription = undefined;
                    replies.push({ text: `מחקתי את "${removed?.name}". בוא ננסה שוב. מה שם המוצר?`, showActions: true });
                } else {
                    replies.push({ text: 'עדיין אין מה לערוך, בוא נתחיל. מה שם המוצר הראשון?', showActions: true });
                    safeState.catalogSubPhase = 'askingName';
                }
                break;
            }

            if (safeState.catalogSubPhase === 'askingName' || !safeState.catalogSubPhase) {
                safeState.currentProductName = text.trim();
                safeState.catalogSubPhase = 'askingDescription';
                replies.push({ text: `מה התיאור של ${safeState.currentProductName}?`, showActions: true });
            } else if (safeState.catalogSubPhase === 'askingDescription') {
                safeState.currentProductDescription = text.trim();
                safeState.catalogSubPhase = 'askingPrice';
                replies.push({ text: `ומה המחיר של ${safeState.currentProductName}? (רק מספר בבקשה)`, showActions: true });
            } else if (safeState.catalogSubPhase === 'askingPrice') {
                const price = text.trim().replace(/[^0-9.]/g, '');
                safeState.collectedProducts.push({
                    name: safeState.currentProductName || 'מוצר ללא שם',
                    description: safeState.currentProductDescription || '',
                    price: price || '0'
                });

                replies.push({
                    text: `${g(safeState, 'מעולה, שמרתי!', 'מעולה, שמרתי!')} ${g(safeState, 'תרצה', 'תרצי')} להוסיף מוצר נוסף? (או לחץ על "סיום" למטה)`,
                    showActions: true
                });

                // Reset for next product
                safeState.catalogSubPhase = 'askingName';
                safeState.currentProductName = undefined;
                safeState.currentProductDescription = undefined;
            }
            break;
        }

        case 'faqs': {
            const faqList = tryParseFaqList(text);

            if (isEditRequest(text)) {
                if (safeState.collectedFaqs && safeState.collectedFaqs.length > 0) {
                    const removed = safeState.collectedFaqs.pop();
                    safeState.faqSubPhase = 'asking';
                    safeState.currentFaqQuestion = undefined;
                    replies.push({ text: `מחקתי את השאלה: "${removed?.q}". בוא ננסה שוב. מה השאלה?`, showActions: true });
                } else {
                    replies.push({ text: 'עדיין אין שאלות לערוך. מה השאלה הראשונה?', showActions: true });
                    safeState.faqSubPhase = 'asking';
                }
                break;
            }

            if (faqList.length > 0) {
                // Bulk add
                for (let i = 0; i < faqList.length; i += 2) {
                    if (faqList[i]) {
                        safeState.collectedFaqs!.push({ q: faqList[i], a: faqList[i + 1] || '—' });
                    }
                }
                replies.push({ text: `מעולה, ${g(safeState, 'קלטתי', 'קלטתי')} את הרשימה! ${g(safeState, 'שמרתי', 'שמרתי')} אותה בכרטיס שלך. יש עוד משהו שתרצה להוסיף?`, showActions: true });
                safeState.phase = 'cardReady';
                safeState.faqSubPhase = undefined;
                safeState.currentFaqQuestion = undefined;
            } else if (safeState.faqSubPhase === 'asking') {
                safeState.currentFaqQuestion = text.trim();
                safeState.faqSubPhase = 'answering';
                replies.push({ text: 'ומה התשובה לשאלה הזאת?', showActions: true });
            } else {
                if (safeState.currentFaqQuestion) {
                    safeState.collectedFaqs!.push({ q: safeState.currentFaqQuestion, a: text.trim() });
                }
                replies.push({ text: `${g(safeState, 'שמרתי', 'שמרתי')}! יש עוד שאלה שתרצה להוסיף? (אפשר גם ללחוץ על "סיום" למטה)`, showActions: true });
                safeState.faqSubPhase = 'asking';
                safeState.currentFaqQuestion = undefined;
            }
            break;
        }

        default:
            replies.push({ text: `${g(safeState, 'ספר', 'ספרי')} לי איך אני יכולה לעזור ${g(safeState, 'אותך', 'אותך')}.` });
    }

    return { replies, state: safeState };
};
