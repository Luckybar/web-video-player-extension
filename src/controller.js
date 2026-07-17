/*
 * One-Hand Video Controller (單手影片控制器)
 * -----------------------------------------
 * A self-contained overlay that adds thumb-friendly, one-handed controls
 * to any HTML5 <video> on a page. Shared by the browser extension and the
 * bookmarklet build.
 *
 * Design goals:
 *  - Everything lives in the lower half of the screen (thumb zone).
 *  - Big touch targets (>= 56px).
 *  - Draggable launcher; switchable to left/right hand.
 *  - Works over normal and fullscreen video.
 *  - No external dependencies, no storage APIs required (uses in-memory +
 *    optional localStorage guarded in try/catch for the extension case).
 */
(function () {
  'use strict';

  var NS = '__oneHandVideoController__';

  // If already loaded, just toggle the panel and bail (bookmarklet re-tap).
  if (window[NS] && window[NS].toggle) {
    window[NS].toggle();
    return;
  }

  // ---- small helpers -------------------------------------------------------
  function el(tag, props, children) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === 'style') { e.setAttribute('style', props[k]); }
        else if (k === 'text') { e.textContent = props[k]; }
        else if (k === 'html') { e.innerHTML = props[k]; }
        else { e.setAttribute(k, props[k]); }
      }
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    var mm = (h > 0 ? String(m).padStart(2, '0') : String(m));
    var ss = String(s).padStart(2, '0');
    return (h > 0 ? h + ':' : '') + mm + ':' + ss;
  }
  function store(key, val) {
    try {
      if (val === undefined) {
        var v = localStorage.getItem(NS + key);
        return v === null ? undefined : v;
      }
      localStorage.setItem(NS + key, val);
    } catch (e) { /* storage may be blocked; ignore */ }
  }

  // ---- find the video to control ------------------------------------------
  var currentVideo = null;
  function pickVideo() {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
    if (!vids.length) return null;
    // Prefer a playing video, then the largest visible one.
    var scored = vids.map(function (v) {
      var r = v.getBoundingClientRect();
      var area = Math.max(0, r.width) * Math.max(0, r.height);
      var playing = !v.paused && !v.ended && v.currentTime > 0;
      var visible = r.bottom > 0 && r.top < innerHeight && area > 0;
      return { v: v, score: (playing ? 1e12 : 0) + (visible ? area : area / 100) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored[0].v;
  }
  function video() {
    if (currentVideo && document.contains(currentVideo)) return currentVideo;
    currentVideo = pickVideo();
    return currentVideo;
  }

  // ---- brightness (screen dim) overlay ------------------------------------
  var dim = 0; // 0..0.8
  var dimEl = el('div', {
    style: 'position:fixed;inset:0;background:#000;pointer-events:none;' +
           'z-index:2147483645;opacity:0;transition:opacity .12s;'
  });
  function applyDim() { dimEl.style.opacity = String(dim); }

  // ---- styles --------------------------------------------------------------
  var css = document.createElement('style');
  css.textContent = [
    '.ohv-root{position:fixed;z-index:2147483646;left:0;right:0;bottom:0;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation;}',
    '.ohv-panel{margin:0 8px 10px;background:rgba(20,20,24,.86);',
    'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
    'border-radius:18px;padding:10px 10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.5);',
    'color:#fff;max-width:560px;margin-left:auto;margin-right:auto;',
    'transform:translateY(0);transition:transform .18s,opacity .18s;}',
    '.ohv-hidden .ohv-panel{transform:translateY(140%);opacity:0;pointer-events:none;}',
    '.ohv-seek{display:flex;align-items:center;gap:8px;margin:2px 4px 10px;font-size:12px;color:#cfd2da;}',
    '.ohv-bar{position:relative;flex:1;height:22px;display:flex;align-items:center;cursor:pointer;}',
    '.ohv-bar-bg{position:absolute;left:0;right:0;height:6px;border-radius:6px;background:rgba(255,255,255,.22);}',
    '.ohv-bar-fill{position:absolute;left:0;height:6px;border-radius:6px;background:#4c8dff;}',
    '.ohv-bar-knob{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.5);transform:translateX(-50%);}',
    '.ohv-row{display:flex;gap:8px;justify-content:center;margin-top:8px;}',
    '.ohv-btn{flex:1;min-width:0;height:60px;border:0;border-radius:14px;',
    'background:rgba(255,255,255,.10);color:#fff;font-size:22px;font-weight:600;',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;',
    'cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .1s,transform .05s;}',
    '.ohv-btn:active{background:rgba(255,255,255,.26);transform:scale(.94);}',
    '.ohv-btn small{font-size:11px;font-weight:500;opacity:.8;}',
    '.ohv-btn.big{flex:1.4;background:#4c8dff;}',
    '.ohv-btn.big:active{background:#3f79e0;}',
    '.ohv-val{font-size:15px;font-weight:700;}',
    '.ohv-launch{position:fixed;z-index:2147483646;width:52px;height:52px;border-radius:50%;',
    'background:#4c8dff;color:#fff;font-size:24px;border:0;display:flex;align-items:center;',
    'justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.45);bottom:18px;right:14px;',
    'cursor:pointer;touch-action:none;}',
    '.ohv-launch:active{transform:scale(.92);}',
    '.ohv-top{display:flex;justify-content:space-between;align-items:center;margin:0 4px 6px;font-size:12px;color:#aeb2bd;}',
    '.ohv-x{background:none;border:0;color:#aeb2bd;font-size:20px;cursor:pointer;padding:2px 8px;}',
    '.ohv-mini{background:none;border:0;color:#aeb2bd;font-size:13px;cursor:pointer;padding:2px 8px;}'
  ].join('');

  // ---- build UI ------------------------------------------------------------
  var root = el('div', { 'class': 'ohv-root ohv-hidden' });

  // top bar: hand switch + speed label + close
  var speedLabel = el('span', { text: '1.0x', 'class': 'ohv-val' });
  var handBtn = el('button', { 'class': 'ohv-mini', text: '↔ 換手' });
  var closeBtn = el('button', { 'class': 'ohv-x', text: '✕' });
  var top = el('div', { 'class': 'ohv-top' }, [
    handBtn,
    el('span', { html: '速度 ' }, [speedLabel]),
    closeBtn
  ]);

  // seek bar
  var timeCur = el('span', { text: '0:00' });
  var timeDur = el('span', { text: '0:00' });
  var barFill = el('div', { 'class': 'ohv-bar-fill', style: 'width:0%' });
  var barKnob = el('div', { 'class': 'ohv-bar-knob', style: 'left:0%' });
  var bar = el('div', { 'class': 'ohv-bar' }, [
    el('div', { 'class': 'ohv-bar-bg' }), barFill, barKnob
  ]);
  var seek = el('div', { 'class': 'ohv-seek' }, [timeCur, bar, timeDur]);

  function mkBtn(icon, label, cls) {
    return el('button', { 'class': 'ohv-btn' + (cls ? ' ' + cls : '') }, [
      el('span', { text: icon }),
      label ? el('small', { text: label }) : null
    ]);
  }

  // row 1: transport
  var backBtn = mkBtn('⏪', '10秒');
  var playBtn = mkBtn('▶', null, 'big');
  var fwdBtn = mkBtn('⏩', '10秒');
  var row1 = el('div', { 'class': 'ohv-row' }, [backBtn, playBtn, fwdBtn]);

  // row 2: speed - / + and volume - / +
  var spDownBtn = mkBtn('🐢', '慢');
  var spUpBtn = mkBtn('🐇', '快');
  var volDownBtn = mkBtn('🔉', '音量−');
  var volUpBtn = mkBtn('🔊', '音量＋');
  var row2 = el('div', { 'class': 'ohv-row' }, [spDownBtn, spUpBtn, volDownBtn, volUpBtn]);

  // row 3: mute + brightness
  var muteBtn = mkBtn('🔇', '靜音');
  var dimDownBtn = mkBtn('🔆', '亮');
  var dimUpBtn = mkBtn('🌙', '暗');
  var fsBtn = mkBtn('⛶', '全螢幕');
  var row3 = el('div', { 'class': 'ohv-row' }, [muteBtn, dimDownBtn, dimUpBtn, fsBtn]);

  var panel = el('div', { 'class': 'ohv-panel' }, [top, seek, row1, row2, row3]);
  root.appendChild(panel);

  var launch = el('button', { 'class': 'ohv-launch', text: '🎬' });

  // ---- mounting (handles fullscreen) --------------------------------------
  function host() { return document.fullscreenElement || document.webkitFullscreenElement || document.body; }
  function mount() {
    var h = host();
    [css, dimEl, root, launch].forEach(function (node) {
      if (node.parentNode !== h) h.appendChild(node);
    });
  }
  mount();
  document.addEventListener('fullscreenchange', mount, true);
  document.addEventListener('webkitfullscreenchange', mount, true);

  // ---- open / close --------------------------------------------------------
  var open = false;
  function setOpen(o) {
    open = o;
    root.classList.toggle('ohv-hidden', !o);
    launch.style.display = o ? 'none' : 'flex';
  }
  function toggle() { setOpen(!open); }
  launch.addEventListener('click', function () { setOpen(true); });
  closeBtn.addEventListener('click', function () { setOpen(false); });

  // ---- hand switch ---------------------------------------------------------
  var rightHand = store('hand') !== 'L';
  function applyHand() {
    launch.style.right = rightHand ? '14px' : 'auto';
    launch.style.left = rightHand ? 'auto' : '14px';
  }
  applyHand();
  handBtn.addEventListener('click', function () {
    rightHand = !rightHand; store('hand', rightHand ? 'R' : 'L'); applyHand();
  });

  // ---- transport actions ---------------------------------------------------
  function withVideo(fn) { var v = video(); if (v) fn(v); }
  backBtn.addEventListener('click', function () { withVideo(function (v) { v.currentTime = clamp(v.currentTime - 10, 0, v.duration || 1e9); }); });
  fwdBtn.addEventListener('click', function () { withVideo(function (v) { v.currentTime = clamp(v.currentTime + 10, 0, v.duration || 1e9); }); });
  playBtn.addEventListener('click', function () { withVideo(function (v) { if (v.paused) v.play(); else v.pause(); }); });

  // ---- speed ---------------------------------------------------------------
  var speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  function setSpeed(dir) {
    withVideo(function (v) {
      var i = speeds.indexOf(v.playbackRate);
      if (i < 0) { // snap to nearest
        i = 2; var best = 1e9;
        speeds.forEach(function (s, k) { var d = Math.abs(s - v.playbackRate); if (d < best) { best = d; i = k; } });
      }
      i = clamp(i + dir, 0, speeds.length - 1);
      v.playbackRate = speeds[i];
      speedLabel.textContent = speeds[i].toFixed(2).replace(/0$/, '').replace(/\.$/, '') + 'x';
    });
  }
  spUpBtn.addEventListener('click', function () { setSpeed(1); });
  spDownBtn.addEventListener('click', function () { setSpeed(-1); });

  // ---- volume + mute -------------------------------------------------------
  volUpBtn.addEventListener('click', function () { withVideo(function (v) { v.muted = false; v.volume = clamp(v.volume + 0.1, 0, 1); }); });
  volDownBtn.addEventListener('click', function () { withVideo(function (v) { v.volume = clamp(v.volume - 0.1, 0, 1); }); });
  muteBtn.addEventListener('click', function () { withVideo(function (v) { v.muted = !v.muted; }); });

  // ---- brightness (dim) ----------------------------------------------------
  dimUpBtn.addEventListener('click', function () { dim = clamp(dim + 0.15, 0, 0.8); applyDim(); });
  dimDownBtn.addEventListener('click', function () { dim = clamp(dim - 0.15, 0, 0.8); applyDim(); });

  // ---- fullscreen ----------------------------------------------------------
  fsBtn.addEventListener('click', function () {
    withVideo(function (v) {
      var target = v;
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else if (target.requestFullscreen) { target.requestFullscreen(); }
        else if (target.webkitRequestFullscreen) { target.webkitRequestFullscreen(); }
        else if (target.webkitEnterFullscreen) { target.webkitEnterFullscreen(); }
      } catch (e) {}
    });
  });

  // ---- seek bar interaction -----------------------------------------------
  var scrubbing = false;
  function seekFromClientX(x) {
    withVideo(function (v) {
      var r = bar.getBoundingClientRect();
      var p = clamp((x - r.left) / r.width, 0, 1);
      if (isFinite(v.duration)) v.currentTime = p * v.duration;
      updateProgress();
    });
  }
  function ptX(e) { return e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX; }
  bar.addEventListener('touchstart', function (e) { scrubbing = true; seekFromClientX(ptX(e)); e.preventDefault(); }, { passive: false });
  bar.addEventListener('touchmove', function (e) { if (scrubbing) { seekFromClientX(ptX(e)); e.preventDefault(); } }, { passive: false });
  bar.addEventListener('touchend', function () { scrubbing = false; });
  bar.addEventListener('mousedown', function (e) { scrubbing = true; seekFromClientX(ptX(e)); });
  window.addEventListener('mousemove', function (e) { if (scrubbing) seekFromClientX(ptX(e)); });
  window.addEventListener('mouseup', function () { scrubbing = false; });

  // ---- draggable launcher --------------------------------------------------
  (function () {
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    launch.addEventListener('touchstart', function (e) {
      dragging = true; moved = false;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      var r = launch.getBoundingClientRect(); ox = r.left; oy = r.top;
    }, { passive: true });
    launch.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      launch.style.left = clamp(ox + dx, 4, innerWidth - 56) + 'px';
      launch.style.right = 'auto';
      launch.style.top = clamp(oy + dy, 4, innerHeight - 56) + 'px';
      launch.style.bottom = 'auto';
    }, { passive: true });
    launch.addEventListener('touchend', function (e) {
      dragging = false;
      if (!moved) { setOpen(true); } // treat as tap
    });
  })();

  // ---- progress refresh loop ----------------------------------------------
  function updateProgress() {
    var v = video();
    if (!v) return;
    if (!v.paused) { playBtn.firstChild.textContent = '⏸'; }
    else { playBtn.firstChild.textContent = '▶'; }
    muteBtn.firstChild.textContent = v.muted || v.volume === 0 ? '🔇' : '🔈';
    if (isFinite(v.duration) && v.duration > 0 && !scrubbing) {
      var p = (v.currentTime / v.duration) * 100;
      barFill.style.width = p + '%';
      barKnob.style.left = p + '%';
      timeCur.textContent = fmt(v.currentTime);
      timeDur.textContent = fmt(v.duration);
    }
    var sp = v.playbackRate;
    speedLabel.textContent = (Math.round(sp * 100) / 100).toString() + 'x';
  }
  var loop = setInterval(updateProgress, 500);

  // ---- public API ----------------------------------------------------------
  window[NS] = {
    toggle: toggle,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    destroy: function () {
      clearInterval(loop);
      [css, dimEl, root, launch].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      document.removeEventListener('fullscreenchange', mount, true);
      document.removeEventListener('webkitfullscreenchange', mount, true);
      delete window[NS];
    }
  };

  // Open immediately on first load so the user sees it.
  setOpen(true);
  updateProgress();
})();
