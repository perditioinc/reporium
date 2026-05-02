/** @jest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/lib/useIsMobile';

type Listener = (e: MediaQueryListEvent) => void;

interface MockMql {
  matches: boolean;
  media: string;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

interface Harness {
  mql: MockMql;
  fire(matches: boolean): void;
}

function installMatchMedia(initialMatches: boolean): Harness {
  const listeners: Listener[] = [];
  const mql: MockMql = {
    matches: initialMatches,
    media: '(max-width: 767px)',
    addEventListener: jest.fn((_: string, cb: Listener) => {
      listeners.push(cb);
    }),
    removeEventListener: jest.fn((_: string, cb: Listener) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
  };
  // jest.setup.js installs matchMedia as a writable property; reassign rather
  // than defineProperty (which fails on the second test because the property
  // is not configurable).
  (window as unknown as { matchMedia: (q: string) => MockMql }).matchMedia = jest
    .fn()
    .mockReturnValue(mql);
  return {
    mql,
    fire(matches: boolean) {
      mql.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      listeners.slice().forEach((cb) => cb(event));
    },
  };
}

describe('useIsMobile', () => {
  test('returns false when matchMedia.matches is false (desktop viewport)', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  test('corrects to true after hydration when matchMedia.matches is true', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  test('updates when the media query change event fires', () => {
    const harness = installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      harness.fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      harness.fire(false);
    });
    expect(result.current).toBe(false);
  });

  test('cleans up the change listener on unmount', () => {
    const harness = installMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    expect(harness.mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(harness.mql.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
