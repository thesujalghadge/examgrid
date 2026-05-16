export function isFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  return !!(
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element })
      .webkitFullscreenElement
  );
}

export async function requestExamFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    const webkit = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (webkit.webkitRequestFullscreen) {
      await webkit.webkitRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function exitExamFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
      };
      await doc.webkitExitFullscreen?.();
    }
  } catch {
    /* user gesture may be required */
  }
}
