/*
 * One-Hand Video Controller — Two-Zone Gesture Edition
 * ----------------------------------------------------
 * Minimal, thumb-first video control. Overlays two large touch zones on the
 * video (left / right) with a small pass-through gap in the middle so the
 * page's own play/pause and controls still work.
 *
 *   RIGHT zone : hold = temporary fast-forward (2x, restores on release)
 *                tap  = skip forward 30s
 *   LEFT  zone : hold = temporary slow-motion (0.5x, restores on release)
 *                tap  = skip back 30s
 *
 * No dependencies. Re-running toggles it off/on.
 */
(function () {
  'use strict';

  // ---- tweakables ----------------------------------------------------------
  var JUMP_SECONDS = 30;   // tap = skip this many seconds
  var FAST_RATE    = 2;    // hold right = this playback rate
  var SLOW_RATE    = 0.5;  // hold left  = this playback rate
  var HOLD_MS      = 220;  // press longer than this = hold (else it's a tap)
  var MOVE_CANCEL  = 26;   // finger move (px) beyond this cancels the gesture

  var NS = '__oneHandVideoController__';
  if (window[NS] && window[NS].toggle) { window[NS].toggle(); return; }

  // ---- helpers -------------------------------------------------------------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
    '.ohv2-zone{position:absolute;top:16%;height:60%;width:40%;pointer-events:auto;',
    'touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;',
    'display:flex;align-items:center;justify-content:center;',
    'transition:background .12s;background:rgba(255,255,255,0);}',
    '.ohv2-zone.left{left:0;}',
    '.ohv2-zone.right{right:0;}',
    '.ohv2-zone.active{background:rgba(120,170,255,.16);}',
    '.ohv2-hint{color:#fff;text-align:center;opacity:.0;transition:opacity .3s;',
    'text-shadow:0 1px 6px rgba(0,0,0,.7);pointer-events:none;}',
    '.ohv2-hint .ic{font-size:34px;line-height:1;}',
    '.ohv2-hint .tx{font-size:12px;margin-top:6px;opacity:.9;}',
    '.ohv2-layer.show-hint .ohv2-hint{opacity:.55;}',
    // center feedback badge (jump / speed)
    '.ohv2-badge{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);',
    'z-index:2147483647;pointer-events:none;background:rgba(10,12,16,.82);color:#fff;',
    'padding:14px 22px;border-radius:16px;font-size:26px;font-weight:800;',
    'letter-spacing:.5px;opacity:0;transition:opacity .12s,transform .12s;white-space:nowrap;',
    'display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,.5);}',
    '.ohv2-badge.on{opacity:1;transform:translate(-50%,-50%) scale(1);}',
    '.ohv2-badge small{font-size:13px;font-weight:600;opacity:.8;}',
    // toggle pill
    '.ohv2-pill{position:fixed;z-index:2147483647;bottom:14px;left:50%;transform:translateX(-50%);',
    'pointer-events:auto;background:rgba(20,22,28,.9);color:#cfe0ff;border:1px solid rgba(120,170,255,.4);',
    'border-radius:999px;padding:7px 14px;font-size:12px;font-family:inherit;cursor:pointer;',
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
    '<div class="ic">⏪</div><div class="tx">點一下 −' + JUMP_SECONDS + 's<br>長按放慢</div>'));
  rightZone.appendChild(mk('div', 'ohv2-hint',
    '<div class="ic">⏩</div><div class="tx">點一下 +' + JUMP_SECONDS + 's<br>長按加速</div>'));
  layer.appendChild(leftZone);
  layer.appendChild(rightZone);

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

  // hide the persistent hint after a few seconds
  var hintTimer = setTimeout(function () { layer.classList.remove('show-hint'); }, 3200);

  // ---- badge feedback ------------------------------------------------------
  var badgeTimer = null;
  function flashBadge(html, sticky) {
    badge.innerHTML = html;
    badge.classList.add('on');
    if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }
    if (!sticky) badgeTimer = setTimeout(function () { badge.classList.remove('on'); }, 600);
  }
  function hideBadge() { if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; } badge.classList.remove('on'); }

  // ---- gesture engine ------------------------------------------------------
  function bindZone(zone, dir /* -1 left, +1 right */) {
    var timer = null, held = false, canceled = false, sx = 0, sy = 0, prevRate = 1, activePid = null;

    function enterHold() {
      held = true;
      zone.classList.add('active');
      var v = video(); if (!v) return;
      prevRate = v.playbackRate || 1;
      v.playbackRate = dir > 0 ? FAST_RATE : SLOW_RATE;
      flashBadge((dir > 0 ? '⏩ ' : '⏪ ') + (dir > 0 ? FAST_RATE : SLOW_RATE) + '×<small>放開回原速</small>', true);
    }
    function exitHold() {
      var v = video(); if (v) v.playbackRate = prevRate;
      zone.classList.remove('active');
      hideBadge();
    }
    function doTap() {
      var v = video(); if (!v) return;
      var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1e9;
      v.currentTime = clamp(v.currentTime + dir * JUMP_SECONDS, 0, dur);
      flashBadge((dir > 0 ? '+' : '−') + JUMP_SECONDS + 's', false);
    }
    function reset() {
      if (timer) { clearTimeout(timer); timer = null; }
      held = false; canceled = false; activePid = null;
      zone.classList.remove('active');
    }

    zone.addEventListener('pointerdown', function (e) {
      if (activePid !== null) return;           // ignore extra fingers
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
    function up(e) {
      if (e.pointerId !== activePid) return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (held) exitHold();
      else if (!canceled) doTap();
      reset();
    }
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== activePid) return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (held) exitHold();
      reset();
    });
    // stop context menu on long-press (mobile)
    zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  bindZone(leftZone, -1);
  bindZone(rightZone, 1);

  // ---- on/off toggle -------------------------------------------------------
  var enabled = true;
  function setEnabled(on) {
    enabled = on;
    leftZone.style.pointerEvents = on ? 'auto' : 'none';
    rightZone.style.pointerEvents = on ? 'auto' : 'none';
    leftZone.style.display = on ? 'flex' : 'none';
    rightZone.style.display = on ? 'flex' : 'none';
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
    // toggle whole overlay visibility (re-tap of bookmarklet / extension icon)
    visible = !visible;
    [layer, pill].forEach(function (n) { n.style.display = visible ? '' : 'none'; });
    if (visible) { layer.classList.add('show-hint'); clearTimeout(hintTimer); hintTimer = setTimeout(function(){ layer.classList.remove('show-hint'); }, 3200); }
    else hideBadge();
  }
  window[NS] = {
    toggle: toggle,
    destroy: function () {
      clearTimeout(hintTimer); hideBadge();
      [css, layer, badge, pill].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      document.removeEventListener('fullscreenchange', mount, true);
      document.removeEventListener('webkitfullscreenchange', mount, true);
      delete window[NS];
    }
  };
})();
