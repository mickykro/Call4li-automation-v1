import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'document';
  status: 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTime: Timestamp;
  unreadCount: number;
  messages: Message[];
  aiSummary?: string;
  status: 'active' | 'closed' | 'pending';
}

export const useConversations = (businessId: string | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, 'conversations'), where('businessId', '==', businessId));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const conversationsList: Conversation[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            conversationsList.push({
              id: doc.id,
              businessId: data.businessId,
              customerId: data.customerId,
              customerName: data.customerName,
              customerPhone: data.customerPhone,
              lastMessage: data.lastMessage,
              lastMessageTime: data.lastMessageTime,
              unreadCount: data.unreadCount || 0,
              messages: data.messages || [],
              aiSummary: data.aiSummary,
              status: data.status || 'active',
            });
          });

          conversationsList.sort(
            (a, b) => b.lastMessageTime.toDate().getTime() - a.lastMessageTime.toDate().getTime()
          );

          setConversations(conversationsList);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error listening to conversations:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
    }
  }, [businessId]);

  const getConversationById = useCallback(
    (conversationId: string): Conversation | undefined => {
      return conversations.find((conv) => conv.id === conversationId);
    },
    [conversations]
  );

  const getUnreadCount = useCallback((): number => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  return {
    conversations,
    loading,
    error,
    getConversationById,
    getUnreadCount,
  };
};
