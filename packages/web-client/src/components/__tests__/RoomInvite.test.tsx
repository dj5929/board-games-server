import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoomInvite, inviteLink } from '../RoomInvite';

describe('RoomInvite', () => {
  it('renders the room code and handles copy (Phase 40)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    render(<RoomInvite roomCode="ABCDEF" />);
    const button = screen.getByRole('button', { name: 'Copy room invite link for code ABCDEF' });
    expect(button).toHaveTextContent('Code: ABCDEF');

    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(inviteLink('ABCDEF')));
    expect(button).toHaveTextContent('Copied!');
  });
});
