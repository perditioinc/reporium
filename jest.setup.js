/**
 * Jest setup file for jsdom gaps.
 *
 * Mocks window APIs that jsdom doesn't implement:
 * - window.matchMedia (used by JellyfishLayer, visibility detection, etc.)
 * - IntersectionObserver (common in React components)
 * - ResizeObserver (common for responsive layouts)
 */

if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver (jsdom doesn't implement this)
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = class IntersectionObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Mock ResizeObserver (jsdom doesn't implement this)
  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
