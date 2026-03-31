import '@testing-library/jest-dom'

// JSDOM does not implement ResizeObserver — provide a no-op stub so components
// that use it (e.g. EditorCanvas) don't throw in tests.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
