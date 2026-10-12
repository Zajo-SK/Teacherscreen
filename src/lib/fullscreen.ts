import { useEffect, useState } from 'react';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    } else {
      const el = document.documentElement as FsEl;
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }
  } catch {
    /* prehliadač režim neumožnil (napr. bez gesta používateľa) */
  }
}

export function useFullscreen(): boolean {
  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => {
    const on = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  return fs;
}
