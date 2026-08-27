import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioToggle } from '../AudioToggle';
import { SoundEngine } from '../../utils/SoundEngine';

// Mock the SoundEngine
vi.mock('../../utils/SoundEngine', () => ({
  SoundEngine: {
    setEnabled: vi.fn(),
  }
}));

describe('AudioToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default state (unmuted)', () => {
    render(<AudioToggle />);
    const button = screen.getByTestId('audio-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Mute Audio');
    // SoundEngine.setEnabled shouldn't be called on initial render
    expect(SoundEngine.setEnabled).not.toHaveBeenCalled();
  });

  it('toggles audio state and calls SoundEngine on click', () => {
    render(<AudioToggle />);
    const button = screen.getByTestId('audio-toggle');
    
    // Initial state: Unmuted (green icon)
    expect(button).toHaveAttribute('aria-label', 'Mute Audio');
    
    // First click: Mute
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-label', 'Unmute Audio');
    expect(SoundEngine.setEnabled).toHaveBeenCalledWith(false);
    expect(SoundEngine.setEnabled).toHaveBeenCalledTimes(1);
    
    // Second click: Unmute
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-label', 'Mute Audio');
    expect(SoundEngine.setEnabled).toHaveBeenCalledWith(true);
    expect(SoundEngine.setEnabled).toHaveBeenCalledTimes(2);
  });
});
