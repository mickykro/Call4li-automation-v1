import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bot,
    Send,
    Sparkles,
    Phone,
    Settings,
    UserRound,
    Building2,
    MessageSquare,
    Clock3,
    HelpCircle,
    CheckCircle2,
    Loader2,
    Database,
    Languages,
} from 'lucide-react';
import {
    createInitialState,
    FORLI_SYSTEM_PROMPT,
    runForliTurn,
    type ForliReply,
    type ForliState,
} from './forli';
import {
    ConversationStatus,
    createBusinessCard,
    ensureConversation,
    findBusinessByPhone,
    logConversationMessage,
    updateConversationStatus,
} from './firestoreHelpers';

type ChatMessage = {
    id: string;
    sender: 'user' | 'forli' | 'system';
    text: string;
    json?: Record<string, unknown> | null;
    isLoading?: boolean;
    timestamp: number;
};

type Preset = {
    label: string;
    phone: string;
    ownerName?: string;
    businessName?: string;
    description?: string;
};

const HEBREW_REGEX = /[\u0590-\u05FF]/;

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (e.g. mobile testing over local network)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const presets: Preset[] = [
    {
        label: 'Unknown number',
        phone: '+15550123456',
    },
    {
        label: 'Fix Fit (known)',
        phone: '+14085550100',
        ownerName: 'Alex',
        businessName: 'Fix Fit',
        description: 'Hybrid gym + personal training studio.',
    },
];

const systemMessage = (): ChatMessage => ({
    id: 'system-message',
    sender: 'system',
    text: FORLI_SYSTEM_PROMPT,
    timestamp: Date.now(),
});

const jsonPreview = (data?: Record<string, unknown> | null) => {
    if (!data) return null;
    return JSON.stringify(data, null, 2);
};

