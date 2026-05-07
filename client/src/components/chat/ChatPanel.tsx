import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface ChatPanelProps {
  socket: Socket;
  campaignId: string;
  isDM: boolean;
}

export default function ChatPanel({ socket, campaignId, isDM }: ChatPanelProps) {
  const { chatMessages, addChatMessage } = useGameStore();
  const [message, setMessage] = useState('');
  const [isWhisper, setIsWhisper] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Listen for incoming whispers
  useEffect(() => {
    const handler = (msg: any) => {
      addChatMessage({ ...msg, type: 'whisper' as any });
    };
    socket.on('chat:whisper', handler);
    return () => { socket.off('chat:whisper', handler); };
  }, [socket, addChatMessage]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (isWhisper) {
      socket.emit('chat:whisper', { campaignId, content: message.trim() });
    } else {
      socket.emit('chat:message', { campaignId, content: message.trim() });
    }
    setMessage('');
    setIsWhisper(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageStyle = (msg: any) => {
    if (msg.isPrivate || msg.type === 'whisper' || msg.note === 'Sent to DM') {
      return 'border-l-2 border-purple-500/50 bg-purple-900/10';
    }
    if (msg.type === 'system') return 'border-l-2 border-yellow-500/50 bg-yellow-900/10';
    return 'bg-dnd-bg';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-dnd-muted text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={msg.id || i} className={`rounded px-3 py-2 ${getMessageStyle(msg)}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-dnd-accent">{msg.username}</span>
                <span className="text-xs text-dnd-muted">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </span>
                {msg.type === 'system' && (
                  <span className="text-xs bg-yellow-900/30 text-yellow-300 px-1 rounded">System</span>
                )}
                {msg.type === 'dice' && (
                  <span className="text-xs bg-blue-900/30 text-blue-300 px-1 rounded">Dice</span>
                )}
                {(msg.isPrivate || msg.type === 'whisper') && (
                  <span className="text-xs bg-purple-900/30 text-purple-300 px-1 rounded">
                    {isDM ? 'Whisper' : 'To DM'}
                  </span>
                )}
              </div>
              <p className="text-sm">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dnd-accent p-3">
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
              {isWhisper ? 'Whispering to DM...' : 'Whisper to DM'}
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
            className={`flex-1 rounded px-3 py-2 text-sm text-dnd-text focus:outline-none focus:border-dnd-primary ${
              isWhisper
                ? 'bg-purple-900/10 border border-purple-500/30'
                : 'bg-dnd-bg border border-dnd-accent'
            }`}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className={`px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 ${
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
