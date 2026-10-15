/* ===== 윷놀이 : 윷을 던져 말을 먼저 한 바퀴 돌려요 =====
   판은 바깥 20칸 + 지름길 9칸(가운데 포함). 윷·모, 잡기는 한 번 더. 같은 편 말은 업어서 함께 가요. */
(function () {
  const q = (s, r) => (r || document).querySelector(s);
  const NAMES = ['', '도', '개', '걸', '윷', '모'];
  const PROB = [0, 4 / 16, 6 / 16, 4 / 16, 1 / 16, 1 / 16];
  const WAIT = -1, FIN = 99;
  const SIZE = 320;

  /* ---------- 판 좌표 ---------- */
  const PT = {};
  (function () {
    const a = 30, b = 290, s = (b - a) / 5;
    PT[0] = [b, b];
    for (let i = 1; i <= 5; i++) PT[i] = [b, b - i * s];
    for (let i = 6; i <= 10; i++) PT[i] = [b - (i - 5) * s, a];
    for (let i = 11; i <= 15; i++) PT[i] = [a, a + (i - 10) * s];
    for (let i = 16; i <= 19; i++) PT[i] = [a + (i - 15) * s, b];
    const c = (a + b) / 2, d1 = (b - c) / 3;
    PT[22] = [c, c];
    PT[20] = [b - d1 * 1, a + d1 * 1]; PT[21] = [b - d1 * 2, a + d1 * 2];
    PT[23] = [a + d1 * 2, b - d1 * 2]; PT[24] = [a + d1, b - d1];
    PT[25] = [a + d1, a + d1]; PT[26] = [a + d1 * 2, a + d1 * 2];
    PT[27] = [b - d1 * 2, b - d1 * 2]; PT[28] = [b - d1, b - d1];
  })();
  const CORNERS = [0, 5, 10, 15, 22];

  /* ---------- 길 찾기 ---------- */
  /* 한 칸 앞: first는 이번 이동의 첫 걸음인지. prev는 직전 칸 */
  function stepOnce(n, prev, first) {
    if (n === WAIT) return 1;
    if (n === 5 && first) return 20;
    if (n === 10 && first) return 25;
    if (n === 22) return prev === 21 ? 23 : 27;
    if (n === 20) return 21;
    if (n === 21) return 22;
    if (n === 23) return 24;
    if (n === 24) return 15;
    if (n === 25) return 26;
    if (n === 26) return 22;
    if (n === 27) return 28;
    if (n === 28) return FIN;
    if (n === 19) return FIN;
    return n + 1;
  }
  /* k칸 간 길(지나간 칸들). 끝이 FIN이면 완주 */
  function route(from, k) {
    const path = [];
    let n = from, prev = -2, first = true;
    for (let i = 0; i < k; i++) {
      const nx = stepOnce(n, prev, first);
      first = false; prev = n; n = nx;
      path.push(n);
      if (n === FIN) break;
    }
    return path;
  }
  const dest = (from, k) => route(from, k).slice(-1)[0];
  /* 완주까지 남은 걸음(가장 빠른 길 기준) */
  function rem(n) {
    if (n === FIN) return 0;
    if (n === WAIT) return 11;
    if (n <= 4) return 5 - n + 6;
    if (n === 5 || n === 10) return 6;
    if (n <= 9) return 10 - n + 6;
    if (n >= 11 && n <= 19) return 20 - n;
    return { 20: 5, 21: 4, 22: 3, 23: 7, 24: 6, 25: 5, 26: 4, 27: 2, 28: 1 }[n];
  }

  /* ---------- 상태 ---------- */
  let yc = { mode: 'ai', level: 'normal', first: 'me', pieces: 3 };
  try { Object.assign(yc, JSON.parse(store.get('cg.yut.cfg') || '{}')); } catch (e) { /* 기본값 */ }
  let G = null, gtok = 0, throwing = false;
  const isRed = p => p === 1;
  const aiP = () => yc.first === 'cpu' ? 1 : 2;
  const colorName = p => p === 1 ? '빨강' : '파랑';
  const names = () => yc.mode === 'ai' ? (aiP() === 1 ? ['', '컴퓨터', '나'] : ['', '나', '컴퓨터']) : ['', '빨강', '파랑'];

  function reset() {
    gtok++; throwing = false;
    const n = yc.pieces | 0 || 3;
    G = {
      pos: [null, new Array(n).fill(WAIT), new Array(n).fill(WAIT)],
      turn: 1,
      queue: [], pending: 1, chip: 0, pre: null, busy: false, winner: 0, throws: 0, last: null, say: '', hide: false, flash: null
    };
  }

  /* ---------- 규칙 ---------- */
  const unitsOf = (pos, p) => {
    const m = {}, out = [];
    pos[p].forEach((n, i) => { if (n !== FIN && n !== WAIT) (m[n] = m[n] || []).push(i); });
    Object.keys(m).forEach(k => out.push({ node: +k, idx: m[k] }));
    const w = []; pos[p].forEach((n, i) => { if (n === WAIT) w.push(i); });
    if (w.length) out.push({ node: WAIT, idx: [w[0]] });
    return out;
  };
  /* 이동을 가짜로 적용해 결과를 돌려줘요(AI와 미리보기용) */
  function applyTo(pos, p, unit, k) {
    const pth = route(unit.node, k), d = pth[pth.length - 1];
    const np = [null, pos[1].slice(), pos[2].slice()];
    let cap = 0;
    if (d === FIN) unit.idx.forEach(i => { np[p][i] = FIN; });
    else {
      unit.idx.forEach(i => { np[p][i] = d; });
      const o = 3 - p;
      np[o].forEach((n, i) => { if (n === d) { np[o][i] = WAIT; cap++; } });
    }
    return { pos: np, path: pth, d, cap, fin: d === FIN ? unit.idx.length : 0 };
  }
  const won = (pos, p) => pos[p].every(n => n === FIN);

  /* ---------- 던지기 ---------- */
  function rollSticks() {
    const f = [0, 0, 0, 0].map(() => Math.random() < 0.5);
    const c = f.filter(Boolean).length;
    return { f, v: c === 0 ? 5 : c };
  }

  /* ---------- 그리기: 판 ---------- */
  const NS_ = 'http://www.w3.org/2000/svg';
  function drawBg() {
    const g = q('#ybg'); let s = '';
    s += '<rect x="6" y="6" width="308" height="308" rx="18" fill="var(--board)" />';
    const L = (a, b, w) => '<line x1="' + PT[a][0] + '" y1="' + PT[a][1] + '" x2="' + PT[b][0] + '" y2="' + PT[b][1] + '" stroke="var(--line-d, #6B665C)" stroke-width="' + (w || 3) + '" stroke-linecap="round"/>';
    s += '<g opacity="0.85">';
    s += '<path d="M290 290 L290 30 L30 30 L30 290 Z" fill="none" stroke="#8A8478" stroke-width="3" stroke-linejoin="round"/>';
    s += L(5, 22) + L(22, 15) + L(10, 22) + L(22, 0);
    s += '</g>';
    for (let n = 0; n <= 28; n++) {
      if (!PT[n]) continue;
      const big = n === 0 || n === 5 || n === 10 || n === 15, mid = n === 22;
      const r = mid ? 12 : big ? 10.5 : 6.5;
      s += '<circle cx="' + PT[n][0] + '" cy="' + PT[n][1] + '" r="' + r + '" fill="' + (big || mid ? '#2B2926' : '#37342F') + '" stroke="#8A8478" stroke-width="' + (big || mid ? 2.4 : 1.6) + '"/>';
    }
    s += '<text x="262" y="311" text-anchor="end" font-size="9.5" font-weight="700" fill="#B9B3A6">출발·도착</text>';
    g.innerHTML = s;
  }
  function pieceSvg(p, n, cx, cy, extra) {
    const gid = p === 1 ? 'gYR' : 'gYB', ink = p === 1 ? 'var(--red-ink)' : 'var(--blue-ink)';
    let s = '<g class="ypc' + (extra && extra.can ? ' can' : '') + (extra && extra.sel ? ' sel' : '') + '" data-n="' + n + '" data-p="' + p + '" transform="translate(' + cx + ' ' + cy + ')">';
    s += '<ellipse cx="1.4" cy="4.6" rx="11" ry="5" fill="#000" opacity="0.32"/>';
    s += '<circle r="12.5" fill="url(#' + gid + ')" stroke="' + ink + '" stroke-width="1.4"/>';
    s += '<ellipse cx="-4" cy="-5" rx="4.4" ry="2.4" transform="rotate(-32 -4 -5)" fill="#fff" opacity="0.7"/>';
    if (extra && extra.count > 1) s += '<circle cx="10" cy="-10" r="7.6" fill="#FAF9F5" stroke="#1F1E1B" stroke-width="1"/><text x="10" y="-6.6" text-anchor="middle" font-size="10.5" font-weight="800" fill="#1F1E1B">' + extra.count + '</text>';
    return s + '</g>';
  }
  function dynMarkup() {
    let s = '';
    const myTurn = canAct();
    const showPre = G.pre && G.pre.d !== undefined && G.pre.d !== FIN ? G.pre.d : null;
    /* 미리보기 도착점 */
    if (G.pre && G.pre.d !== undefined) {
      if (G.pre.d === FIN) s += '<circle class="yhit" cx="' + PT[0][0] + '" cy="' + PT[0][1] + '" r="16" data-d="F"/>';
      else s += '<circle class="yhit" cx="' + PT[G.pre.d][0] + '" cy="' + PT[G.pre.d][1] + '" r="16" data-d="' + G.pre.d + '"/>';
    }
    const done = [];
    for (let p = 1; p <= 2; p++) {
      const m = {};
      G.pos[p].forEach((n, i) => { if (n !== FIN && n !== WAIT) m[n] = (m[n] || 0) + 1; });
      Object.keys(m).forEach(k => {
        const n = +k, pt = PT[n];
        const sel = G.pre && G.pre.p === p && G.pre.node === n;
        done.push(pieceSvg(p, n, pt[0], pt[1], { count: m[k], can: myTurn && G.turn === p, sel }));
      });
    }
    return s + done.join('');
  }

  /* ---------- 그리기: 던지기 판 ---------- */
  function sticksMarkup(f) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const flat = f ? f[i] : true, x = 12 + i * 44;
      s += '<g class="ystick' + (flat ? ' flat' : ' round') + '" transform="translate(' + x + ' 6)"><rect width="32" height="74" rx="16"/>' +
        (flat ? '<path d="M7 24h18M7 38h18M7 52h18" stroke="#8A6A3A" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>' : '<rect x="9" y="8" width="5" height="58" rx="2.5" fill="#fff" opacity="0.22"/>') + '</g>';
    }
    return s;
  }
  function canAct() {
    if (!G || G.winner || G.busy || throwing) return false;
    if (yc.mode === 'ai' && G.turn === aiP()) return false;
    return true;
  }
  function sayText() {
    if (G.winner) return G.winner === 3 ? '무승부예요.' : colorName(G.winner) + ' 승리예요.';
    if (yc.mode === 'ai' && G.turn === aiP()) return '컴퓨터가 생각하고 있어요.';
    const who = yc.mode === 'local' ? colorName(G.turn) + ' 차례예요. ' : '내 차례예요. ';
    if (G.pending > 0) return who + '윷을 던져 주세요.';
    if (G.pre) return who + '도착할 곳을 눌러 확정해요.';
    return who + '쓸 윷을 고르고 말을 눌러 주세요.';
  }
  function renderStatus() {
    const nm = names();
    for (let p = 1; p <= 2; p++) {
      const fin = G.pos[p].filter(n => n === FIN).length, wait = G.pos[p].filter(n => n === WAIT).length;
      q('#ypn' + p).textContent = nm[p];
      q('#yps' + p).textContent = (G.winner === p ? '승리' : (!G.winner && G.turn === p ? '차례 · ' : '')) + '대기 ' + wait + ' · 완주 ' + fin + '/' + G.pos[p].length;
      q('#ypl' + p).classList.toggle('on', !G.winner && G.turn === p);
      const tray = q('#ytray' + p);
      tray.textContent = '대기 말 ' + wait + '개';
      tray.disabled = !(canAct() && G.turn === p && G.queue.length && wait > 0 && G.pending === 0);
      tray.classList.toggle('sel', !!(G.pre && G.pre.p === p && G.pre.node === WAIT));
    }
    q('#ysay').textContent = sayText();
    const btn = q('#ythrow');
    btn.disabled = !(canAct() && G.pending > 0);
    btn.textContent = G.pending > 1 ? '한 번 더 던지기' : '윷 던지기';
    q('#ycount').textContent = G.throws + '번 던짐';
    /* 윷 결과 칩 */
    q('#ychips').innerHTML = G.queue.length ? G.queue.map((v, i) =>
      '<button type="button" class="ychip' + (i === G.chip ? ' on' : '') + '" data-i="' + i + '"' + (canAct() && G.pending === 0 ? '' : ' disabled') + '>' + NAMES[v] + '</button>').join('') :
      '<span class="ynone">' + (G.last ? '' : '윷을 던지면 결과가 여기에 쌓여요') + '</span>';
    q('#ylast').textContent = G.last ? NAMES[G.last] + '!' : '';
    const r = q('#yresult');
    if (G.winner && !G.busy && !G.hide) {
      r.hidden = false;
      const t = q('#yrtitle');
      let label;
      if (G.winner === 3) label = '무승부';
      else if (yc.mode === 'ai') label = G.winner !== aiP() ? '승리' : '패배';
      else label = colorName(G.winner) + ' 승리';
      t.textContent = label; t.className = 'rtitle ' + (G.winner === 1 ? 'wr' : 'wbl');
      q('#yrsub').textContent = G.throws + '번 던져서 끝났어요.';
    } else r.hidden = true;
  }
  function render() {
    q('#ydyn').innerHTML = dynMarkup();
    renderStatus();
  }

  /* ---------- 흐름 ---------- */
  function startTurn(p) {
    G.turn = p; G.queue = []; G.pending = 1; G.chip = 0; G.pre = null; G.last = null;
  }
  function endTurn() { startTurn(3 - G.turn); render(); maybeAI(); }
  function afterMove() {
    if (won(G.pos, G.turn)) { G.winner = G.turn; G.busy = false; render(); setTimeout(() => FX.win(), 150); return; }
    if (G.pending > 0) { render(); maybeAI(); return; }
    if (G.queue.length) { G.chip = 0; render(); maybeAI(); return; }
    endTurn();
  }
  function doThrow() {
    if (!G || G.winner || G.busy || throwing || G.pending <= 0) return;
    throwing = true; G.pre = null;
    const tk = gtok, r = rollSticks();
    audio(); bgmSync();
    const box = q('#ysticks');
    FX.drop();
    let k = 0;
    const iv = setInterval(() => {
      if (tk !== gtok) { clearInterval(iv); return; }
      k++;
      box.innerHTML = sticksMarkup([0, 0, 0, 0].map(() => Math.random() < 0.5));
      if (k < 7 && !reduceMotion) { if (k % 2) FX.snap(); return; }
      clearInterval(iv);
      box.innerHTML = sticksMarkup(r.f);
      throwing = false;
      G.pending--; G.throws++; G.queue.push(r.v); G.last = r.v;
      if (r.v >= 4) { G.pending++; FX.hop(r.v === 5 ? 6 : 4); haptic('win'); } else FX.pick();
      G.chip = 0;
      render(); maybeAI();
    }, reduceMotion ? 1 : 80);
  }
  function preview(p, node) {
    const k = G.queue[G.chip];
    if (!k) return;
    const u = unitsOf(G.pos, p).find(x => x.node === node);
    if (!u) return;
    if (G.pre && G.pre.p === p && G.pre.node === node && G.pre.chip === G.chip) { commit(G.pre); return; }
    const d = dest(node, k);
    G.pre = { p, node, k, chip: G.chip, d };
    FX.pick(); render();
  }
  function commit(pre) {
    if (!pre || G.busy) return;
    const p = pre.p, tk = gtok;
    const unit = unitsOf(G.pos, p).find(x => x.node === pre.node);
    if (!unit) { G.pre = null; render(); return; }
    const k = G.queue[pre.chip];
    G.busy = true; G.pre = null;
    G.queue.splice(pre.chip, 1); G.chip = 0;
    const res = applyTo(G.pos, p, unit, k);
    const path = res.path.filter(n => n !== FIN);
    let i = 0;
    const step = () => {
      if (tk !== gtok) return;
      if (i < path.length) {
        unit.idx.forEach(j => { G.pos[p][j] = path[i]; });
        FX.hop(i);
        i++; render();
        setTimeout(step, reduceMotion ? 1 : 170);
        return;
      }
      /* 도착 */
      G.pos = res.pos;
      if (res.cap) { G.pending += 1; FX.bad(); haptic('bad'); G.say = '잡았어요! 한 번 더'; }
      else if (res.fin) { FX.snap(); }
      else FX.drop();
      G.busy = false;
      afterMove();
    };
    if (!path.length) { G.pos = res.pos; G.busy = false; afterMove(); return; }
    /* 대기 말이 처음 판에 놓일 때: 출발 칸 가까이에서 시작 */
    step();
  }

  /* ---------- 컴퓨터 ---------- */
  function riskAt(pos, p, node, count) {
    if (node === FIN || node === WAIT) return 0;
    const o = 3 - p; let risk = 0;
    const seen = {};
    unitsOf(pos, o).forEach(u => {
      for (let t = 1; t <= 5; t++) if (dest(u.node, t) === node) risk += PROB[t];
    });
    return Math.min(1, risk) * count;
  }
  function evalMove(pos, p, unit, k, lvl) {
    const res = applyTo(pos, p, unit, k);
    let s = 0;
    const before = rem(unit.node), after = rem(res.d);
    s += (before - after) * 2.2 * unit.idx.length;
    s += res.cap * 55 * 1;
    s += res.fin * 34;
    if (res.d === 5 || res.d === 10) s += 5;
    if (res.d === 22) s += 7;
    if (unit.node === WAIT) s += 2;
    const stacked = res.d !== FIN && res.pos[p].filter(n => n === res.d).length;
    if (stacked > 1 && unit.node !== res.d) s += 4;
    const rw = lvl === 'hard' ? 22 : 11;
    if (res.d !== FIN) s -= riskAt(res.pos, p, res.d, stacked) * rw;
    /* 떠난 자리에 남은 말의 위험 */
    pos[p].forEach((n, i) => { if (n !== FIN && n !== WAIT && !unit.idx.includes(i) && n === unit.node) s -= riskAt(res.pos, p, n, 1) * rw; });
    return { s, res };
  }
  function pickAI() {
    const p = G.turn, units = unitsOf(G.pos, p);
    const all = [];
    G.queue.forEach((k, ci) => units.forEach(u => {
      const e = evalMove(G.pos, p, u, k, yc.level);
      all.push({ ci, u, s: e.s });
    }));
    if (!all.length) return null;
    if (yc.level === 'easy' && Math.random() < 0.5) return all[(Math.random() * all.length) | 0];
    if (yc.level === 'normal' && Math.random() < 0.1) return all[(Math.random() * all.length) | 0];
    all.sort((a, b) => b.s - a.s);
    return all[0];
  }
  function maybeAI() {
    if (yc.mode !== 'ai' || G.winner || G.busy || throwing || G.turn !== aiP()) return;
    const tk = gtok;
    setTimeout(() => {
      if (tk !== gtok || G.winner || G.busy || throwing || G.turn !== aiP()) return;
      if (G.pending > 0) { doThrow(); return; }
      const m = pickAI();
      if (!m) { endTurn(); return; }
      G.chip = m.ci;
      const node = m.u.node;
      G.pre = { p: G.turn, node, k: G.queue[m.ci], chip: m.ci, d: dest(node, G.queue[m.ci]) };
      render();
      setTimeout(() => { if (tk === gtok && !G.winner) commit(G.pre); }, reduceMotion ? 1 : 420);
    }, reduceMotion ? 1 : 650);
  }

  /* ---------- 입력 ---------- */
  q('#yboard').addEventListener('click', e => {
    audio(); bgmSync();
    if (!canAct() || G.pending > 0 || !G.queue.length) return;
    const hit = e.target.closest('[data-d]');
    if (hit && G.pre) { commit(G.pre); return; }
    const pc = e.target.closest('.ypc');
    if (!pc) return;
    const p = +pc.dataset.p, n = +pc.dataset.n;
    if (p !== G.turn) return;
    preview(p, n);
  });
  [1, 2].forEach(p => q('#ytray' + p).addEventListener('click', () => {
    audio(); bgmSync();
    if (!canAct() || G.turn !== p || G.pending > 0 || !G.queue.length) return;
    preview(p, WAIT);
  }));
  q('#ychips').addEventListener('click', e => {
    const b = e.target.closest('.ychip'); if (!b || !canAct() || G.pending > 0) return;
    G.chip = +b.dataset.i; G.pre = null; FX.pick(); render();
  });
  q('#ythrow').addEventListener('click', doThrow);

  /* ---------- 설정 ---------- */
  function setDef() {
    return [
      { key: 'mode', label: '상대', opts: [['ai', '컴퓨터'], ['local', '둘이서']] },
      { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: () => yc.mode === 'ai' },
      { key: 'first', label: '선공', opts: [['me', '나(빨강)'], ['cpu', '컴퓨터(빨강)']], when: () => yc.mode === 'ai' },
      { key: 'pieces', label: '말 개수', opts: [[2, '2개'], [3, '3개'], [4, '4개']] },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#ysettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : yc[s.key];
      return '<div class="set"><span class="setlabel" id="ysl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="ysl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }
  q('#ysettings').addEventListener('click', e => {
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
    yc[b.dataset.k] = b.dataset.k === 'pieces' ? +b.dataset.v : b.dataset.v;
    store.set('cg.yut.cfg', JSON.stringify(yc));
    renderSet(); newGame();
  });
  function newGame() { reset(); q('#ysticks').innerHTML = sticksMarkup(null); render(); maybeAI(); }
  q('#ybk').addEventListener('click', () => show('hub'));
  q('#yagain').addEventListener('click', newGame);
  q('#yrAgain').addEventListener('click', newGame);
  q('#yrView').addEventListener('click', () => { G.hide = true; renderStatus(); });

  window.yutSettings = function () { renderSet(); };
  window.yutEnter = function () { renderSet(); render(); maybeAI(); };
  window.yutLeave = function () { gtok++; throwing = false; if (G) G.busy = false; };
  window.__yut = {
    get g() { return G; }, get cfg() { return yc; }, route, dest, rem, stepOnce, unitsOf, applyTo, PT,
    set: (o) => { Object.assign(yc, o); }, newGame, doThrow, force: (v) => { rollSticks = () => ({ f: [0, 1, 2, 3].map(i => i < (v === 5 ? 0 : v)), v }); }
  };

  drawBg(); reset();
  q('#ysticks').innerHTML = sticksMarkup(null);
})();
