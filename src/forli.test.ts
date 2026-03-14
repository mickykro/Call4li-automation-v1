import { describe, it, expect } from 'vitest';
import {
    createInitialState,
    runForliTurn,
    type ForliState,
} from './forli';

// ── helpers ──────────────────────────────────────────────────────────────────

const turn = (
    text: string,
    state: ForliState = createInitialState(),
    opts: { isExistingBusiness?: boolean; activeBusinessName?: string } = {},
) =>
    runForliTurn({
        text,
        state,
        isExistingBusiness: opts.isExistingBusiness ?? false,
        activeBusinessName: opts.activeBusinessName,
    });

// ── createInitialState ────────────────────────────────────────────────────────

describe('createInitialState', () => {
    it('returns welcome phase with empty faq list', () => {
        const state = createInitialState();
        expect(state.phase).toBe('welcome');
        expect(state.collectedFaqs).toEqual([]);
    });

    it('returns a fresh object each call', () => {
        const a = createInitialState();
        const b = createInitialState();
        expect(a).not.toBe(b);
    });
});

// ── welcome phase ─────────────────────────────────────────────────────────────

describe('welcome phase', () => {
    it('greets and moves to collectName', () => {
        const result = turn('שלום');
        expect(result.state.phase).toBe('collectName');
        expect(result.replies[0].text).toContain('מה השם שלך');
    });

    it('handles existing business on welcome', () => {
        const result = turn('שלום', createInitialState(), {
            isExistingBusiness: true,
            activeBusinessName: 'Fix Fit',
        });
        expect(result.state.phase).toBe('cardReady');
        expect(result.replies[0].showActions).toBe(true);
        expect(result.replies[0].text).toContain('Fix Fit');
    });
});

// ── onboarding happy path ─────────────────────────────────────────────────────

describe('onboarding happy path', () => {
    it('collects name → business → description', () => {
        // Step 1 – welcome
        let r = turn('היי');
        expect(r.state.phase).toBe('collectName');

        // Step 2 – name
        r = turn('דוד', r.state);
        expect(r.state.ownerName).toBe('דוד');
        expect(r.state.phase).toBe('collectBusiness');
        expect(r.replies[0].json).toBeTruthy();

        // Step 3 – business
        r = turn('דוד פלאמבינג', r.state);
        expect(r.state.businessName).toBe('דוד פלאמבינג');
        expect(r.state.phase).toBe('collectDescription');

        // Step 4 – description
        r = turn('שירותי אינסטלציה לכל הבית', r.state);
        expect(r.state.description).toBe('שירותי אינסטלציה לכל הבית');
        expect(r.state.phase).toBe('cardReady');
        expect(r.state.cardReady).toBe(true);
        expect(r.businessPayload).toMatchObject({
            ownerName: 'דוד',
            businessName: 'דוד פלאמבינג',
            description: 'שירותי אינסטלציה לכל הבית',
            status: 'pending',
            plan: 'basic',
        });
    });

    it('emits json extraction payload at each collection step', () => {
        let r = turn('שלום');
        r = turn('שרה', r.state);
        expect(r.replies[0].json).toHaveProperty('extracted.ownerName', 'שרה');
        expect(r.replies[0].json).toHaveProperty('extracted.complete', false);

        r = turn('עסק שרה', r.state);
        expect(r.replies[0].json).toHaveProperty('extracted.businessName', 'עסק שרה');

        r = turn('מספרה', r.state);
        expect(r.replies[r.replies.length - 1].json).toHaveProperty('extracted.complete', true);
    });
});

// ── hours phase ───────────────────────────────────────────────────────────────

