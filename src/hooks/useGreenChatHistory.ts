import { useEffect, useState } from 'react';

export type GreenChatMessage = {
  id: string;
  type: string;
  chatId: string;
  timestamp: Date;
  direction: 'incoming' | 'outgoing';
  text?: string;
  caption?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phoneNumber?: string }>;
};

interface State {
  messages: GreenChatMessage[];
  loading: boolean;
  error: string | null;
}

export const useGreenChatHistory = (chatId: string | null) => {
  const [state, setState] = useState<State>({ messages: [], loading: !!chatId, error: null });

  useEffect(() => {
    if (!chatId) {
      setState({ messages: [], loading: false, error: null });
      return;
    }

    const base = import.meta.env.VITE_GREEN_API_BASE;
    const instanceId = import.meta.env.VITE_GREEN_API_INSTANCE_ID;
    const token = import.meta.env.VITE_GREEN_API_TOKEN;

    if (!base || !instanceId || !token) {
      setState({ messages: [], loading: false, error: 'Green API is not configured' });
      return;
    }

    const controller = new AbortController();

    const fetchHistory = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const url = `${base}/waInstance${instanceId}/getChatHistory/${token}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, count: 10 }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load chat: ${res.status}`);
        }

        const data: any[] = await res.json();
        const mapped: GreenChatMessage[] = (data || []).map((item) => ({
          id: item.idMessage ?? crypto.randomUUID(),
          type: item.typeMessage || item.type,
          chatId: item.chatId,
          timestamp: new Date((item.timestamp || 0) * 1000),
          direction: item.type === 'incoming' ? 'incoming' : 'outgoing',
          text: item.textMessage || item.caption || item.extendedTextMessage?.text,
          caption: item.caption,
          buttons: item.interactiveButtons?.buttons?.map((b: any) => ({
            type: b.type,
            text: b.buttonText,
            url: b.url,
            phoneNumber: b.phoneNumber,
          })),
        }));

        mapped.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setState({ messages: mapped, loading: false, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ messages: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load chat' });
      }
    };

    fetchHistory();

    return () => controller.abort();
  }, [chatId]);

  return state;
};
