/**
 * High-volume integrity violation alarm synthesizer using Web Audio API
 * Plus Haptic Vibration pattern for mobile & tablet
 */
let audioCtx: AudioContext | null = null;

export function playViolationAlarm() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    // Sirene pitch modulation: 880Hz to 440Hz oscillating
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.75);
    osc.frequency.exponentialRampToValueAtTime(880, now + 1.0);

    // High volume envelope
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 1.2);

    // Haptic vibration feedback for mobile/tablet
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch (err) {
    console.warn('Alarm audio error:', err);
  }
}