describe('hours phase', () => {
    const cardReadyState = (): ForliState => ({
        phase: 'cardReady',
        ownerName: 'דוד',
        businessName: 'דוד פלאמבינג',
        description: 'אינסטלציה',
        cardReady: true,
        collectedFaqs: [],
        lang: 'he',
    });

    it('enters hours phase via keyword', () => {
        const r = turn('שעות פתיחה', cardReadyState());
        expect(r.state.phase).toBe('hours');
    });

    it('saves hours and returns to cardReady', () => {
        let r = turn('שעות פתיחה', cardReadyState());
        r = turn('ראשון-חמישי 09:00-18:00', r.state);
        expect(r.state.hours).toBe('ראשון-חמישי 09:00-18:00');
        expect(r.state.phase).toBe('cardReady');
        expect(r.replies[0].text).toContain('שמרתי');
    });

    it('enters hours phase via action', () => {
        const r = runForliTurn({
            text: 'Add Hours',
            state: cardReadyState(),
            isExistingBusiness: true,
            action: 'add_hours',
        });
        expect(r.state.phase).toBe('hours');
        expect(r.replies[0].showActions).toBe(true);
    });
});

// ── FAQs phase ────────────────────────────────────────────────────────────────

describe('FAQs phase', () => {
    const cardReadyState = (): ForliState => ({
        phase: 'cardReady',
        ownerName: 'שרה',
        businessName: 'מספרה',
        description: 'תספורות',
        cardReady: true,
        collectedFaqs: [],
        lang: 'he',
    });

    it('enters FAQ collection via keyword', () => {
        const r = turn('שאלות נפוצות', cardReadyState());
        expect(r.state.phase).toBe('faqs');
        expect(r.state.faqSubPhase).toBe('asking');
    });

    it('collects Q&A pair', () => {
        let r = turn('שאלות נפוצות', cardReadyState());
        r = turn('האם צריך תור מראש?', r.state);
        expect(r.state.faqSubPhase).toBe('answering');
        expect(r.state.currentFaqQuestion).toBe('האם צריך תור מראש?');

        r = turn('כן, מומלץ להזמין', r.state);
        expect(r.state.collectedFaqs).toHaveLength(1);
        expect(r.state.collectedFaqs![0]).toEqual({ q: 'האם צריך תור מראש?', a: 'כן, מומלץ להזמין' });
        expect(r.state.faqSubPhase).toBe('asking');
    });

    it('handles edit (undo last FAQ)', () => {
        const stateWithFaq: ForliState = {
            ...cardReadyState(),
            phase: 'faqs',
            faqSubPhase: 'asking',
            collectedFaqs: [{ q: 'שאלה 1', a: 'תשובה 1' }],
        };

        const r = turn('שנה', stateWithFaq);
        expect(r.state.collectedFaqs).toHaveLength(0);
        expect(r.state.faqSubPhase).toBe('asking');
        expect(r.replies[0].text).toContain('שאלה 1');
    });

    it('enters FAQs via action', () => {
        const r = runForliTurn({
            text: 'Add FAQs',
            state: cardReadyState(),
            isExistingBusiness: true,
            action: 'add_faqs',
        });
        expect(r.state.phase).toBe('faqs');
        expect(r.state.faqSubPhase).toBe('asking');
    });
});

// ── catalog phase ─────────────────────────────────────────────────────────────

describe('catalog phase', () => {
    const cardReadyState = (): ForliState => ({
        phase: 'cardReady',
        ownerName: 'אלי',
        businessName: 'אלי שופ',
        description: 'חנות',
        cardReady: true,
        collectedFaqs: [],
        lang: 'he',
    });

    it('enters catalog via keyword', () => {
        const r = turn('קטלוג', cardReadyState());
        expect(r.state.phase).toBe('catalog');
        expect(r.state.catalogSubPhase).toBe('askingName');
    });

    it('collects a full product name → description → price', () => {
        let r = turn('קטלוג', cardReadyState());

        r = turn('כיסא', r.state);
        expect(r.state.catalogSubPhase).toBe('askingDescription');
        expect(r.state.currentProductName).toBe('כיסא');

        r = turn('כיסא נוח לסלון', r.state);
        expect(r.state.catalogSubPhase).toBe('askingPrice');

        r = turn('250', r.state);
        expect(r.state.collectedProducts).toHaveLength(1);
        expect(r.state.collectedProducts![0]).toEqual({
            name: 'כיסא',
            description: 'כיסא נוח לסלון',
            price: '250',
        });
        expect(r.state.catalogSubPhase).toBe('askingName');
    });

    it('strips non-numeric chars from price', () => {
        const state: ForliState = {
            ...cardReadyState(),
            phase: 'catalog',
            catalogSubPhase: 'askingPrice',
            currentProductName: 'שולחן',
            currentProductDescription: 'שולחן עץ',
            collectedProducts: [],
        };
        const r = turn('₪350.50', state);
        expect(r.state.collectedProducts![0].price).toBe('350.50');
    });

    it('handles edit (undo last product)', () => {
        const state: ForliState = {
            ...cardReadyState(),
            phase: 'catalog',
            catalogSubPhase: 'askingName',
            collectedProducts: [{ name: 'ספה', description: 'ספה גדולה', price: '1500' }],
        };
        const r = turn('שנה', state);
        expect(r.state.collectedProducts).toHaveLength(0);
        expect(r.state.catalogSubPhase).toBe('askingName');
        expect(r.replies[0].text).toContain('ספה');
    });
});

