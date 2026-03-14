import { useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserRound, Send, Clock, Inbox, Search, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

type Conversation = {
    id: string;
    phone: string;
    status: string;
    updatedAt?: Timestamp;
    createdAt?: Timestamp;
};

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'forli' | 'system';
    createdAt?: Timestamp;
};

export const Conversations = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch conversations list
    useEffect(() => {
        const q = query(collection(db, 'conversations'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const convs: Conversation[] = [];
            snapshot.forEach((doc) => {
                convs.push({ id: doc.id, ...doc.data() } as Conversation);
            });
            // Sort in memory to avoid needing a composite index for now
            convs.sort((a, b) => {
                const timeA = a.updatedAt?.toMillis() || 0;
                const timeB = b.updatedAt?.toMillis() || 0;
                return timeB - timeA;
            });
            setConversations(convs);
            setLoadingConvs(false);
        });

        return () => unsubscribe();
    }, []);

    // Auto-select first conversation if none selected
    useEffect(() => {
        if (conversations.length > 0 && !selectedConvId) {
            setSelectedConvId(conversations[0].id);
        }
    }, [conversations, selectedConvId]);

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedConvId) {
            setMessages([]);
            return;
        }

        setLoadingMsgs(true);
        const msgsRef = collection(db, 'conversations', selectedConvId, 'messages');
        const q = query(msgsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() } as Message);
            });
            setMessages(msgs);
            setLoadingMsgs(false);
        });

        return () => unsubscribe();
    }, [selectedConvId]);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const activeConversation = conversations.find(c => c.id === selectedConvId);

    return (
        <div className="flex h-full bg-white dark:bg-zinc-950 animate-in fade-in duration-500">
            {/* Left Pane - Conversation List */}
            <div className="w-80 border-r dark:border-zinc-800 flex flex-col bg-gray-50/50 dark:bg-zinc-900/50 flex-shrink-0">
                <div className="p-4 border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Inbox className="w-5 h-5 text-primary" />
                        Inbox
                    </h2>
                    <div className="mt-3 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            className="w-full bg-gray-100 dark:bg-zinc-800 border-none rounded-md pl-9 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-primary dark:text-gray-200"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loadingConvs ? (
                        <div className="p-4 text-center text-sm text-gray-500">Loading chats...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">No conversations yet.</div>
                    ) : (
                        <div className="divide-y dark:divide-zinc-800">
                            {conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConvId(conv.id)}
                                    className={`w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-3 ${selectedConvId === conv.id ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-primary' : ''
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                                        <UserRound className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                                                {conv.phone}
                                            </span>
                                            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                                {conv.updatedAt ? format(conv.updatedAt.toDate(), 'HH:mm') : ''}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            Status: <span className="capitalize">{conv.status || 'Active'}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Central Pane - Chat Window */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a]">
                {activeConversation ? (
                    <>
                        <div className="h-16 border-b dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6 flex-shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <UserRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{activeConversation.phone}</h3>
                                    <p className="text-xs text-green-600 dark:text-green-500">Active</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {loadingMsgs ? (
                                <div className="text-center text-sm text-gray-500 py-4">Loading messages...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-sm bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-600 p-3 rounded-lg w-fit mx-auto">
                                    This conversation has no messages yet.
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isForli = msg.sender === 'forli';
                                    const isSystem = msg.sender === 'system';

                                    if (isSystem) {
                                        return (
                                            <div key={msg.id} className="flex justify-center my-4">
                                                <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm text-xs text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full border border-gray-200 dark:border-zinc-700 shadow-sm">
                                                    {msg.text}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id} className={`flex ${isForli ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-3 shadow-sm ${isForli
                                                ? 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-tr-none border border-green-200 dark:border-green-800'
                                                : 'bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] rounded-tl-none border border-gray-200 dark:border-zinc-800'
                                                }`}>
                                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                <div className={`text-[11px] mt-1 text-right ${isForli ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 p-3 lg:p-4 flex gap-2">
                            <input
                                type="text"
                                placeholder="Type a message to take over..."
                                className="flex-1 rounded-full border border-gray-300 dark:border-zinc-700 px-4 py-2 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                disabled // Just UI shell for now
                            />
                            <button className="bg-primary text-white p-2 w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50" disabled>
                                <Send className="w-5 h-5 ml-1" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-col gap-4">
                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center">
                            <MessageSquare className="w-10 h-10" />
                        </div>
                        <p>Select a conversation to view</p>
                    </div>
                )}
            </div>

            {/* Right Pane - Context Sidebar */}
            {activeConversation && (
                <div className="w-80 border-l dark:border-zinc-800 bg-white dark:bg-zinc-950 hidden xl:flex flex-col flex-shrink-0">
                    <div className="h-16 border-b dark:border-zinc-800 flex items-center px-6 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Contact Info
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex flex-col items-center text-center pb-6 border-b dark:border-zinc-800">
                            <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                                <UserRound className="w-12 h-12" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{activeConversation.phone}</h2>
                            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Customer</p>
                        </div>

                        <div className="py-6 space-y-6 border-b dark:border-zinc-800">
                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">About</h4>
                                <p className="text-sm text-gray-800 dark:text-gray-200 flex flex-col gap-2">
                                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Interaction started today</span>
                                </p>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">AI Summary</h4>
                                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-3 rounded-lg text-sm text-primary dark:text-primary-foreground leading-relaxed">
                                    User is inquiring about business hours and services. Forli is handling the flow.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

};
