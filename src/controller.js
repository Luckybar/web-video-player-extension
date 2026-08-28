/*
 * One-Hand Video Controller — Two-Zone Gesture Edition (v3)
 * --------------------------------------------------------
 * Minimal, thumb-first video control. Overlays two large touch zones on the
 * LOWER half of the screen (easy for one thumb) plus an always-visible,
 * draggable progress bar pinned to the very bottom. Works in fullscreen too.
 *
 *   RIGHT zone : hold = temporary fast-forward (2x, restores on release)
 *                tap  = skip forward 30s
 *   LEFT  zone : hold = temporary slow-motion (0.5x, restores on release)
 *                tap  = skip back 30s
 *   Bottom bar : drag anywhere to seek to that position (always visible)
 *   Center gap : passes through to the page's own play/pause
 *
 * No dependencies. Re-running toggles it off/on. Designed to be loaded either
 * as an extension content script, a bookmarklet, or via a CDN loader.
 */
(function () {
  'use strict';

  // ---- tweakables ----------------------------------------------------------
  var JUMP_SECONDS = 30;   // tap = skip this many seconds
  var FAST_RATE    = 2;    // hold right = this playback rate
  var SLOW_RATE    = 0.5;  // hold left  = this playback rate
  var HOLD_MS      = 220;  // press longer than this = hold (else it's a tap)
  var MOVE_CANCEL  = 26;   // finger move (px) beyond this cancels a zone gesture
  var ZONE_TOP     = '46%';// touch zones start this far down (lower = easier for thumb)
  var BAR_SPACE    = 70;   // px reserved at the bottom for the progress bar

  var NS = '__oneHandVideoController__';
  if (window[NS] && window[NS].toggle) { window[NS].toggle(); return; }

  // ---- helpers -------------------------------------------------------------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    var mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return (h > 0 ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  var currentVideo = null;
  function pickVideo() {
    var vids = [].slice.call(document.querySelectorAll('video'));
    if (!vids.length) return null;
    var scored = vids.map(function (v) {
      var r = v.getBoundingClientRect();
      var area = Math.max(0, r.width) * Math.max(0, r.height);
      var playing = !v.paused && !v.ended;
      var visible = r.bottom > 0 && r.top < innerHeight && area > 0;
      return { v: v, s: (playing ? 1e12 : 0) + (visible ? area : area / 100) };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored[0].v;
  }
  function video() {
    if (currentVideo && document.contains(currentVideo)) return currentVideo;
    currentVideo = pickVideo();
    return currentVideo;
  }

  // ---- styles --------------------------------------------------------------
  var css = document.createElement('style');
  css.textContent = [
    '.ohv2-layer{position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483646;',
    'pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
    '.ohv2-zone{position:absolute;top:' + ZONE_TOP + ';bottom:' + BAR_SPACE + 'px;width:40%;pointer-events:auto;',
    'touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;',
    'display:flex;align-items:center;justify-content:center;',
    'transition:background .12s;background:rgba(255,255,255,0);}',
    '.ohv2-zone.left{left:0;}',
    '.ohv2-zone.right{right:0;}',
    '.ohv2-zone.active{background:rgba(120,170,255,.16);}',
    '.ohv2-hint{color:#fff;text-align:center;opacity:0;transition:opacity .3s;',
    'text-shadow:0 1px 6px rgba(0,0,0,.7);pointer-events:none;}',
    '.ohv2-hint .ic{font-size:32px;line-height:1;}',
    '.ohv2-hint .tx{font-size:12px;margin-top:6px;opacity:.9;}',
    '.ohv2-layer.show-hint .ohv2-hint{opacity:.55;}',
    // progress bar (always visible, draggable)
    '.ohv2-prog{position:absolute;left:10px;right:10px;bottom:12px;height:' + (BAR_SPACE - 24) + 'px;',
    'pointer-events:auto;touch-action:none;display:flex;align-items:center;gap:8px;',
    'padding:0 12px;background:rgba(16,18,24,.72);border-radius:14px;',
    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,.4);}',
    '.ohv2-t{color:#dfe4ee;font-size:12px;font-variant-numeric:tabular-nums;min-width:38px;text-align:center;}',
    '.ohv2-track{position:relative;flex:1;height:100%;display:flex;align-items:center;cursor:pointer;}',
    '.ohv2-track-bg{position:absolute;left:0;right:0;height:6px;border-radius:6px;background:rgba(255,255,255,.22);}',
    '.ohv2-track-fill{position:absolute;left:0;height:6px;border-radius:6px;background:#4c8dff;}',
    '.ohv2-track-knob{position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;',
    'box-shadow:0 1px 5px rgba(0,0,0,.55);transform:translateX(-50%);}',
    '.ohv2-track.drag .ohv2-track-knob{transform:translateX(-50%) scale(1.25);}',
    // center feedback badge
    '.ohv2-badge{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%) scale(.9);',
    'z-index:2147483647;pointer-events:none;background:rgba(10,12,16,.82);color:#fff;',
    'padding:14px 22px;border-radius:16px;font-size:26px;font-weight:800;white-space:nowrap;',
    'letter-spacing:.5px;opacity:0;transition:opacity .12s,transform .12s;',
    'display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,.5);}',
    '.ohv2-badge.on{opacity:1;transform:translate(-50%,-50%) scale(1);}',
    '.ohv2-badge small{font-size:13px;font-weight:600;opacity:.8;}',
    // toggle pill — top center, out of the way of bottom controls
    '.ohv2-pill{position:fixed;z-index:2147483647;top:10px;left:50%;transform:translateX(-50%);',
    'pointer-events:auto;background:rgba(20,22,28,.9);color:#cfe0ff;border:1px solid rgba(120,170,255,.4);',
    'border-radius:999px;padding:6px 13px;font-size:12px;font-family:inherit;cursor:pointer;',
    'white-space:nowrap;display:flex;align-items:center;gap:8px;box-shadow:0 3px 14px rgba(0,0,0,.4);}',
    '.ohv2-pill b{color:#fff;font-weight:700;}',
    '.ohv2-pill .dot{width:8px;height:8px;border-radius:50%;background:#57d38b;}',
    '.ohv2-pill.off .dot{background:#777;}'
  ].join('');

  // ---- build DOM -----------------------------------------------------------
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var layer = mk('div', 'ohv2-layer show-hint');
  var leftZone = mk('div', 'ohv2-zone left');
  var rightZone = mk('div', 'ohv2-zone right');
  leftZone.appendChild(mk('div', 'ohv2-hint',
    '<div class="ic">⏪</div><div class="tx">點 −' + JUMP_SECONDS + 's<br>長按放慢</div>'));
  rightZone.appendChild(mk('div', 'ohv2-hint',
    '<div class="ic">⏩</div><div class="tx">點 +' + JUMP_SECONDS + 's<br>長按加速</div>'));

  // progress bar
  var tCur = mk('span', 'ohv2-t', '0:00');
  var tDur = mk('span', 'ohv2-t', '0:00');
  var fill = mk('div', 'ohv2-track-fill'); fill.style.width = '0%';
  var knob = mk('div', 'ohv2-track-knob'); knob.style.left = '0%';
  var track = mk('div', 'ohv2-track');
  track.appendChild(mk('div', 'ohv2-track-bg')); track.appendChild(fill); track.appendChild(knob);
  var prog = mk('div', 'ohv2-prog');
  prog.appendChild(tCur); prog.appendChild(track); prog.appendChild(tDur);

  layer.appendChild(leftZone);
  layer.appendChild(rightZone);
  layer.appendChild(prog);

  var badge = mk('div', 'ohv2-badge');
  var pill = mk('div', 'ohv2-pill', '<span class="dot"></span><b>單手控制</b>&nbsp;開啟中 · 點此關閉');

  // ---- mount (survives fullscreen) ----------------------------------------
  function host() { return document.fullscreenElement || document.webkitFullscreenElement || document.body; }
  function mount() {
    var h = host();
    [css, layer, badge, pill].forEach(function (n) { if (n.parentNode !== h) h.appendChild(n); });
  }
  mount();
  document.addEventListener('fullscreenchange', mount, true);
  document.addEventListener('webkitfullscreenchange', mount, true);
  // safety net for sites that re-parent / fake-fullscreen
  var mountTimer = setInterval(mount, 1000);

  // hide the persistent hint after a few seconds
  var hintTimer = setTimeout(function () { layer.classList.remove('show-hint'); }, 3200);

  // ---- badge feedback ------------------------------------------------------
  var badgeTimer = null;
  function flashBadge(html, sticky) {
    badge.innerHTML = html; badge.classList.add('on');
    if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }
    if (!sticky) badgeTimer = setTimeout(function () { badge.classList.remove('on'); }, 600);
  }
  function hideBadge() { if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; } badge.classList.remove('on'); }

  // ---- progress bar: drag to seek -----------------------------------------
  var scrubbing = false, scrubPid = null;
  function seekToClientX(x) {
    var v = video(); if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    var r = track.getBoundingClientRect();
    var p = clamp((x - r.left) / r.width, 0, 1);
    v.currentTime = p * v.duration;
    fill.style.width = (p * 100) + '%';
    knob.style.left = (p * 100) + '%';
    tCur.textContent = fmt(v.currentTime);
  }
  track.addEventListener('pointerdown', function (e) {
    scrubbing = true; scrubPid = e.pointerId; track.classList.add('drag');
    try { track.setPointerCapture(e.pointerId); } catch (x) {}
    seekToClientX(e.clientX); e.preventDefault(); e.stopPropagation();
  });
  track.addEventListener('pointermove', function (e) {
    if (!scrubbing || e.pointerId !== scrubPid) return;
    seekToClientX(e.clientX); e.preventDefault();
  });
  function endScrub(e) {
    if (e.pointerId !== scrubPid) return;
    scrubbing = false; scrubPid = null; track.classList.remove('drag');
  }
  track.addEventListener('pointerup', endScrub);
  track.addEventListener('pointercancel', endScrub);

  // ---- zone gesture engine -------------------------------------------------
  function bindZone(zone, dir /* -1 left, +1 right */) {
    var timer = null, held = false, canceled = false, sx = 0, sy = 0, prevRate = 1, activePid = null;

    function enterHold() {
      held = true; zone.classList.add('active');
      var v = video(); if (!v) return;
      prevRate = v.playbackRate || 1;
      v.playbackRate = dir > 0 ? FAST_RATE : SLOW_RATE;
      flashBadge((dir > 0 ? '⏩ ' : '⏪ ') + (dir > 0 ? FAST_RATE : SLOW_RATE) + '×<small>放開回原速</small>', true);
    }
    function exitHold() { var v = video(); if (v) v.playbackRate = prevRate; zone.classList.remove('active'); hideBadge(); }
    function doTap() {
      var v = video(); if (!v) return;
      var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1e9;
      v.currentTime = clamp(v.currentTime + dir * JUMP_SECONDS, 0, dur);
      flashBadge((dir > 0 ? '+' : '−') + JUMP_SECONDS + 's', false);
    }
    function reset() { if (timer) { clearTimeout(timer); timer = null; } held = false; canceled = false; activePid = null; zone.classList.remove('active'); }

    zone.addEventListener('pointerdown', function (e) {
      if (activePid !== null) return;
      activePid = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (x) {}
      held = false; canceled = false; sx = e.clientX; sy = e.clientY;
      layer.classList.remove('show-hint');
      timer = setTimeout(function () { timer = null; enterHold(); }, HOLD_MS);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', function (e) {
      if (e.pointerId !== activePid) return;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > MOVE_CANCEL) {
        if (!held) { canceled = true; if (timer) { clearTimeout(timer); timer = null; } }
      }
    });
    zone.addEventListener('pointerup', function (e) {
      if (e.pointerId !== activePid) return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (held) exitHold(); else if (!canceled) doTap();
      reset();
    });
    zone.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== activePid) return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (held) exitHold();
      reset();
    });
    zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  bindZone(leftZone, -1);
  bindZone(rightZone, 1);

  // ---- progress refresh ----------------------------------------------------
  function refresh() {
    var v = video(); if (!v) return;
    if (!scrubbing && isFinite(v.duration) && v.duration > 0) {
      var p = (v.currentTime / v.duration) * 100;
      fill.style.width = p + '%'; knob.style.left = p + '%';
      tCur.textContent = fmt(v.currentTime); tDur.textContent = fmt(v.duration);
    }
  }
  var refreshTimer = setInterval(refresh, 400);

  // ---- on/off toggle -------------------------------------------------------
  var enabled = true;
  function setEnabled(on) {
    enabled = on;
    [leftZone, rightZone, prog].forEach(function (z) {
      z.style.pointerEvents = on ? 'auto' : 'none';
      z.style.display = on ? '' : 'none';
    });
    pill.classList.toggle('off', !on);
    pill.innerHTML = on
      ? '<span class="dot"></span><b>單手控制</b>&nbsp;開啟中 · 點此關閉'
      : '<span class="dot"></span><b>單手控制</b>&nbsp;已關閉 · 點此開啟';
    if (on) { layer.classList.add('show-hint'); clearTimeout(hintTimer); hintTimer = setTimeout(function () { layer.classList.remove('show-hint'); }, 3200); }
  }
  pill.addEventListener('click', function () { setEnabled(!enabled); });

  // ---- public API ----------------------------------------------------------
  var visible = true;
  function toggle() {
    visible = !visible;
    [layer, pill].forEach(function (n) { n.style.display = visible ? '' : 'none'; });
    if (visible) { layer.classList.add('show-hint'); clearTimeout(hintTimer); hintTimer = setTimeout(function () { layer.classList.remove('show-hint'); }, 3200); }
    else hideBadge();
  }
  window[NS] = {
    toggle: toggle,
    destroy: function () {
      clearTimeout(hintTimer); clearInterval(refreshTimer); clearInterval(mountTimer); hideBadge();
      [css, layer, badge, pill].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      document.removeEventListener('fullscreenchange', mount, true);
      document.removeEventListener('webkitfullscreenchange', mount, true);
      delete window[NS];
    }
  };
  refresh();
})();
