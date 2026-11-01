/*
 * The Gahez toggle. The G is a switch that is always on, so a page getting ready
 * shows that switch: it drops in, turns on, and becomes the mark when the page is
 * ready. A plain file, so it runs before the framework and under script-src 'self'.
 *
 *   data-mode="screen"  covers the page until window.gahezToggle.ready() (the app)
 *   data-mode="chip"    a small chip over the prerendered page until load (the site)
 *   data-on="#e11d48"   the product's accent; Gahez blue when left out
 *
 * Pull to refresh uses the same chip, and the reload picks up where it left off.
 * It belongs to Gahez, not to one product, and needs nothing but this file: any
 * Gahez site can load it. Keep the copies in artifacts/live-app/public and
 * artifacts/jahez-live/public identical.
 */
(() => {
  if (window.gahezToggle) return;

  const mode = document.currentScript?.dataset.mode === 'screen' ? 'screen' : 'chip';
  const accent = document.currentScript?.dataset.on || '#2563eb';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ON = 'translate(79.473%, -1.138%)';
  const MID = 'translate(39.74%, -.57%) scale(1.2, .92)';
  const FLAG = 'gahez-toggle-pull';

  // Sizes are the brand mark's own geometry (viewBox 465.46 x 283.62), as percentages.
  const style = document.createElement('style');
  style.textContent = `
.gt,.gt-cover,.gt-chip{--gt-bg:#fff;--gt-on:${accent};--gt-off:#cbd5e1;--gt-line:#0f172a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) :is(.gt,.gt-cover,.gt-chip){--gt-bg:#06070c;--gt-off:#343a4b;--gt-line:#f8f9fd}}
:root[data-theme=dark] :is(.gt,.gt-cover,.gt-chip){--gt-bg:#06070c;--gt-off:#343a4b;--gt-line:#f8f9fd}
.gt{position:relative;display:block;flex:none;width:var(--gt-w,56px);aspect-ratio:465.46/283.62;direction:ltr}
.gt i{position:absolute;display:block}
.gt-track,.gt-fill{left:0;top:0;width:95.6%;height:100%;border-radius:999px}
.gt-track{background:var(--gt-off)}
.gt-fill{background:var(--gt-on);opacity:0}
.gt-knob{left:6.97%;top:11.438%;width:46.995%;aspect-ratio:1;border-radius:50%;background:var(--gt-bg);will-change:transform}
.gt-notch{left:87.01%;top:37.54%;width:9.6%;height:19.354%;background:var(--gt-bg);transform:scaleX(0);transform-origin:0 50%}
.gt-bar{left:76.705%;top:48.833%;width:23.295%;height:9.971%;background:var(--gt-on);transform:scaleX(0);transform-origin:0 50%}
.gt-loop .gt-fill{opacity:1}
.gt-loop .gt-knob{animation:gt-swing 1.3s infinite}
@keyframes gt-swing{
0%,100%{transform:${ON};animation-timing-function:cubic-bezier(.5,0,.9,.6)}
25%,75%{transform:${MID};animation-timing-function:cubic-bezier(.1,.4,.5,1)}
50%{transform:translate(0,0);animation-timing-function:cubic-bezier(.5,0,.9,.6)}
}
@media (prefers-reduced-motion:reduce){.gt-loop .gt-knob{animation:none;transform:${ON}}}
.gt-cover{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:var(--gt-bg)}
.gt-chip{position:fixed;z-index:2147483000;top:calc(env(safe-area-inset-top,0px) + 14px);left:0;right:0;width:max-content;margin-inline:auto;padding:9px 13px;border:2px solid var(--gt-line);border-radius:999px;background:var(--gt-bg);box-shadow:3px 4px 0 var(--gt-line);pointer-events:none;will-change:transform}
html.gt-pull,html.gt-pull body{overscroll-behavior-y:none}`;
  document.head.append(style);

  const toggle = (width) => {
    const el = document.createElement('span');
    el.className = 'gt';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--gt-w', `${width}px`);
    el.innerHTML = '<i class="gt-track"></i><i class="gt-fill"></i><i class="gt-knob"></i><i class="gt-notch"></i><i class="gt-bar"></i>';
    const part = (name) => el.querySelector(`.gt-${name}`);
    return { el, fill: part('fill'), knob: part('knob'), notch: part('notch'), bar: part('bar') };
  };

  const chipOf = (t) => {
    const chip = document.createElement('div');
    chip.className = 'gt-chip';
    chip.append(t.el);
    return chip;
  };

  const play = (el, frames, duration, easing = 'ease') => el.animate(frames, { duration, easing, fill: 'forwards' });
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const clear = (el) => el.getAnimations().forEach((a) => a.cancel());

  const showOn = (t) => {
    clear(t.knob);
    t.fill.style.opacity = 1;
    t.knob.style.transform = ON;
  };

  const turnOn = async (t, ms) => {
    play(t.fill, [{ opacity: 0 }, { opacity: 1 }], ms);
    await play(t.knob, [{ transform: 'translate(0, 0)' }, { transform: MID }, { transform: ON }], ms, 'cubic-bezier(.6, -.15, .3, 1.2)').finished;
    showOn(t);
  };

  // The ring opens and the bar shoots out of the knob: now it is the G.
  const formG = (t) => {
    play(t.notch, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 150, 'cubic-bezier(.16, 1, .3, 1)');
    return play(t.bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 240, 'cubic-bezier(.34, 1.56, .64, 1)').finished;
  };

  const unformG = (t) => {
    clear(t.notch);
    clear(t.bar);
  };

  const land = async (t) => {
    const from = getComputedStyle(t.knob).transform;
    t.el.classList.remove('gt-loop');
    await play(t.knob, [{ transform: from }, { transform: ON }], 220, 'cubic-bezier(.3, 0, .3, 1.2)').finished;
    showOn(t);
  };

  const drop = (el, from) => {
    el.style.transformOrigin = '50% 100%';
    return play(el, [
      { transform: `translateY(${from})`, easing: 'cubic-bezier(.55, 0, 1, .45)' },
      { transform: 'translateY(0)', offset: 0.46 },
      { transform: 'translateY(0) scale(1.08, .86)', offset: 0.55, easing: 'cubic-bezier(.34, 1.8, .64, 1)' },
      { transform: 'translateY(0) scale(1, 1)' },
    ], 440).finished;
  };

  let markReady;
  let isReady = false;
  const ready = new Promise((done) => {
    markReady = () => {
      isReady = true;
      done();
    };
  });
  window.gahezToggle = { ready: markReady };

  const takePull = () => {
    try {
      const pulled = sessionStorage.getItem(FLAG) === '1';
      sessionStorage.removeItem(FLAG);
      return pulled;
    } catch {
      return false;
    }
  };

  const boot = async () => {
    const pulled = takePull();
    const cover = mode === 'screen' ? document.createElement('div') : null;
    const small = !cover || pulled;
    const t = toggle(small ? 56 : 128);
    const chip = small ? chipOf(t) : null;
    const mover = chip || t.el;

    if (cover) {
      cover.className = 'gt-cover';
      cover.setAttribute('role', 'status');
      cover.setAttribute('aria-label', 'جارٍ التحميل');
      cover.append(mover);
      document.body.append(cover);
    } else {
      document.body.append(chip);
    }

    if (still) {
      showOn(t);
      formG(t).finish();
      t.notch.getAnimations().forEach((a) => a.finish());
      await ready;
    } else {
      if (pulled) showOn(t);
      else {
        await drop(mover, small ? '-96px' : '-65vh');
        await turnOn(t, 260);
      }
      if (!isReady) {
        t.el.classList.add('gt-loop');
        await ready;
        await land(t);
      }
      await formG(t);
      await wait(130);
    }

    const gone = cover
      ? play(cover, [{ opacity: 1 }, { opacity: 0 }], 200, 'ease-out')
      : play(chip, [{ transform: 'translateY(0)' }, { transform: 'translateY(-96px)' }], 180, 'cubic-bezier(.55, 0, 1, .45)');
    await gone.finished;
    (cover || chip).remove();
  };

  if (mode === 'chip') {
    if (document.readyState === 'complete') markReady();
    else addEventListener('load', markReady, { once: true });
  }
  // A page that never reports must still show itself.
  setTimeout(markReady, mode === 'screen' ? 10000 : 4000);
  boot();

  /* ---------------------------------------------------------- pull to refresh */

  if (!('ontouchstart' in window)) return;
  document.documentElement.classList.add('gt-pull');

  const REACH = 70;
  const FIELD = 'input,textarea,select,[contenteditable]';
  const noPull = `${FIELD},canvas,video,[role=dialog],[data-no-pull]`;

  // A reload here would drop someone out of a class or a payment, or lose what they typed.
  const blocked = (target) => {
    if (/\/(live|checkout|dev\/pay)\//.test(location.pathname)) return true;
    if (document.querySelector('.gt-cover,.gt-chip')) return true;
    if (document.activeElement?.matches?.(FIELD)) return true;
    if (document.body.hasAttribute('data-scroll-locked') || getComputedStyle(document.body).overflowY === 'hidden') return true;
    if (target.closest?.(noPull)) return true;
    for (let n = target; n && n !== document.body; n = n.parentElement) if (n.scrollTop > 0) return true;
    return false;
  };

  let track = null;

  const pullTo = (reach) => {
    const { t, chip } = track;
    const p = Math.min(1, reach / REACH);
    const s = Math.sin(Math.PI * p);
    const far = reach > REACH ? REACH + (reach - REACH) * 0.35 : reach;
    track.y = far - REACH;
    chip.style.transform = `translateY(${track.y}px)`;
    t.fill.style.opacity = p;
    t.knob.style.transform = `translate(${79.473 * p}%, ${-1.138 * p}%) scale(${1 + 0.2 * s}, ${1 - 0.08 * s})`;
    if (p === 1 && !track.armed) {
      track.armed = true;
      formG(t);
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(12);
    } else if (p < 1 && track.armed) {
      track.armed = false;
      unformG(t);
    }
  };

  addEventListener('touchstart', (e) => {
    // A second finger ends the pull. So does the next touch, if this one's end never arrived.
    if (track?.chip) {
      abandon();
      return;
    }
    track = null;
    if (e.touches.length !== 1 || document.scrollingElement.scrollTop > 0 || blocked(e.target)) return;
    track = { x: e.touches[0].clientX, y0: e.touches[0].clientY, t: null, chip: null, y: -REACH, armed: false };
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (!track) return;
    const dx = e.touches[0].clientX - track.x;
    const dy = e.touches[0].clientY - track.y0;
    if (!track.chip) {
      if (document.scrollingElement.scrollTop > 0 || dy < -8 || Math.abs(dx) > 12) {
        track = null;
        return;
      }
      // Hold the page from the first move down: once iOS starts a scroll, it can no longer be stopped.
      if (dy > Math.abs(dx) && e.cancelable) e.preventDefault();
      if (dy > 10) {
        track.y0 += dy;
        track.t = toggle(56);
        track.chip = chipOf(track.t);
        track.chip.style.transform = `translateY(${-REACH}px)`;
        document.body.append(track.chip);
        // A target removed mid-touch keeps its events, but they stop bubbling up to these listeners.
        e.target.addEventListener('touchend', letGo, { once: true, passive: true });
        e.target.addEventListener('touchcancel', abandon, { once: true, passive: true });
      }
      return;
    }
    // Keeps the page still for the whole pull, including the finger moving back up.
    if (e.cancelable) e.preventDefault();
    pullTo(Math.max(0, dy) * 0.55);
  }, { passive: false });

  const letGo = async () => {
    const pull = track;
    track = null;
    if (!pull?.chip) return;
    const from = `translateY(${pull.y}px)`;
    if (!pull.armed) {
      await play(pull.chip, [{ transform: from }, { transform: 'translateY(-96px)' }], 180, 'cubic-bezier(.55, 0, 1, .45)').finished;
      pull.chip.remove();
      return;
    }
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch {
      // The new page simply drops the switch in again.
    }
    play(pull.chip, [{ transform: from }, { transform: 'translateY(0)' }], 160, 'cubic-bezier(.16, 1, .3, 1)');
    unformG(pull.t);
    showOn(pull.t);
    pull.t.el.classList.add('gt-loop');
    await wait(180);
    location.reload();
    // Still here means something refused the reload, so give the page back.
    await wait(8000);
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      // Nothing was stored, then.
    }
    pull.chip.remove();
  };

  const abandon = () => {
    if (track) track.armed = false;
    letGo();
  };

  addEventListener('touchend', letGo, { passive: true });
  addEventListener('touchcancel', abandon, { passive: true });
})();
