import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface ChatPanelProps {
  socket: Socket;
  campaignId: string;
}

export default function ChatPanel({ socket, campaignId }: ChatPanelProps) {
  const { chatMessages } = useGameStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!message.trim()) return;
    socket.emit('chat:message', { campaignId, content: message.trim() });
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
            <div key={msg.id || i} className="bg-dnd-bg rounded px-3 py-2">
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
              </div>
              <p className="text-sm">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dnd-accent p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-sm text-dnd-text focus:outline-none focus:border-dnd-primary"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="bg-dnd-primary text-white px-4 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