// ── intent detection ──────────────────────────────────────────────────────────

describe('intent detection', () => {
    it('triggers human handoff', () => {
        const r = turn('נציג אנושי');
        expect(r.humanHandoff).toBe(true);
        expect(r.replies[0].text).toContain('נציג אנושי');
    });

    it('does NOT trigger handoff inside a long description', () => {
        // "לדבר עם אדם" embedded in a long sentence — should not handoff
        const state: ForliState = { phase: 'collectDescription', collectedFaqs: [] };
        const r = turn('אני מציע שירות לדבר עם אדם מקצועי על בעיות הנדסיות בבית', state);
        expect(r.humanHandoff).toBeUndefined();
    });

    it('triggers number switch', () => {
        const r = turn('עובר למספר חדש');
        expect(r.numberSwitch).toBe(true);
    });

    it('detects female gender', () => {
        const r = turn('אני מחפשת עזרה');
        expect(r.state.userGender).toBe('female');
    });

    it('detects male gender', () => {
        const r = turn('אני מחפש עסק טוב');
        expect(r.state.userGender).toBe('male');
    });

    it('shows service description on details request', () => {
        const r = turn('מה זה call4li');
        expect(r.replies[0].text).toContain('פורלי');
    });

    it('shows price on pricing request', () => {
        const r = turn('כמה עולה');
        expect(r.replies[0].text).toContain('159');
    });
});

// ── done action ───────────────────────────────────────────────────────────────

describe('done action', () => {
    it('moves to done phase', () => {
        const state: ForliState = {
            phase: 'cardReady',
            ownerName: 'אבי',
            businessName: 'אבי בע"מ',
            description: 'עסק',
            cardReady: true,
            collectedFaqs: [],
        };
        const r = runForliTurn({ text: "I'm Done", state, isExistingBusiness: true, action: 'done' });
        expect(r.state.phase).toBe('done');
    });
});

// ── timeout reset ─────────────────────────────────────────────────────────────

describe('timeout reset', () => {
    it('resets faqs/hours/catalog phase back to cardReady after 10+ min', () => {
        const state: ForliState = {
            phase: 'faqs',
            faqSubPhase: 'asking',
            collectedFaqs: [],
            lastInteractionTime: Date.now() - 11 * 60 * 1000,
        };
        const r = turn('שלום', state);
        expect(r.state.phase).toBe('cardReady');
    });
});

// ── my info request ───────────────────────────────────────────────────────────

describe('my info request', () => {
    it('shows business summary', () => {
        const state: ForliState = {
            phase: 'cardReady',
            ownerName: 'יוסי',
            businessName: 'יוסי בע"מ',
            description: 'נגרות',
            cardReady: true,
            collectedFaqs: [{ q: 'שאלה?', a: 'תשובה' }],
            hours: 'א-ה 08:00-17:00',
        };
        const r = turn('מה המידע שלי', state);
        expect(r.replies[0].text).toContain('יוסי');
        expect(r.replies[0].text).toContain('יוסי בע"מ');
        expect(r.replies[0].text).toContain('נגרות');
        expect(r.replies[0].text).toContain('שעות פעילות');
    });
});
