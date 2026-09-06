import { useState } from 'react';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderRole: 'player' | 'spectator';
  text: string;
  sentAt: number;
}

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  localSenderId?: string;
  localSenderRole?: 'player' | 'spectator';
}

/** One-tap quick lines: each chip sends its text via the normal CHAT path. */
const QUICK_CHIPS = ['👍', '🎉', '😂', '❤️', '🙌'];

function shortSpectatorId(id: string): string {
  const core = id.includes('-') ? id.slice(id.indexOf('-') + 1) : id;
  return core.slice(0, 8);
}

function senderLabel(m: ChatMessage, localSenderId?: string, localSenderRole?: 'player' | 'spectator'): string {
  if (m.senderId === localSenderId && m.senderRole === localSenderRole) return 'You';
  return m.senderRole === 'spectator' ? `Spectator ${shortSpectatorId(m.senderId)}` : m.senderId;
}

function messageTime(m: ChatMessage): string {
  return new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomChat({ messages, onSend, onClose, localSenderId, localSenderRole }: Props) {
  const [draft, setDraft] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="absolute top-24 right-4 md:right-8 w-72 md:w-96 max-h-96 bg-gray-900/95 backdrop-blur border border-gray-600 rounded-xl shadow-2xl z-40 flex flex-col overflow-hidden animate-fade-in-up">
      <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-bold text-gray-200">Room Chat</h3>
        <button onClick={onClose} aria-label="Close chat" className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-col-reverse">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center my-4">No messages yet.</p>
        ) : (
          [...messages].reverse().map(m => (
            <div key={m.id} className="text-sm border-b border-gray-800 pb-2">
              <div className="text-gray-400 text-xs mb-0.5">
                <span className="text-gray-500">[{messageTime(m)}]</span>{' '}
                <span className={m.senderRole === 'spectator' ? 'text-teal-400' : 'text-blue-400'}>
                  {senderLabel(m, localSenderId, localSenderRole)}:
                </span>
              </div>
              <div className="text-gray-200 break-words">{m.text}</div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="bg-gray-800 p-3 border-t border-gray-700 flex flex-col gap-2">
        <div className="flex gap-1.5">
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => onSend(chip)}
              aria-label={`Send quick emoji ${chip}`}
              className="bg-gray-700 hover:bg-gray-600 text-base px-2 py-1 rounded-md transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Type a message..."
            aria-label="Chat message"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button type="submit" disabled={!draft.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}