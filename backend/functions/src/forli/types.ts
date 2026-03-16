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

export type Lang = 'he' | 'ar' | 'en';
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

// ── Customer conversation types ────────────────────────────────────

export type CustomerConversationPhase =
    | 'awaiting'      // just received opening message, waiting for customer response
    | 'collecting'    // gathering details from customer
    | 'scheduled'     // callback scheduled
    | 'closed';       // conversation summarised and closed

export type CustomerConversationState = {
    phase: CustomerConversationPhase;
    businessId: string;
    businessName: string;
    callerPhone: string;
    lang?: Lang;
    callbackTime?: string;        // ISO string
    callbackDisplay?: string;     // human-readable
    issueDescription?: string;
    lastMessageAt: number;        // epoch ms
    messageCount: number;
};

export type CustomerTurnResult = {
    replies: string[];
    state: CustomerConversationState;
    shouldClose: boolean;         // true when conversation should be summarised
    callbackSet: boolean;
    urgentCallback: boolean;
};
