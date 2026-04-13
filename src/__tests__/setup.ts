import { vi } from 'vitest';
import '@testing-library/jest-dom';

// ─── Mock PixiJS ──────────────────────────────────────────────────────────────
// PixiJS requires WebGL/Canvas which is unavailable in jsdom.
// We mock the rendering layer so Layer 2 and 3 tests stay fast and isolated.

vi.mock('pixi.js', () => {
  const mockContainer = () => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    removeChildren: vi.fn(),
    children: [] as unknown[],
    x: 0,
    y: 0,
    alpha: 1,
    scale: { x: 1, y: 1 },
    tint: 0xffffff,
  });

  const mockGraphics = () => ({
    circle: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    alpha: 1,
    tint: 0xffffff,
    scale: { x: 1, y: 1 },
  });

  return {
    Application: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      canvas: document.createElement('canvas'),
      stage: mockContainer(),
      renderer: { resize: vi.fn() },
      destroy: vi.fn(),
      ticker: { add: vi.fn(), remove: vi.fn() },
    })),
    Graphics: vi.fn().mockImplementation(mockGraphics),
    Container: vi.fn().mockImplementation(mockContainer),
    Text: vi.fn().mockImplementation(() => ({
      anchor: { set: vi.fn() },
      x: 0,
      y: 0,
      alpha: 1,
      text: '',
    })),
    TextStyle: vi.fn(),
  };
});

// ─── Mock GSAP ───────────────────────────────────────────────────────────────
// Prevent GSAP from running real timers in unit tests.

vi.mock('gsap', () => {
  const mockTween = {
    kill: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    then: vi.fn(),
  };

  const mockTimeline = {
    to: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    kill: vi.fn(),
    onComplete: null as null | (() => void),
  };

  return {
    gsap: {
      to: vi.fn().mockReturnValue(mockTween),
      from: vi.fn().mockReturnValue(mockTween),
      fromTo: vi.fn().mockReturnValue(mockTween),
      timeline: vi.fn().mockReturnValue(mockTimeline),
      killTweensOf: vi.fn(),
      killAll: vi.fn(),
      delayedCall: vi.fn((_, fn: () => void) => { fn(); return mockTween; }),
      set: vi.fn(),
    },
  };
});
