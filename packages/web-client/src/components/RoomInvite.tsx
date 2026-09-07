import { useEffect, useRef, useState } from 'react';

export const inviteLink = (code: string) => {
  const url = new URL(window.location.href);
  url.search = `?join=${code}`;
  return url.toString();
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy', err);
    return false;
  }
};

export function RoomInvite({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyText(inviteLink(roomCode));
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
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
