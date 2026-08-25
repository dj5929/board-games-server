import React, { useState } from 'react';
import { SoundEngine } from '../utils/SoundEngine';

export function AudioToggle() {
  const [isMuted, setIsMuted] = useState(false);

  const handleToggle = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    SoundEngine.setEnabled(!nextState);
  };

  return (
    <button
      data-testid="audio-toggle"
      onClick={handleToggle}
      className="fixed top-4 right-4 z-[100] p-3 rounded-full bg-gray-800 border border-gray-600 shadow-lg text-white hover:bg-gray-700 transition-colors"
      aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
    >
      {isMuted ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.898a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
}
