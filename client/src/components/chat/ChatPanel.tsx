import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface ChatPanelProps {
  socket: Socket;
  campaignId: string;
  isDM: boolean;
}

const QUICK_REPLIES = [
  'Yes', 'No', 'Roll for initiative!', 'I check for traps',
  'I attack!', 'I cast a spell', 'I search the area', 'I sneak ahead',
  'Let\'s rest here', 'We need to run!',
];

export default function ChatPanel({ socket, campaignId, isDM }: ChatPanelProps) {
  const { chatMessages, addChatMessage } = useGameStore();
  const [message, setMessage] = useState('');
  const [isWhisper, setIsWhisper] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Listen for incoming whispers
  useEffect(() => {
    const handler = (msg: { id: string; userId: string; username: string; content: string; type: string; createdAt: string }) => {
      addChatMessage({ ...msg, type: 'whisper' as const });
    };
    socket.on('chat:whisper', handler);
    return () => { socket.off('chat:whisper', handler); };
  }, [socket, addChatMessage]);

  const sendMessage = (content: string, whisper: boolean) => {
    if (!content.trim()) return;
    if (whisper) {
      socket.emit('chat:whisper', { campaignId, content: content.trim() });
    } else {
      socket.emit('chat:message', { campaignId, content: content.trim() });
    }
    setMessage('');
    setIsWhisper(false);
  };

  const handleSend = () => sendMessage(message, isWhisper);

  const handleQuickReply = (text: string) => {
    sendMessage(text, isWhisper);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageStyle = (msg: { type: string; isPrivate?: boolean }) => {
    if (msg.type === 'system') return 'border-l-2 border-yellow-500/60 bg-yellow-500/5 italic text-center';
    if (msg.type === 'dice') return 'border-l-2 border-blue-500/60 bg-blue-500/5';
    if (msg.isPrivate || msg.type === 'whisper') return 'border-l-2 border-purple-500/60 bg-purple-500/5';
    return 'bg-dnd-bg';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-dnd-muted text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={msg.id || i} className={`rounded-lg px-3 py-2 text-sm ${getMessageStyle(msg)}`}>
              {msg.type === 'system' ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">⚙</span>
                  <p className="text-dnd-muted text-xs">{msg.content}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-dnd-accent">{msg.username}</span>
                    <span className="text-[10px] text-dnd-muted/70">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.type === 'dice' && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">🎲 Dice</span>
                    )}
                    {(msg.isPrivate || msg.type === 'whisper') && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                        🔒 {isDM ? 'Whisper' : 'To DM'}
                      </span>
                    )}
                  </div>
                  <p className={msg.type === 'dice' ? 'font-mono font-semibold' : ''}>{msg.content}</p>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <div className="px-3 pb-1">
        <button
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className="text-[10px] text-dnd-muted hover:text-dnd-text transition-colors"
        >
          {showQuickReplies ? '▾ Quick Replies' : '▸ Quick Replies'}
        </button>
        {showQuickReplies && (
          <div className="flex flex-wrap gap-1 mt-1">
            {QUICK_REPLIES.map((text) => (
              <button
                key={text}
                onClick={() => handleQuickReply(text)}
                className="text-[10px] bg-dnd-bg border border-dnd-accent/30 hover:border-dnd-primary/50 hover:bg-dnd-surface rounded-full px-2 py-0.5 text-dnd-muted hover:text-dnd-text transition-colors"
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-dnd-accent p-3 pt-2">
        {/* Whisper toggle (visible to non-DM players) */}
        {!isDM && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setIsWhisper(!isWhisper)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isWhisper
                  ? 'bg-purple-900/40 text-purple-300 border border-purple-500/50'
                  : 'text-dnd-muted hover:text-dnd-text border border-dnd-accent/30'
              }`}
            >
              {isWhisper ? '🔒 Whispering to DM...' : '🔒 Whisper to DM'}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isWhisper ? 'Type a whisper...' : 'Type a message...'}
            className={`flex-1 rounded-lg px-3 py-2 text-sm text-dnd-text focus:outline-none focus:border-dnd-primary ${
              isWhisper
                ? 'bg-purple-900/10 border border-purple-500/30'
                : 'bg-dnd-bg border border-dnd-accent'
            }`}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
              isWhisper
                ? 'bg-purple-700 text-white hover:bg-purple-600'
                : 'bg-dnd-primary text-white hover:opacity-90'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
