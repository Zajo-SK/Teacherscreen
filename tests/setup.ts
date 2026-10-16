import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// React Testing Library rozpoznáva falošné časovače podľa globálu `jest`; vitest ho nemá, tak ho doplníme.
(globalThis as unknown as { jest: unknown }).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };

// jsdom neimplementuje niektoré API, ktoré aplikácia používa.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// Predvolená veľkosť okna v testoch (nová obrazovka dostane pomer strán podľa okna).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true, writable: true });
}
