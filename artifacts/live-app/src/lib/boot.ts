/**
 * Tells public/gahez-toggle.js when the first real screen is up, so the switch
 * becomes the G once and the page takes over. A mounted PageSpinner holds it back:
 * a route still loading its chunk or its data is not ready yet.
 */
declare global {
  interface Window {
    gahezToggle?: { ready: () => void };
  }
}

let holds = 0;
let timer: number | undefined;

export function bootSettled() {
  window.clearTimeout(timer);
  // One screen often hands over to the next (a redirect, a lazy chunk), so let it land.
  timer = window.setTimeout(() => {
    if (holds === 0) window.gahezToggle?.ready();
  }, 60);
}

export function holdBoot() {
  holds += 1;
  window.clearTimeout(timer);
  return () => {
    holds -= 1;
    bootSettled();
  };
}