function App() {
    const [incomingNumber, setIncomingNumber] = useState('+15550123456');
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([systemMessage()]);
    const [conversationState, setConversationState] = useState<ForliState>(createInitialState());
    const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('prospect');
    const [isResponding, setIsResponding] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [activeBusinessName, setActiveBusinessName] = useState<string | undefined>(undefined);
    const [detectedLanguage, setDetectedLanguage] = useState<ForliState['lang'] | null>(null);
    const [humanHandoff, setHumanHandoff] = useState(false);
    const [numberSwitch, setNumberSwitch] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('forli:lastLanguage');
            if (stored === 'he' || stored === 'en') {
                setDetectedLanguage(stored);
            }
        } catch (err) {
            console.warn('Failed to restore language', err);
        }
    }, []);

    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [messages, isResponding]);

    useEffect(() => {
        if (!conversationState.lang) return;
        setDetectedLanguage(conversationState.lang);
        try {
            localStorage.setItem('forli:lastLanguage', conversationState.lang);
        } catch (err) {
            console.warn('Failed to persist language', err);
        }
    }, [conversationState.lang]);

    useEffect(() => {
        const resetConversation = () => {
            setMessages([systemMessage()]);
            setConversationState(createInitialState());
            setBusinessId(null);
            setShowActions(false);
            setHumanHandoff(false);
            setNumberSwitch(false);
            setActiveBusinessName(undefined);
        };

        resetConversation();

        const controller = new AbortController();

        (async () => {
            try {
                const presetMatch = presets.find((p) => p.phone === incomingNumber && p.businessName);
                if (presetMatch) {
                    setConversationStatus('active');
                    setActiveBusinessName(presetMatch.businessName);
                    return;
                }

                const match = await findBusinessByPhone(incomingNumber);
                if (!controller.signal.aborted && match) {
                    setConversationStatus('active');
                    setActiveBusinessName((match as { businessName?: string }).businessName);
                } else if (!controller.signal.aborted) {
                    setConversationStatus('prospect');
                }
            } catch (err) {
                console.error('Lookup failed', err);
                if (!controller.signal.aborted) {
                    setConversationStatus('prospect');
                }
            }
        })();

        return () => controller.abort();
    }, [incomingNumber]);

    const addMessage = (message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
    };

    const persistMessage = async (message: ChatMessage) => {
        try {
            await ensureConversation(incomingNumber, conversationStatus);
            await logConversationMessage(incomingNumber, {
                sender: message.sender,
                text: message.text,
                json: message.json ?? null,
            });
        } catch (err) {
            console.error('Failed to log message', err);
        }
    };

    const handleBotReplies = async (replies: ForliReply[]) => {
        setIsResponding(true);

        const placeholder: ChatMessage = {
            id: generateUUID(),
            sender: 'forli',
            text: 'Forli is thinking…',
            isLoading: true,
            timestamp: Date.now(),
        };

        addMessage(placeholder);

        setTimeout(async () => {
            setMessages((prev) => prev.filter((m) => m.id !== placeholder.id));

            const mapped = replies.map<ChatMessage>((reply) => ({
                id: generateUUID(),
                sender: 'forli',
                text: reply.text,
                json: reply.json ?? undefined,
                timestamp: Date.now(),
            }));

            mapped.forEach((m) => addMessage(m));
            setIsResponding(false);
            setShowActions(replies.some((r) => r.showActions));

            await Promise.all(mapped.map((m) => persistMessage(m)));
        }, 450);
    };

    const handleSend = async (text: string) => {
        if (!text.trim()) return;
        const trimmed = text.trim();

        const userMessage: ChatMessage = {
            id: generateUUID(),
            sender: 'user',
            text: trimmed,
            timestamp: Date.now(),
        };

        addMessage(userMessage);
        setMessageInput('');
        await persistMessage(userMessage);

        const result = runForliTurn({
            text: trimmed,
            state: conversationState,
            isExistingBusiness: conversationStatus === 'active',
            activeBusinessName,
        });

        setConversationState(result.state);
        setHumanHandoff(!!result.humanHandoff);
        setNumberSwitch(!!result.numberSwitch);

        await handleBotReplies(result.replies);

        if (result.state.lang) {
            setDetectedLanguage(result.state.lang);
            try {
                localStorage.setItem('forli:lastLanguage', result.state.lang);
            } catch (err) {
                console.warn('Failed to persist language', err);
            }
        }

        if (result.businessPayload && !businessId) {
            try {
                const newId = await createBusinessCard(incomingNumber, result.businessPayload);
                setBusinessId(newId);
                setConversationStatus('active');
                await updateConversationStatus(incomingNumber, 'active');
            } catch (err) {
                console.error('Failed to create business card', err);
            }
        }
    };

    const handleAction = async (action: 'add_hours' | 'add_faqs' | 'done') => {
        const actionCopy = { add_hours: 'Add Hours', add_faqs: 'Add FAQs', done: "I'm Done" } as const;

        const userAction: ChatMessage = {
            id: generateUUID(),
            sender: 'user',
            text: actionCopy[action],
            timestamp: Date.now(),
        };

        addMessage(userAction);
        await persistMessage(userAction);
        setShowActions(false);

        const result = runForliTurn({
            text: actionCopy[action],
            state: conversationState,
            isExistingBusiness: conversationStatus === 'active',
            activeBusinessName,
            action,
        });

        setConversationState(result.state);
        setHumanHandoff(!!result.humanHandoff);
        setNumberSwitch(!!result.numberSwitch);
        await handleBotReplies(result.replies);
    };

    const activeBadge = useMemo(() => (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${conversationStatus === 'active'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-100 border border-amber-500/30'
                }`}
        >
            <span className="h-2 w-2 rounded-full bg-current" />
            {conversationStatus === 'active' ? 'Active business' : 'Prospect onboarding'}
        </span>
    ), [conversationStatus]);

    const languageBadge = useMemo(() => {
        const label = detectedLanguage === 'he' ? 'Hebrew' : detectedLanguage === 'en' ? 'English' : 'Detecting language';
        const code = detectedLanguage ?? '—';
        return (
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-white/5 text-slate-100 border border-white/10">
                <Languages className="h-4 w-4 text-indigo-200" />
                <span>
                    {label}
                    {detectedLanguage ? ` (${code})` : ''}
                </span>
            </span>
        );
    }, [detectedLanguage]);

    const handoffBadge = useMemo(() => {
        if (!humanHandoff) return null;
        return (
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-rose-500/15 text-rose-100 border border-rose-500/30 animate-pulse">
                <UserRound className="h-4 w-4" />
                Handoff Requested
            </span>
        );
    }, [humanHandoff]);

    const numberSwitchBadge = useMemo(() => {
        if (!numberSwitch) return null;
        return (
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-cyan-500/15 text-cyan-100 border border-cyan-500/30">
                <Phone className="h-4 w-4" />
                Number Switch detected
            </span>
        );
    }, [numberSwitch]);

    const handlePreset = (preset: Preset) => {
        setIncomingNumber(preset.phone);
        if (preset.businessName) {
            setConversationStatus('active');
            setActiveBusinessName(preset.businessName);
        } else {
            setConversationStatus('prospect');
            setActiveBusinessName(undefined);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-50 text-right" dir="rtl">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 -left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-[120px]" />
                <div className="absolute bottom-10 right-4 h-80 w-80 rounded-full bg-blue-500/15 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 lg:py-12" dir="ltr">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Forli Sandbox</h1>
                            <p className="text-slate-400 text-sm">Test Gemini onboarding without WhatsApp costs.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {handoffBadge}
                        {numberSwitchBadge}
                        {languageBadge}
                        {activeBadge}
                        {businessId && (
                            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-blue-500/15 text-blue-100 border border-blue-500/30">
                                <Database className="h-4 w-4" />
                                Created {businessId}
                            </span>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                    <section className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-xl shadow-black/30 overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-indigo-300" />
                                <div>
                                    <p className="text-sm text-slate-400">Incoming number</p>
                                    <p className="font-semibold tracking-wide">{incomingNumber}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <MessageSquare className="h-4 w-4" />
                                <span>{messages.length} messages</span>
                            </div>
                        </div>

                        <div ref={feedRef} className="h-[60vh] overflow-y-auto px-4 sm:px-6 py-6 space-y-3">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[90%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-lg border border-white/5 ${message.sender === 'user'
                                            ? 'bg-indigo-500/90 text-white rounded-br-sm'
                                            : message.sender === 'forli'
                                                ? 'bg-slate-800/80 text-slate-50 rounded-bl-sm'
                                                : 'bg-slate-800/40 text-slate-300 italic'
                                            } ${message.isLoading ? 'animate-pulse' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wide text-slate-300/70">
                                            {message.sender === 'user' && <UserRound className="h-3 w-3" />}
                                            {message.sender === 'forli' && <Bot className="h-3 w-3" />}
                                            {message.sender === 'system' && <Settings className="h-3 w-3" />}
                                            <span>
                                                {message.sender === 'user'
                                                    ? 'You'
                                                    : message.sender === 'forli'
                                                        ? 'Forli'
                                                        : 'System'}
                                            </span>
                                        </div>
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed" dir={HEBREW_REGEX.test(message.text) ? 'rtl' : 'ltr'}>
                                            {message.text}
                                        </p>
                                        {jsonPreview(message.json) && (
                                            <pre className="mt-3 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-emerald-200 overflow-x-auto p-3" dir="ltr">
                                                {jsonPreview(message.json)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isResponding && (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Forli is thinking…</span>
                                </div>
                            )}
                        </div>

                        {(showActions || humanHandoff) && (
                            <div className="px-6 pb-4">
                                <div className="bg-slate-800/60 border border-indigo-500/20 rounded-2xl p-3 flex flex-wrap gap-3">
                                    {humanHandoff && (
                                        <button
                                            onClick={() => window.open(`https://wa.me/something`, '_blank')}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition animate-bounce"
                                        >
                                            <MessageSquare className="h-4 w-4" /> שיחה עם נציג
                                        </button>
                                    )}
                                    {showActions && (
                                        <>
                                            <button
                                                onClick={() => handleAction('add_hours')}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
                                            >
                                                <Clock3 className="h-4 w-4" /> שעות פתיחה
                                            </button>
                                            <button
                                                onClick={() => handleAction('add_faqs')}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
                                            >
                                                <HelpCircle className="h-4 w-4" /> שאלות ותשובות
                                            </button>
                                            <button
                                                onClick={() => handleAction('done')}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition"
                                            >
                                                <CheckCircle2 className="h-4 w-4" /> סיום
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!messageInput.trim() || isResponding) return;
                                handleSend(messageInput);
                            }}
                            className="border-t border-white/5 bg-slate-900/60 px-4 sm:px-6 py-4 flex items-end gap-3"
                        >
                            <div className="flex-1">
                                <label className="sr-only" htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    ref={textareaRef}
                                    rows={1}
                                    value={messageInput}
                                    onChange={(e) => {
                                        setMessageInput(e.target.value);
                                        // Auto-expand
                                        if (textareaRef.current) {
                                            textareaRef.current.style.height = 'auto';
                                            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (messageInput.trim() && !isResponding) {
                                                handleSend(messageInput);
                                                if (textareaRef.current) {
                                                    textareaRef.current.style.height = 'auto';
                                                }
                                            }
                                        }
                                    }}
                                    placeholder="Type to test Forli’s onboarding…"
                                    className="w-full rounded-2xl bg-slate-800/70 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none overflow-y-auto"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!messageInput.trim() || isResponding}
                                className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-semibold shadow-lg shadow-indigo-500/30 disabled:opacity-50 flex-shrink-0 mb-[2px]"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </form>
                    </section>

                    <aside className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-lg shadow-black/30 p-5 space-y-5 backdrop-blur">
                        <div className="flex items-center gap-3">
                            <Settings className="h-5 w-5 text-indigo-300" />
                            <div>
                                <p className="text-sm text-slate-400">Sandbox Controls</p>
                                <p className="font-semibold">Simulate inbound WhatsApp</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs uppercase tracking-wide text-slate-400">Incoming Number</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/70 border border-white/10 flex-1">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <input
                                        value={incomingNumber}
                                        onChange={(e) => setIncomingNumber(e.target.value)}
                                        className="bg-transparent focus:outline-none text-sm flex-1"
                                    />
                                </div>
                                <button
                                    onClick={() => setIncomingNumber(`+1555${Math.floor(Math.random() * 9000000 + 1000000)}`)}
                                    className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-300 hover:border-indigo-400/50"
                                >
                                    Randomize
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Quick Personas</p>
                            <div className="grid grid-cols-2 gap-2">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => handlePreset(preset)}
                                        className={`text-left px-3 py-3 rounded-2xl border text-sm transition ${incomingNumber === preset.phone
                                            ? 'bg-indigo-600 text-white border-indigo-400'
                                            : 'bg-slate-800/70 border-white/10 hover:border-indigo-400/40'
                                            }`}
                                    >
                                        <div className="font-semibold flex items-center gap-2">
                                            {preset.businessName ? <Building2 className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                                            {preset.label}
                                        </div>
                                        <div className="text-xs text-slate-300 mt-1">{preset.phone}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 p-4 rounded-2xl bg-slate-800/60 border border-white/10">
                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                <Sparkles className="h-4 w-4" />
                                <span>Identity Prompt</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {FORLI_SYSTEM_PROMPT}
                            </p>
                        </div>

                        <div className="space-y-4 p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                <Building2 className="h-4 w-4" />
                                <span>Phase Tracker</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.ownerName ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Name
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.businessName ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Business
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.description ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Description
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.cardReady ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Ready
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.hours ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Hours
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${conversationState.catalog ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    Catalog
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border ${(conversationState.collectedFaqs?.length ?? 0) > 0 ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-white/10'}`}>
                                    FAQs
                                </span>
                            </div>

                            <div className="text-xs text-slate-400 space-y-2 border-t border-white/5 pt-3">
                                <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
                                    <span className="text-slate-500">Owner:</span>
                                    <span className="text-slate-200">{conversationState.ownerName || '—'}</span>

                                    <span className="text-slate-500">Business:</span>
                                    <span className="text-slate-200">{conversationState.businessName || '—'}</span>

                                    <span className="text-slate-500">Description:</span>
                                    <span className="text-slate-200 line-clamp-2">{conversationState.description || '—'}</span>

                                    <span className="text-slate-500">Gender:</span>
                                    <span className="text-slate-200 flex items-center gap-1">
                                        {conversationState.userGender === 'female' ? <UserRound className="h-3 w-3 text-pink-400" /> : <UserRound className="h-3 w-3 text-blue-400" />}
                                        {conversationState.userGender || 'unknown'}
                                    </span>

                                    <span className="text-slate-500">Language:</span>
                                    <span className="text-slate-200 uppercase">{conversationState.lang || '—'}</span>

                                    <span className="text-slate-500">Hours:</span>
                                    <span className="text-slate-200">{conversationState.hours || '—'}</span>

                                    <span className="text-slate-500">Catalog:</span>
                                    <span className="text-slate-200 line-clamp-2">{conversationState.catalog || '—'}</span>
                                </div>

                                {(conversationState.collectedFaqs?.length ?? 0) > 0 && (
                                    <div className="space-y-1 mt-3">
                                        <p className="text-slate-500 uppercase tracking-tighter font-bold text-[10px]">Collected FAQs ({conversationState.collectedFaqs?.length})</p>
                                        <div className="max-h-32 overflow-y-auto pr-1 space-y-2 thin-scrollbar">
                                            {conversationState.collectedFaqs?.map((faq, idx) => (
                                                <div key={idx} className="p-2 rounded bg-white/5 border border-white/5">
                                                    <p className="text-indigo-300 font-medium">Q: {faq.q}</p>
                                                    <p className="text-slate-400 italic">A: {faq.a}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default App;
