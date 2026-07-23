type BrowserIdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type BrowserWindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: BrowserIdleDeadline) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Defers non-critical browser work until the document has loaded and the main
 * thread becomes idle. The returned cleanup prevents scheduled work.
 */
export const runAfterLoadAndIdle = (
  callback: () => void,
  timeout = 5_000,
) => {
  const browserWindow = window as BrowserWindowWithIdleCallback;
  let cancelled = false;
  let idleHandle: number | null = null;
  let fallbackHandle: number | null = null;

  const run = () => {
    if (!cancelled) callback();
  };

  const scheduleWhenIdle = () => {
    if (browserWindow.requestIdleCallback) {
      idleHandle = browserWindow.requestIdleCallback(run, { timeout });
      return;
    }

    fallbackHandle = window.setTimeout(run, 1);
  };

  if (document.readyState === "complete") {
    scheduleWhenIdle();
  } else {
    window.addEventListener("load", scheduleWhenIdle, { once: true });
  }

  return () => {
    cancelled = true;
    window.removeEventListener("load", scheduleWhenIdle);
    if (idleHandle !== null) {
      browserWindow.cancelIdleCallback?.(idleHandle);
    }
    if (fallbackHandle !== null) {
      window.clearTimeout(fallbackHandle);
    }
  };
};
