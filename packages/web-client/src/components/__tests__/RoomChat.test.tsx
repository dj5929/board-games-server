import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomChat } from '../RoomChat';

describe('RoomChat', () => {
  it('renders the empty state and the message list with sender labels', () => {
    render(<RoomChat messages={[]} onSend={vi.fn()} onClose={vi.fn()} localSenderId="p1" localSenderRole="player" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();

    const t0 = Date.now();
    const messages = [
      { id: 'm1', roomId: 'r', senderId: 'p2', senderRole: 'player' as const, text: 'hello p1!', sentAt: t0 },
      { id: 'm2', roomId: 'r', senderId: 'p1', senderRole: 'player' as const, text: 'hello p2!', sentAt: t0 },
      { id: 'm3', roomId: 'r', senderId: 'spectator-abc12345', senderRole: 'spectator' as const, text: 'watching too', sentAt: t0 },
    ];
    render(<RoomChat messages={messages} onSend={vi.fn()} onClose={vi.fn()} localSenderId="p1" localSenderRole="player" />);
    expect(screen.getByText('hello p1!')).toBeInTheDocument();
    expect(screen.getByText('p2:')).toBeInTheDocument();
    expect(screen.getByText('hello p2!')).toBeInTheDocument();
    expect(screen.getByText('You:')).toBeInTheDocument();
    expect(screen.getByText('watching too')).toBeInTheDocument();
    expect(screen.getByText('Spectator abc12345:')).toBeInTheDocument();
  });

  it('sends the typed line and clears the draft', () => {
    const onSend = vi.fn();
    render(<RoomChat messages={[]} onSend={onSend} onClose={vi.fn()} />);
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: '  let us play  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSend).toHaveBeenCalledWith('let us play');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('sends a quick emoji chip through the same CHAT path', () => {
    const onSend = vi.fn();
    render(<RoomChat messages={[]} onSend={onSend} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Send quick emoji 👍'));
    expect(onSend).toHaveBeenCalledWith('👍');
  });

  it('notifies the parent when closed', () => {
    const onClose = vi.fn();
    render(<RoomChat messages={[]} onSend={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close chat'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});