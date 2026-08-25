import { useState, useCallback } from 'react';

export interface EventLogEntry {
  id: number;
  time: string;
  msg: string;
}

export function useEventLog(maxEntries = 50) {
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);

  const addEventLog = useCallback((msg: string) => {
    if (!msg) return;
    setEventLog(prev => [{
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      msg
    }, ...prev].slice(0, maxEntries));
  }, [maxEntries]);

  const addEventLogs = useCallback((messages: string[]) => {
    const validMessages = messages.filter(Boolean);
    if (validMessages.length === 0) return;
    
    setEventLog(prev => {
      const newEntries = validMessages.map((msg, i) => ({
        id: Date.now() + Math.random() + i,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        msg
      }));
      return [...newEntries.reverse(), ...prev].slice(0, maxEntries);
    });
  }, [maxEntries]);

  return { eventLog, showEventLog, setShowEventLog, addEventLog, addEventLogs };
}
