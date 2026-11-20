/* Ghost Chain — one-level prototype.
 * A fixed-step simulation (60 ticks/s). Each run records one input direction per tick;
 * replaying the same inputs against the same earlier ghosts reproduces the run exactly,
 * which is what lets runs chain: every ghost was recorded with the ghosts before it. */
(function () {
  'use strict';

  // ---- world -------------------------------------------------------------
  var LW = 600, LH = 1180, TOP = 120;           // logical canvas; world drawn at y+TOP
  var ROOM = { x0: 30, y0: 40, x1: 570, y1: 980 };
  var R = 18, SPEED = 250, TPS = 60, DT = 1 / TPS, RUN_TICKS = 12 * TPS;
  var GAP = [232, 368];
  var GATES = [{ y: 650, plate: 0 }, { y: 360, plate: 1 }];
  var PLATES = [{ x: 115, y: 800, s: 84 }, { x: 485, y: 500, s: 84 }];
  var EXIT = { x: 300, y: 165, r: 34 };
  var START = { x: 300, y: 920 };
  var COLORS = ['#ff8a5c', '#5cc8ff', '#7dffb0', '#ff7ad9', '#c9a4ff'];
  var YOU_COLOR = '#ffe066';

  var WALLS = [];
  GATES.forEach(function (g) {
    WALLS.push([ROOM.x0, g.y - 9, GAP[0], g.y + 9]);
    WALLS.push([GAP[1], g.y - 9, ROOM.x1, g.y + 9]);
  });
  function gateRect(g) { return [GAP[0], g.y - 9, GAP[1], g.y + 9]; }

  var DIRS = [[0, 0]];
  for (var d = 0; d < 8; d++) DIRS.push([Math.cos(d * Math.PI / 4), Math.sin(d * Math.PI / 4)]);
  function quantize(dx, dy) {
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
    var a = Math.atan2(dy, dx); var k = Math.round(a / (Math.PI / 4));
    return ((k % 8) + 8) % 8 + 1;
  }

  // ---- simulation --------------------------------------------------------
  function onPlate(p, i) {
    var pl = PLATES[i], h = pl.s / 2;
    return p.x > pl.x - h && p.x < pl.x + h && p.y > pl.y - h && p.y < pl.y + h;
  }
  function gatesOpen(agents) {
    return GATES.map(function (g) { return agents.some(function (a) { return onPlate(a, g.plate); }); });
  }
  function pushOut(p, r) {
    var cx = Math.max(r[0], Math.min(p.x, r[2])), cy = Math.max(r[1], Math.min(p.y, r[3]));
    var dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    if (d2 > 1e-9) { var d = Math.sqrt(d2); p.x = cx + dx / d * R; p.y = cy + dy / d * R; return; }
    var pen = [p.x - r[0] + R, r[2] - p.x + R, p.y - r[1] + R, r[3] - p.y + R];
    var m = Math.min.apply(null, pen);
    if (m === pen[0]) p.x = r[0] - R; else if (m === pen[1]) p.x = r[2] + R;
    else if (m === pen[2]) p.y = r[1] - R; else p.y = r[3] + R;
  }
  function move(p, dir, open) {
    var v = DIRS[dir] || DIRS[0];
    p.x += v[0] * SPEED * DT; p.y += v[1] * SPEED * DT;
    for (var it = 0; it < 2; it++) {
      WALLS.forEach(function (w) { pushOut(p, w); });
      GATES.forEach(function (g, i) { if (!open[i]) pushOut(p, gateRect(g)); });
    }
    p.x = Math.max(ROOM.x0 + R, Math.min(ROOM.x1 - R, p.x));
    p.y = Math.max(ROOM.y0 + R, Math.min(ROOM.y1 - R, p.y));
  }
  function atExit(p) { return Math.hypot(p.x - EXIT.x, p.y - EXIT.y) < EXIT.r; }

  // Simulate ghosts alone (plus an optional controller for a new runner) for `ticks`.
  // Returns per-tick positions; used to make bot ghosts and the "leaving in" hints.
  function simulate(ghosts, ticks, controller) {
    var gp = ghosts.map(function () { return { x: START.x, y: START.y }; });
    var me = controller ? { x: START.x, y: START.y } : null, inputs = [], track = [];
    for (var t = 0; t < ticks; t++) {
      var agents = me ? gp.concat([me]) : gp.slice();
      var open = gatesOpen(agents);
      ghosts.forEach(function (g, i) { move(gp[i], g.inputs[t] || 0, open); });
      if (me) { var dir = controller(t, me, open); inputs.push(dir); move(me, dir, open); }
      track.push(gp.map(function (p) { return { x: p.x, y: p.y }; }));
    }
    return { inputs: inputs, track: track };
  }

  // A scripted "stranger": walk to each waypoint, then hold until its tick.
  function botController(wps) {
    var i = 0;
    return function (t, me) {
      while (i < wps.length) {
        var w = wps[i], dx = w[0] - me.x, dy = w[1] - me.y, dist = Math.hypot(dx, dy);
        if (dist > SPEED * DT) return quantize(dx, dy);
        if (t < w[2]) return 0;
        i++;
      }
      return 0;
    };
  }
  var STRANGERS = (function () {
    var ana = { name: 'u/ana', color: COLORS[0] };
    ana.inputs = simulate([], RUN_TICKS, botController([[115, 800, 260], [190, 880, RUN_TICKS]])).inputs;
    var ben = { name: 'u/ben', color: COLORS[1] };
    ben.inputs = simulate([ana], RUN_TICKS, botController([[300, 705, 0], [300, 705, 75], [300, 560, 0], [485, 500, 330], [420, 430, RUN_TICKS]])).inputs;
    return [ana, ben];
  })();

  // ---- game state --------------------------------------------------------
  var S = {
    screen: 'menu', mode: null, chain: [], tick: 0, me: null, ghostPos: [], inputs: [],
    dir: 0, keys: {}, pointer: null, result: null, hintTrack: null, countdown: 0,
  };
  window.__gc = S; // test hook (S.autopilot = function (tick, me, open) -> dir)

  function startRun() {
    S.tick = 0; S.inputs = []; S.me = { x: START.x, y: START.y };
    S.ghostPos = S.chain.map(function () { return { x: START.x, y: START.y }; });
    S.hintTrack = simulate(S.chain, RUN_TICKS).track;
    S.countdown = 1.6; S.screen = 'countdown'; S.result = null;
  }
  function startJoin() { S.mode = 'join'; S.chain = STRANGERS.slice(); startRun(); }
  function startFresh() { S.mode = 'fresh'; S.chain = []; startRun(); }
  S.startJoin = startJoin; S.startFresh = startFresh;

  function step() {
    var agents = S.ghostPos.concat([S.me]);
    var open = gatesOpen(agents);
    S.chain.forEach(function (g, i) { move(S.ghostPos[i], g.inputs[S.tick] || 0, open); });
    var dir = S.autopilot ? S.autopilot(S.tick, S.me, open) : S.dir;
    S.inputs.push(dir); move(S.me, dir, open);
    S.tick++;
    if (atExit(S.me)) return finish(true);
    if (S.tick >= RUN_TICKS) return finish(false);
  }
  function finish(won) {
    var link = S.chain.length + 1;
    S.result = { won: won, link: link, time: S.tick / TPS };
    if (S.mode === 'fresh' && !won) {
      S.result.ghost = { name: 'you #' + link, color: COLORS[(link - 1) % COLORS.length], inputs: S.inputs.slice() };
    }
    S.screen = 'result';
  }

  // ---- input -------------------------------------------------------------
  var KEYMAP = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  function keyDir() {
    var x = 0, y = 0;
    Object.keys(S.keys).forEach(function (k) { if (S.keys[k] && KEYMAP[k]) { x += KEYMAP[k][0]; y += KEYMAP[k][1]; } });
    return quantize(x, y);
  }
  addEventListener('keydown', function (e) {
    if (KEYMAP[e.code]) { S.keys[e.code] = true; e.preventDefault(); }
    if ((e.code === 'Enter' || e.code === 'Space') && buttons.length) { buttons[0].fn(); e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (KEYMAP[e.code]) S.keys[e.code] = false; });

  var cv = document.getElementById('c'), g = cv.getContext('2d');
  var view = { s: 1, ox: 0, oy: 0, dpr: 1 };
  function toLogical(e) { return { x: (e.clientX - view.ox) / view.s, y: (e.clientY - view.oy) / view.s }; }
  var buttons = [];
  cv.addEventListener('pointerdown', function (e) {
    var p = toLogical(e);
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) { b.fn(); return; }
    }
    if (S.screen === 'run' || S.screen === 'countdown') { S.pointer = p; cv.setPointerCapture(e.pointerId); }
  });
  cv.addEventListener('pointermove', function (e) { if (S.pointer) S.pointer = toLogical(e); });
  function release() { S.pointer = null; }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

  function pointerDir() {
    if (!S.pointer || !S.me) return 0;
    var dx = S.pointer.x - S.me.x, dy = S.pointer.y - TOP - S.me.y;
    return Math.hypot(dx, dy) < 14 ? 0 : quantize(dx, dy);
  }

  // ---- drawing helpers ---------------------------------------------------
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function txt(s, x, y, size, color, align, weight) {
    g.font = (weight || 600) + ' ' + size + 'px -apple-system, system-ui, Helvetica, Arial, sans-serif';
    g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  }
  function button(label, x, y, w, h, fn, primary) {
    g.fillStyle = primary ? YOU_COLOR : '#22263d'; rr(x, y, w, h, h / 2); g.fill();
    if (!primary) { g.strokeStyle = '#3d4466'; g.lineWidth = 2; rr(x, y, w, h, h / 2); g.stroke(); }
    txt(label, x + w / 2, y + h / 2 + 1, 22, primary ? '#0d0f1a' : '#ffffff', 'center', 800);
    buttons.push({ x: x, y: y, w: w, h: h, fn: fn });
  }

  function drawWorld(open, time) {
    g.save(); g.translate(0, TOP);
    g.fillStyle = '#171a2b'; rr(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0, 16); g.fill();
    g.strokeStyle = '#232843'; g.lineWidth = 1;
    for (var x = ROOM.x0 + 45; x < ROOM.x1; x += 45) { g.beginPath(); g.moveTo(x, ROOM.y0); g.lineTo(x, ROOM.y1); g.stroke(); }
    for (var y = ROOM.y0 + 45; y < ROOM.y1; y += 45) { g.beginPath(); g.moveTo(ROOM.x0, y); g.lineTo(ROOM.x1, y); g.stroke(); }
    g.strokeStyle = '#3d4466'; g.lineWidth = 6; rr(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0, 16); g.stroke();
    PLATES.forEach(function (p, i) {
      var on = open[i], h = p.s / 2;
      g.save(); if (on) { g.shadowColor = '#7dffb0'; g.shadowBlur = 28; }
      g.fillStyle = on ? '#2fbf72' : '#2c3350'; rr(p.x - h, p.y - h, p.s, p.s, 12); g.fill(); g.restore();
      g.strokeStyle = on ? '#b9ffd6' : '#4b5580'; g.lineWidth = 3; rr(p.x - h, p.y - h, p.s, p.s, 12); g.stroke();
      txt('PLATE ' + (i + 1), p.x, p.y + h + 18, 15, '#8d96c2', 'center', 800);
    });
    GATES.forEach(function (gt, i) {
      g.fillStyle = '#3d4466';
      g.fillRect(ROOM.x0, gt.y - 9, GAP[0] - ROOM.x0, 18); g.fillRect(GAP[1], gt.y - 9, ROOM.x1 - GAP[1], 18);
      var col = open[i] ? '#3ddc84' : '#ff5470';
      if (!open[i]) { g.fillStyle = col; g.fillRect(GAP[0], gt.y - 7, GAP[1] - GAP[0], 14); }
      else { g.fillStyle = col; g.fillRect(GAP[0], gt.y - 7, 10, 14); g.fillRect(GAP[1] - 10, gt.y - 7, 10, 14); }
      var pl = PLATES[gt.plate];
      g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath();
      g.moveTo(pl.x, pl.y - pl.s / 2 - (i === 0 ? 0 : 0)); g.lineTo(i === 0 ? GAP[0] - 6 : GAP[1] + 6, gt.y + 12); g.stroke(); g.setLineDash([]);
      txt('GATE ' + (i + 1), i === 0 ? GAP[1] + 70 : GAP[0] - 70, gt.y - 24, 15, col, 'center', 800);
    });
    g.save(); g.translate(EXIT.x, EXIT.y);
    for (var k = 0; k < 3; k++) { g.strokeStyle = 'rgba(190,140,255,' + (0.85 - k * 0.25) + ')'; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, EXIT.r - 8 + k * 12 + 3 * Math.sin(time * 4 + k), 0, Math.PI * 2); g.stroke(); }
    g.restore(); txt('EXIT', EXIT.x, EXIT.y + 64, 16, '#c9a4ff', 'center', 800);
    txt('START', START.x, START.y + 40, 14, '#555c80', 'center', 800);
    g.restore();
  }

  function drawAgent(p, color, label, ghost, note) {
    var x = p.x, y = p.y + TOP;
    g.save();
    g.globalAlpha = ghost ? 0.55 : 1;
    if (!ghost) { g.shadowColor = color; g.shadowBlur = 22; }
    g.fillStyle = color; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.globalAlpha = ghost ? 0.9 : 1;
    g.fillStyle = '#0d0f1a'; g.beginPath(); g.arc(x - 6, y - 4, 3.4, 0, 7); g.arc(x + 6, y - 4, 3.4, 0, 7); g.fill();
    g.font = '800 14px -apple-system, system-ui, sans-serif';
    var w = g.measureText(label).width + 14;
    g.fillStyle = ghost ? 'rgba(13,15,26,0.8)' : color; rr(x - w / 2, y - R - 26, w, 20, 10); g.fill();
    txt(label, x, y - R - 15, 14, ghost ? color : '#0d0f1a', 'center', 800);
    if (note) {
      g.font = '800 13px -apple-system, system-ui, sans-serif'; var w2 = g.measureText(note).width + 12;
      g.fillStyle = note.indexOf('leaves') === 0 && parseFloat(note.slice(7)) < 2 ? '#ff5470' : '#2c3350';
      rr(x - w2 / 2, y + R + 6, w2, 19, 9); g.fill(); txt(note, x, y + R + 16, 13, '#ffffff', 'center', 800);
    }
    g.restore();
  }

  // When will ghost i step off the plate it is standing on (from the ghost-only forecast)?
  function leavesIn(i) {
    var tr = S.hintTrack; if (!tr || !tr[S.tick]) return null;
    var p = tr[S.tick][i], plate = -1;
    for (var k = 0; k < PLATES.length; k++) if (onPlate(p, k)) plate = k;
    if (plate < 0) return null;
    for (var t = S.tick + 1; t < tr.length; t++) if (!onPlate(tr[t][i], plate)) return (t - S.tick) / TPS;
    return null; // stays to the end
  }

  function drawHud(time) {
    txt('GHOST CHAIN', 24, 34, 28, '#ffffff', 'left', 900);
    txt('Day 312 · this level needs 3 people', 24, 66, 16, '#8d96c2', 'left', 600);
    var names = S.chain.map(function (c) { return { n: c.name, c: c.color }; });
    names.push({ n: 'YOU', c: YOU_COLOR });
    var x = 24, y = 94;
    names.forEach(function (it, i) {
      g.font = '800 14px -apple-system, system-ui, sans-serif'; var w = g.measureText(it.n).width + 22;
      g.fillStyle = it.c; g.globalAlpha = i === names.length - 1 ? 1 : 0.75; rr(x, y - 13, w, 26, 13); g.fill(); g.globalAlpha = 1;
      txt(it.n, x + w / 2, y + 1, 14, '#0d0f1a', 'center', 800);
      x += w + 8;
    });
    if (S.screen === 'run' || S.screen === 'countdown') {
      var left = Math.max(0, (RUN_TICKS - S.tick) / TPS);
      g.fillStyle = '#22263d'; rr(400, 52, 176, 12, 6); g.fill();
      g.fillStyle = left < 3 ? '#ff5470' : YOU_COLOR; rr(400, 52, 176 * left / (RUN_TICKS / TPS), 12, 6); g.fill();
      txt(left.toFixed(1) + 's', 576, 30, 22, left < 3 ? '#ff5470' : '#ffffff', 'right', 900);
    }
  }

  function hint() {
    if (S.mode === 'join') return 'Ghosts hold the gates for you. Reach the EXIT before they leave.';
    var n = S.chain.length + 1;
    if (n === 1) return 'Link 1: stand on PLATE 1 to hold GATE 1 open for the next player.';
    if (n === 2) return 'Link 2: your ghost holds Gate 1. Go through and hold PLATE 2.';
    return 'Link ' + n + ': both ghosts hold the gates. Reach the EXIT!';
  }

  // ---- screens -----------------------------------------------------------
  function drawMenu(time) {
    drawWorld([false, false], time);
    g.fillStyle = 'rgba(8,9,16,0.84)'; g.fillRect(0, 0, LW, LH);
    txt('GHOST CHAIN', LW / 2, 230, 56, '#ffffff', 'center', 900);
    txt('A level nobody can finish alone', LW / 2, 290, 24, YOU_COLOR, 'center', 700);
    var lines = ['Standing on a PLATE opens its GATE,', 'but only while someone stands there.',
      'Every run is saved as a ghost that replays', 'exactly, and helps the next player through.'];
    lines.forEach(function (l, i) { txt(l, LW / 2, 360 + i * 32, 19, '#aab2dd', 'center', 600); });
    button('Join today\'s chain', 90, 540, 420, 70, startJoin, true);
    txt('u/ana and u/ben already played. You\'re link #3.', LW / 2, 632, 16, '#8d96c2', 'center', 600);
    button('Build a chain yourself', 90, 690, 420, 70, startFresh, false);
    txt('Play link 1, then 2, then 3, helped by your own ghosts.', LW / 2, 782, 16, '#8d96c2', 'center', 600);
    txt('Move: drag your finger, or arrow keys / WASD', LW / 2, 900, 16, '#555c80', 'center', 700);
    txt('Prototype · one level · ghosts are stored only in this tab', LW / 2, 1120, 14, '#555c80', 'center', 600);
  }

  function drawPlay(time) {
    var agents = S.ghostPos.concat([S.me]);
    var open = gatesOpen(agents);
    drawWorld(open, time);
    S.chain.forEach(function (c, i) {
      var li = S.screen === 'run' ? leavesIn(i) : null;
      drawAgent(S.ghostPos[i], c.color, 'ghost · ' + c.name, true, li !== null ? 'leaves ' + li.toFixed(1) + 's' : null);
    });
    drawAgent(S.me, YOU_COLOR, 'YOU', false);
    if (S.pointer && S.screen === 'run') {
      g.strokeStyle = 'rgba(255,224,102,0.5)'; g.lineWidth = 3; g.beginPath();
      g.arc(S.pointer.x, S.pointer.y, 22, 0, Math.PI * 2); g.stroke();
    }
    drawHud(time);
    g.fillStyle = 'rgba(8,9,16,0.85)'; rr(20, 1112, 560, 56, 14); g.fill();
    txt(hint(), LW / 2, 1140, 16, '#ffffff', 'center', 700);
    if (S.screen === 'countdown') {
      var n = Math.ceil(S.countdown / 0.55);
      txt(n > 0 ? String(n) : 'GO', LW / 2, TOP + 520, 120, '#ffffff', 'center', 900);
    }
  }

  function drawResult(time) {
    drawPlay(time);
    var r = S.result;
    g.fillStyle = 'rgba(8,9,16,0.8)'; g.fillRect(0, 0, LW, LH);
    g.fillStyle = '#171a2b'; rr(40, 300, 520, 560, 24); g.fill();
    g.strokeStyle = r.won ? '#c9a4ff' : '#3d4466'; g.lineWidth = 3; rr(40, 300, 520, 560, 24); g.stroke();
    if (r.won) {
      txt('CHAIN COMPLETE!', LW / 2, 360, 40, '#c9a4ff', 'center', 900);
      txt('You were link #' + r.link + ' · ' + r.time.toFixed(1) + 's', LW / 2, 406, 20, '#aab2dd', 'center', 600);
      var names = S.chain.map(function (c) { return c; }).concat([{ name: 'YOU', color: YOU_COLOR }]);
      var gap = Math.min(130, 440 / Math.max(1, names.length - 1)), x0 = LW / 2 - gap * (names.length - 1) / 2;
      names.forEach(function (c, i) {
        var x = x0 + i * gap;
        if (i < names.length - 1) { g.strokeStyle = '#555c80'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 30, 490); g.lineTo(x + gap - 30, 490); g.stroke(); }
        g.fillStyle = c.color; g.beginPath(); g.arc(x, 490, 26, 0, 7); g.fill();
        g.fillStyle = '#0d0f1a'; g.beginPath(); g.arc(x - 8, 485, 4, 0, 7); g.arc(x + 8, 485, 4, 0, 7); g.fill();
        txt(c.name, x, 540, 15, '#ffffff', 'center', 800);
      });
      txt('In the real game: flair, today\'s stats,', LW / 2, 610, 17, '#8d96c2', 'center', 600);
      txt('and your ghost helps the next player.', LW / 2, 636, 17, '#8d96c2', 'center', 600);
      button('Play again', 90, 690, 420, 64, S.mode === 'join' ? startJoin : startFresh, true);
      button('Menu', 90, 772, 420, 60, function () { S.screen = 'menu'; }, false);
    } else if (S.mode === 'fresh') {
      txt('Run saved as ghost #' + r.link, LW / 2, 370, 34, r.ghost.color, 'center', 900);
      var tip = r.link === 1 ? 'Did you hold Plate 1? Now play link 2 with it.'
        : r.link === 2 ? 'Did you hold Plate 2? Now play link 3.' : 'Add another link, or redo this one.';
      txt(tip, LW / 2, 420, 18, '#aab2dd', 'center', 600);
      txt('Ghosts replay your exact inputs, so timing matters.', LW / 2, 452, 16, '#8d96c2', 'center', 600);
      if (r.link < 5) button('Play link #' + (r.link + 1), 90, 520, 420, 66, function () { S.chain.push(r.ghost); startRun(); }, true);
      button('Redo link #' + r.link, 90, 610, 420, 60, startRun, false);
      button('Start over', 90, 690, 420, 60, startFresh, false);
      button('Menu', 90, 770, 420, 60, function () { S.screen = 'menu'; }, false);
    } else {
      txt('Out of time', LW / 2, 370, 40, '#ff5470', 'center', 900);
      txt('Watch the "leaves in" badges: go before they step off.', LW / 2, 425, 17, '#aab2dd', 'center', 600);
      button('Try again', 90, 560, 420, 66, startJoin, true);
      button('Menu', 90, 650, 420, 60, function () { S.screen = 'menu'; }, false);
    }
  }

  // ---- loop --------------------------------------------------------------
  function resize() {
    var vw = innerWidth, vh = innerHeight, dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    view.s = Math.min(vw / LW, vh / LH); view.ox = (vw - LW * view.s) / 2; view.oy = (vh - LH * view.s) / 2; view.dpr = dpr;
  }
  addEventListener('resize', resize); resize();

  var last = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (S.screen === 'countdown') { S.countdown -= dt; if (S.countdown <= 0) { S.screen = 'run'; acc = 0; } }
    if (S.screen === 'run') {
      acc += dt;
      var kd = keyDir(); S.dir = kd || pointerDir();
      while (acc >= DT && S.screen === 'run') { acc -= DT; step(); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0d0f1a'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(view.s * view.dpr, 0, 0, view.s * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
    buttons = [];
    var t = now / 1000;
    if (S.screen === 'menu') drawMenu(t);
    else if (S.screen === 'result') drawResult(t);
    else drawPlay(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // exposed for tests
  S.simulate = simulate; S.botController = botController; S.STRANGERS = STRANGERS; S.RUN_TICKS = RUN_TICKS;
  S.step = step; S.startRun = startRun;
})();
