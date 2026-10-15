/* ===== 알까기 : 내 돌을 튕겨 상대 돌을 판 밖으로 밀어내요 =====
   돌은 같은 크기·같은 무게의 원. 당겼다 놓는 세기와 방향으로 날아가고, 부딪치면 속도를 주고받아요.
   중심이 판 밖으로 나간 돌은 떨어져요. 상대 돌을 모두 떨어뜨리면 이겨요. */
(function () {
  const q = (s, r) => (r || document).querySelector(s);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LO = 34, HI = 286, RAD = 15, Y_BOT = 236, Y_TOP = 84;
  const FRIC = 0.99096, STOPV = 0.05, REST = 0.9;       /* 반 걸음마다 마찰 */
  const PULL = 84;                                       /* 이만큼 당기면 최대 세기 */
  const V_MIN = 0.9, V_RNG = 5.8, DIST_K = 55.3;         /* 날아가는 거리 ≈ 55.3 × 처음 속도 */
  const D = p => DIST_K * (V_MIN + V_RNG * p);

  let ac = { mode: 'ai', level: 'normal', first: 'me', stones: 5 };
  try { Object.assign(ac, JSON.parse(store.get('cg.algakki.cfg') || '{}')); } catch (e) { /* 기본값 */ }

  let G = null, gtok = 0, raf = 0, lastTs = 0, acc = 0, drag = null, lastHit = 0;
  const aiOn = () => ac.mode === 'ai';
  const names = () => aiOn() ? ['', '나', '컴퓨터'] : ['', '빨강', '파랑'];
  const colorName = p => p === 1 ? '빨강' : '파랑';

  /* ---------- 물리 ---------- */
  function mkStones(n) {
    const a = []; let id = 0;
    [1, 2].forEach(p => {
      for (let i = 0; i < n; i++) {
        a.push({ id: id++, p, x: LO + (HI - LO) * (i + 0.5) / n, y: p === 1 ? Y_BOT : Y_TOP, vx: 0, vy: 0, out: false, gone: false, t: 0 });
      }
    });
    return a;
  }
  const cloneW = A => A.map(s => ({ id: s.id, p: s.p, x: s.x, y: s.y, vx: s.vx, vy: s.vy, out: s.out, gone: s.gone, t: s.t }));
  /* 한 걸음(반 걸음 두 번). ev가 있으면 부딪힘·떨어짐을 기록 */
  function step(A, ev) {
    const n = A.length;
    for (let h = 0; h < 2; h++) {
      for (let i = 0; i < n; i++) { const s = A[i]; if (s.out || s.gone) continue; s.x += s.vx * 0.5; s.y += s.vy * 0.5; }
      for (let i = 0; i < n; i++) {
        const a = A[i]; if (a.out || a.gone) continue;
        for (let j = i + 1; j < n; j++) {
          const b = A[j]; if (b.out || b.gone) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= 4 * RAD * RAD || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 2 * RAD - d;
          a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          const vr = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (vr > 0) {
            const j2 = (1 + REST) * vr / 2;
            a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
            if (ev) ev.hits.push(vr);
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const s = A[i]; if (s.out || s.gone) continue;
        if (s.x < LO || s.x > HI || s.y < LO || s.y > HI) { s.out = true; s.t = 0; if (ev) ev.outs.push(s); }
      }
      for (let i = 0; i < n; i++) { const s = A[i]; if (s.out || s.gone) continue; s.vx *= FRIC; s.vy *= FRIC; }
    }
    for (let i = 0; i < n; i++) {
      const s = A[i]; if (s.out || s.gone) continue;
      if (s.vx * s.vx + s.vy * s.vy < STOPV * STOPV) { s.vx = 0; s.vy = 0; }
    }
  }
  const settled = A => A.every(s => s.out || s.gone || (s.vx === 0 && s.vy === 0));
  const alive = (A, p) => A.filter(s => !s.out && !s.gone && (p === undefined || s.p === p));
  function runOut(A, maxSteps) { let k = 0; while (!settled(A) && k++ < maxSteps) step(A, null); return A; }
  /* 방향 d(단위 벡터)로 직선으로 갈 때 처음 닿는 거리(중심끼리 2R). 없으면 null */
  function rayHit(A, s, d) {
    let best = null;
    alive(A).forEach(o => {
      if (o.id === s.id) return;
      const wx = o.x - s.x, wy = o.y - s.y, b = d.x * wx + d.y * wy, c = wx * wx + wy * wy - 4 * RAD * RAD;
      const disc = b * b - c; if (disc < 0) return;
      const t = b - Math.sqrt(disc); if (t > 0 && (best === null || t < best)) best = t;
    });
    return best;
  }

  /* ---------- 그리기 ---------- */
  function drawBg() {
    const span = HI - LO; let s = '';
    s += '<rect x="' + (LO - 10) + '" y="' + (LO - 10) + '" width="' + (span + 20) + '" height="' + (span + 20) + '" rx="10" fill="#000" opacity="0.18" transform="translate(0 5)"/>';
    s += '<rect x="' + (LO - 10) + '" y="' + (LO - 10) + '" width="' + (span + 20) + '" height="' + (span + 20) + '" rx="10" fill="url(#gAwood)" stroke="var(--wood-line)" stroke-width="2"/>';
    for (let k = 0; k < 9; k++) {
      const v = LO + span * k / 8;
      s += '<line x1="' + LO + '" y1="' + v + '" x2="' + HI + '" y2="' + v + '" class="oline"/><line x1="' + v + '" y1="' + LO + '" x2="' + v + '" y2="' + HI + '" class="oline"/>';
    }
    [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]].forEach(p => { s += '<circle cx="' + (LO + span * p[0] / 8) + '" cy="' + (LO + span * p[1] / 8) + '" r="2.6" class="ostar"/>'; });
    s += '<rect x="' + LO + '" y="' + LO + '" width="' + span + '" height="' + span + '" fill="none" stroke="var(--wood-line)" stroke-width="2.4"/>';
    q('#abg').innerHTML = s;
  }
  function buildStones() {
    q('#adyn').innerHTML = G.stones.map(s =>
      '<g class="astn p' + s.p + '" data-id="' + s.id + '"><ellipse cx="1.6" cy="5" rx="14" ry="6" fill="#000" opacity="0.3"/>' +
      '<circle r="' + RAD + '" fill="url(#gA' + (s.p === 1 ? 'R' : 'B') + ')" stroke="' + (s.p === 1 ? 'var(--red-ink)' : 'var(--blue-ink)') + '" stroke-width="1.6"/>' +
      '<ellipse cx="-4.8" cy="-6" rx="5.2" ry="2.9" transform="rotate(-32 -4.8 -6)" fill="#fff" opacity="0.65"/></g>').join('');
    G.els = {};
    q('#adyn').querySelectorAll('.astn').forEach(g => { G.els[g.dataset.id] = g; });
  }
  function paint() {
    G.stones.forEach(s => {
      const g = G.els[s.id]; if (!g) return;
      if (s.gone) { g.style.display = 'none'; return; }
      const k = s.out ? Math.max(0.15, 1 - s.t / 30) : 1;
      g.setAttribute('transform', 'translate(' + s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ') scale(' + k.toFixed(3) + ')');
      g.style.opacity = s.out ? Math.max(0, 1 - s.t / 28) : 1;
      g.style.display = '';
    });
  }
  function stoneById(id) { return G.stones.find(s => s.id === id); }
  function drawFx() {
    const l = q('#afx'); let s = '';
    if (G && !G.winner && !G.busy) {
      const sel = G.sel !== null ? stoneById(G.sel) : null;
      const ref = drag ? stoneById(drag.id) : sel;
      if (ref && !ref.out) s += '<circle class="asel" cx="' + ref.x + '" cy="' + ref.y + '" r="' + (RAD + 5) + '"/>';
      if (G.aim) s += aimMarkup(G.aim);
    }
    l.innerHTML = s;
  }
  function aimMarkup(a) {
    const st = stoneById(a.id); if (!st) return '';
    const len = Math.min(D(a.p), 340), hit = rayHit(G.stones, st, a.d);
    const L = hit === null ? len : Math.min(len, hit);
    const ex = st.x + a.d.x * L, ey = st.y + a.d.y * L;
    let s = '';
    if (a.pull) s += '<line class="aband" x1="' + st.x + '" y1="' + st.y + '" x2="' + (st.x - a.d.x * a.pull) + '" y2="' + (st.y - a.d.y * a.pull) + '"/>';
    s += '<line class="aguide" x1="' + st.x + '" y1="' + st.y + '" x2="' + ex + '" y2="' + ey + '"/>';
    if (hit !== null && hit <= len) s += '<circle class="ahit" cx="' + ex + '" cy="' + ey + '" r="' + RAD + '"/>';
    else s += '<circle class="aend" cx="' + ex + '" cy="' + ey + '" r="5"/>';
    return s;
  }

  /* ---------- 상태 ---------- */
  function canAct() { return !!G && !G.winner && !G.busy && !(aiOn() && G.turn === 2); }
  function sayText() {
    if (G.winner) return G.winner === 3 ? '무승부예요.' : (aiOn() ? (G.winner === 1 ? '이겼어요.' : '졌어요.') : colorName(G.winner) + ' 승리예요.');
    if (G.busy) return '';
    if (aiOn() && G.turn === 2) return '컴퓨터가 생각하고 있어요.';
    const who = aiOn() ? '내 차례예요. ' : colorName(G.turn) + ' 차례예요. ';
    if (G.sel !== null) return who + '보낼 곳을 눌러 주세요.';
    return who + '돌을 뒤로 당겼다 놓아 보세요.';
  }
  function renderStatus() {
    const nm = names();
    for (let p = 1; p <= 2; p++) {
      q('#apn' + p).textContent = nm[p];
      q('#aps' + p).textContent = (G.winner === p ? '승리 · ' : '') + '남은 돌 ' + alive(G.stones, p).length + '개';
      q('#apl' + p).classList.toggle('on', !G.winner && G.turn === p);
    }
    q('#asay').textContent = sayText();
    q('#acount').textContent = G.shots + '번 튕김';
    const r = q('#aresult');
    if (G.winner && !G.busy && !G.hide) {
      r.hidden = false;
      const t = q('#artitle'); let label;
      if (G.winner === 3) label = '무승부';
      else if (aiOn()) label = G.winner === 1 ? '승리' : '패배';
      else label = colorName(G.winner) + ' 승리';
      t.textContent = label; t.className = 'rtitle ' + (G.winner === 1 ? 'wr' : 'wbl');
      q('#arsub').textContent = G.shots + '번 튕겨서 끝났어요.';
    } else r.hidden = true;
  }
  function render() { paint(); drawFx(); renderStatus(); }

  /* ---------- 흐름 ---------- */
  function newGame() {
    gtok++; if (raf) { cancelAnimationFrame(raf); raf = 0; }
    drag = null;
    G = { stones: mkStones(ac.stones), turn: ac.mode === 'ai' && ac.first === 'cpu' ? 2 : 1, winner: 0, busy: false, sim: false, simSteps: 0, shots: 0, sel: null, aim: null, hide: false, els: {} };
    buildStones(); render(); maybeAI();
  }
  function hitFx(ev) {
    const now = performance.now();
    ev.hits.forEach(v => { if (now - lastHit > 70) { lastHit = now; if (v > 1.4) FX.drop(); else FX.snap(); } });
    ev.outs.forEach(s => { if (aiOn() ? s.p === 1 : false) FX.bad(); else { FX.drop(); haptic('bad'); } });
  }
  function shoot(st, d, p) {
    if (!canAct() && !(aiOn() && G.turn === 2 && !G.busy && !G.winner)) return;
    const v = V_MIN + V_RNG * p;
    st.vx = d.x * v; st.vy = d.y * v;
    G.busy = true; G.sim = true; G.simSteps = 0; G.shots++; G.sel = null; G.aim = null;
    FX.pick(); render(); kick();
  }
  function kick() { if (!raf) { lastTs = 0; acc = 0; raf = requestAnimationFrame(loop); } }
  function loop(ts) {
    raf = 0; if (!G) return;
    if (!lastTs) lastTs = ts;
    acc += Math.min(100, ts - lastTs); lastTs = ts;
    let n = 0;
    while (acc >= 16.7 && n < 6) {
      acc -= 16.7; n++;
      if (G.sim) {
        const ev = { hits: [], outs: [] };
        step(G.stones, ev); hitFx(ev); G.simSteps++;
        if (settled(G.stones) || G.simSteps > 1500) { G.sim = false; endShot(); }
      }
      fade();
    }
    paint();
    if (G.sim || G.stones.some(s => s.out && !s.gone)) raf = requestAnimationFrame(loop); else lastTs = 0;
  }
  function fade() {
    G.stones.forEach(s => {
      if (!s.out || s.gone) return;
      s.x += s.vx; s.y += s.vy; s.vx *= FRIC * FRIC; s.vy *= FRIC * FRIC;
      if (++s.t >= 30) s.gone = true;
    });
  }
  function endShot() {
    G.stones.forEach(s => { if (!s.out && !s.gone) { s.vx = 0; s.vy = 0; } });
    const a1 = alive(G.stones, 1).length, a2 = alive(G.stones, 2).length;
    G.busy = false;
    if (!a1 || !a2) {
      G.winner = !a1 && !a2 ? 3 : (a1 ? 1 : 2);
      render();
      const win = G.winner === 3 ? false : (aiOn() ? G.winner === 1 : true);
      setTimeout(() => { if (G.winner === 3) FX.bad(); else if (win) FX.win(); else FX.lose(); }, 200);
      return;
    }
    G.turn = 3 - G.turn;
    render(); maybeAI();
  }
  /* 화면을 떠날 때: 진행 중인 샷은 끝까지 계산해 두어요 */
  function finishNow() {
    if (!G || !G.sim) return;
    let k = 0; while (!settled(G.stones) && k++ < 1500) step(G.stones, null);
    G.sim = false; G.stones.forEach(s => { if (s.out) s.gone = true; });
    const a1 = alive(G.stones, 1).length, a2 = alive(G.stones, 2).length;
    G.busy = false;
    if (!a1 || !a2) G.winner = !a1 && !a2 ? 3 : (a1 ? 1 : 2); else G.turn = 3 - G.turn;
    G.stones.forEach(s => { if (!s.out && !s.gone) { s.vx = 0; s.vy = 0; } });
  }

  /* ---------- 컴퓨터 ---------- */
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / 0.7071; };
  function score(A, me) {
    let s = 0;
    A.forEach(x => { if (x.out) s += x.p === me ? -11 : 10; });
    const edge = x => Math.min(x.x - LO, HI - x.x, x.y - LO, HI - x.y);
    alive(A, me).forEach(x => { s += 0.025 * edge(x); });
    alive(A, 3 - me).forEach(x => { s -= 0.025 * edge(x); });
    return s;
  }
  function planAI() {
    const me = G.turn, mine = alive(G.stones, me), foes = alive(G.stones, 3 - me), all = [];
    mine.forEach(st => foes.forEach(t => {
      const base = Math.atan2(t.y - st.y, t.x - st.x);
      [0, -0.05, 0.05].forEach(off => [0.4, 0.6, 0.8, 1].forEach(p => {
        const ang = base + off, d = { x: Math.cos(ang), y: Math.sin(ang) };
        const W = cloneW(G.stones), me2 = W.find(z => z.id === st.id), v = V_MIN + V_RNG * p;
        me2.vx = d.x * v; me2.vy = d.y * v;
        runOut(W, 700);
        all.push({ id: st.id, d, p, s: score(W, me) });
      }));
    }));
    if (!all.length) return null;
    all.sort((a, b) => b.s - a.s);
    if (ac.level === 'easy' && Math.random() < 0.4) return all[(Math.random() * all.length) | 0];
    if (ac.level === 'normal') return all[Math.min(all.length - 1, (Math.random() * 3) | 0)];
    return all[0];
  }
  function maybeAI() {
    if (!aiOn() || !G || G.winner || G.busy || G.turn !== 2) return;
    const tk = gtok;
    setTimeout(() => {
      if (tk !== gtok || !G || G.winner || G.busy || G.turn !== 2) return;
      const m = planAI();
      if (!m) { G.turn = 1; render(); return; }
      const sg = ac.level === 'easy' ? 0.1 : ac.level === 'normal' ? 0.035 : 0.01;
      const sp = ac.level === 'easy' ? 0.22 : ac.level === 'normal' ? 0.08 : 0.025;
      const ang = Math.atan2(m.d.y, m.d.x) + gauss() * sg, p = Math.max(0.1, Math.min(1, m.p * (1 + gauss() * sp)));
      const d = { x: Math.cos(ang), y: Math.sin(ang) };
      G.aim = { id: m.id, d, p, pull: 0 }; drawFx();
      setTimeout(() => {
        if (tk !== gtok || !G || G.winner || G.busy || G.turn !== 2) return;
        const st = stoneById(m.id); if (!st || st.out) { G.aim = null; return; }
        shoot(st, d, p);
      }, reduceMotion ? 1 : 600);
    }, reduceMotion ? 1 : 750);
  }

  /* ---------- 입력: 당겼다 놓기 / 누르기 ---------- */
  const svg = q('#aboard');
  function ptOf(e) {
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const r = p.matrixTransform(m.inverse()); return { x: r.x, y: r.y };
  }
  function nearestOwn(pt, r) {
    let best = null, bd = r;
    alive(G.stones, G.turn).forEach(s => { const d = Math.hypot(s.x - pt.x, s.y - pt.y); if (d < bd) { bd = d; best = s; } });
    return best;
  }
  svg.addEventListener('pointerdown', e => {
    audio(); bgmSync();
    if (!canAct()) return;
    const pt = ptOf(e), st = nearestOwn(pt, 52);
    if (st) {
      drag = { id: st.id, sx: pt.x, sy: pt.y, moved: false, pid: e.pointerId };
      try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
      FX.pick(); e.preventDefault();
    } else if (G.sel !== null) {
      drag = { id: G.sel, sx: pt.x, sy: pt.y, moved: false, tapAim: true, pid: e.pointerId };
      e.preventDefault();
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid || drag.tapAim) return;
    const pt = ptOf(e), dx = pt.x - drag.sx, dy = pt.y - drag.sy, len = Math.hypot(dx, dy);
    if (len > 8) drag.moved = true;
    if (!drag.moved) return;
    const p = Math.min(1, len / PULL);
    G.aim = { id: drag.id, d: { x: -dx / len, y: -dy / len }, p, pull: Math.min(len, PULL * 1.4) };
    drawFx(); e.preventDefault();
  });
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.pid) return;
    const dr = drag; drag = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
    const st = stoneById(dr.id);
    if (cancel || !st || !canAct()) { G.aim = null; drawFx(); return; }
    if (dr.tapAim) {
      const pt = ptOf(e), dx = pt.x - st.x, dy = pt.y - st.y, dist = Math.hypot(dx, dy);
      if (dist < 24) { G.aim = null; drawFx(); return; }
      const need = dist * 1.5 + 30, p = Math.max(0.12, Math.min(1, (need / DIST_K - V_MIN) / V_RNG));
      shoot(st, { x: dx / dist, y: dy / dist }, p); return;
    }
    if (dr.moved && G.aim && G.aim.pull >= 14) { const a = G.aim; shoot(st, a.d, a.p); return; }
    /* 당기지 않고 눌렀다 뗌 → 돌 선택 */
    G.aim = null; G.sel = G.sel === dr.id ? null : dr.id; render();
  }
  svg.addEventListener('pointerup', e => endDrag(e, false));
  svg.addEventListener('pointercancel', e => endDrag(e, true));
  svg.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.pid && !drag.tapAim && G && !G.busy) { /* 놓침 → 취소 */ drag = null; G.aim = null; drawFx(); } });

  /* ---------- 설정 ---------- */
  function setDef() {
    return [
      { key: 'mode', label: '상대', opts: [['ai', '컴퓨터'], ['local', '둘이서']] },
      { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: () => ac.mode === 'ai' },
      { key: 'first', label: '선공', opts: [['me', '나'], ['cpu', '컴퓨터']], when: () => ac.mode === 'ai' },
      { key: 'stones', label: '돌 개수', opts: [[3, '3개'], [5, '5개'], [7, '7개']] },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#asettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : ac[s.key];
      return '<div class="set"><span class="setlabel" id="asl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="asl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }
  q('#asettings').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const def = setDef().find(s => s.key === b.dataset.k);
    if (def.g) {
      cfg[b.dataset.k] = b.dataset.v;
      store.set('cg.diamond.cfg', JSON.stringify(cfg));
      renderSet();
      if (b.dataset.k === 'sound' && b.dataset.v === 'on') FX.pick();
      else if (b.dataset.k === 'haptic' && b.dataset.v === 'on') haptic('pick');
      else if (b.dataset.k === 'bgm') bgmSync();
      return;
    }
    ac[b.dataset.k] = b.dataset.k === 'stones' ? +b.dataset.v : b.dataset.v;
    store.set('cg.algakki.cfg', JSON.stringify(ac));
    renderSet(); newGame();
  });
  q('#abk').addEventListener('click', () => show('hub'));
  q('#aagain').addEventListener('click', newGame);
  q('#arAgain').addEventListener('click', newGame);
  q('#arView').addEventListener('click', () => { G.hide = true; renderStatus(); });

  PROGRESS.algakki = () => !!G && !G.winner && G.shots > 0;
  window.algakkiSettings = function () { renderSet(); };
  window.algakkiEnter = function () { renderSet(); render(); maybeAI(); };
  window.algakkiLeave = function () { gtok++; drag = null; if (G) { finishNow(); G.aim = null; } };
  window.__alg = {
    get g() { return G; }, get cfg() { return ac; }, step, runOut, cloneW, alive, settled, mkStones, D, newGame, shoot,
    set: o => { Object.assign(ac, o); }, stoneById
  };

  drawBg(); newGame();
})();
