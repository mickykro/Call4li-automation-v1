import React, { useState, useOptimistic } from 'react';
import { useConversations, Message } from '../hooks/useConversations';
import { MessageCircle, Clock, AlertCircle, Loader } from 'lucide-react';

interface ConversationsViewProps {
  businessId: string | null;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({ businessId }) => {
  const { conversations, loading, error } = useConversations(businessId);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<Message[], Message>(
    [],
    (state, newMessage) => [...state, newMessage]
  );

  const currentConversation = conversations.find((c) => c.id === selectedConversation);
  const allMessages = currentConversation
    ? [...(currentConversation.messages || []), ...optimisticMessages]
    : [];

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation || !businessId) return;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: businessId,
      senderName: 'You',
      content,
      timestamp: new Date() as any,
      type: 'text',
      status: 'sent',
    };

    addOptimisticMessage(tempMessage);

    try {
      // Send message to backend
      // This would be implemented with actual API call
      console.log('Message sent:', content);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
          <p className="text-red-800 font-semibold">Error loading conversations</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <MessageCircle className="w-6 h-6 mr-2 text-green-600" />
            Conversations
          </h2>
          <p className="text-sm text-gray-600 mt-1">{conversations.length} active chats</p>
        </div>

        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No conversations yet</p>
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation.id)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                  selectedConversation === conversation.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {conversation.customerName}
                    </h3>
                    <p className="text-sm text-gray-600 truncate">{conversation.customerPhone}</p>
                    <p className="text-sm text-gray-700 truncate mt-1">{conversation.lastMessage}</p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="ml-2 bg-green-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-2">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(conversation.lastMessageTime.toDate())}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Detail */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && currentConversation ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {currentConversation.customerName}
                  </h2>
                  <p className="text-sm text-gray-600">{currentConversation.customerPhone}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {currentConversation.status}
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              {currentConversation.aiSummary && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">AI Summary</p>
                  <p className="text-sm text-blue-800">{currentConversation.aiSummary}</p>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {allMessages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No messages yet</p>
                </div>
              ) : (
                allMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.senderId === businessId ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.senderId === businessId
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.senderId === businessId
                            ? 'text-green-100'
                            : 'text-gray-600'
                        }`}
                      >
                        {formatTime(message.timestamp.toDate())}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <MessageInput onSend={handleSendMessage} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MessageInputProps {
  onSend: (message: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
      />
      <button
        type="submit"
        disabled={!message.trim()}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        Send
      </button>
    </form>
  );
};

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
