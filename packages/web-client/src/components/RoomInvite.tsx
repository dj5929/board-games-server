import { useState } from 'react';

export const inviteLink = (code: string) => {
  const url = new URL(window.location.href);
  url.search = `?join=${code}`;
  return url.toString();
};

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy', err);
  }
};

export function RoomInvite({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(inviteLink(roomCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy room invite link for code ${roomCode}`}
      className="text-xs px-3 py-1.5 rounded-lg bg-cyan-900/50 text-cyan-300 border border-cyan-800 hover:bg-cyan-800/60 transition-colors font-semibold"
    >
      {copied ? 'Copied!' : `Code: ${roomCode}`}
    </button>
  );
}
