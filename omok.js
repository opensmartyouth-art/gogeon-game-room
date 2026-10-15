/* ===== 오목 (자유룰, 15x15) : 컴퓨터 / 둘이서 / 온라인 ===== */
(function () {
  const NN = 15, CELL = 20, OFF = 20, R = 8.7;
  const DIR4 = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const px = i => OFF + CELL * i;
  const q = (s, r) => (r || document).querySelector(s);

  /* ---------- 상태 ---------- */
  let oc = { mode: 'ai', level: 'normal', first: 'me' };
  try { Object.assign(oc, JSON.parse(store.get('cg.omok.cfg') || '{}')); } catch (e) { /* 기본값 */ }
  let wantOnlineO = false;
  if (oc.mode === 'online') { wantOnlineO = true; oc.mode = 'ai'; }
  const G = {};
  let gtok = 0;
  const O = { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, seat: 0, sw: 0, oppOn: false, err: '', busy: false, pending: null };
  const isOn = () => oc.mode === 'online';
  const aiP = () => oc.first === 'cpu' ? 1 : 2;

  function reset() {
    gtok++;
    G.b = new Int8Array(NN * NN);
    G.turn = 1; G.moves = 0; G.last = null; G.winner = 0; G.win = [];
    G.hist = []; G.busy = false; G.think = false; G.ghost = null; G.kb = null; G.fx = null;
    G.note = ''; G.hideResult = false; G.confirmNew = false;
    if (G.n === undefined) G.n = 0;
  }
  G.n = 0;
  const myColor = () => O.seat === 0 ? 0 : (O.isHost ? (O.sw ? 2 : 1) : (O.sw ? 1 : 2));
  const humanTurn = () => {
    if (G.winner || G.busy) return false;
    if (isOn()) return O.seat > 0 && O.guestIn() && G.turn === myColor();
    if (oc.mode === 'ai') return G.turn !== aiP();
    return true;
  };
  O.guestIn = () => O.isHost ? !!(O.guest && O.guest.open) : !!(O.conn && O.conn.open);
  const colorName = p => p === 1 ? '흑' : '백';
  const names = () => {
    if (oc.mode === 'ai') return aiP() === 1 ? ['', '컴퓨터', '나'] : ['', '나', '컴퓨터'];
    if (isOn() && O.seat > 0) return myColor() === 1 ? ['', '나', '상대'] : ['', '상대', '나'];
    return ['', '흑', '백'];
  };
  const iWon = w => oc.mode === 'ai' ? w !== aiP() : (isOn() && O.seat > 0 ? w === myColor() : true);

  /* ---------- 승리 판정 ---------- */
  function winCells(b, i, p) {
    const x = i % NN, y = (i / NN) | 0;
    for (const [dx, dy] of DIR4) {
      const line = [i];
      for (const sgn of [1, -1]) {
        let k = 1;
        for (;;) {
          const xx = x + sgn * k * dx, yy = y + sgn * k * dy;
          if (xx < 0 || yy < 0 || xx >= NN || yy >= NN || b[yy * NN + xx] !== p) break;
          line.push(yy * NN + xx); k++;
        }
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  /* ---------- 컴퓨터 ---------- */
  const WV = [0, 1, 12, 130, 2400, 1e6];
  function lineScore(b, x, y, p) {
    let s = 0;
    for (const [dx, dy] of DIR4) {
      for (let k = -4; k <= 0; k++) {
        let c = 0, ok = true;
        for (let j = 0; j < 5; j++) {
          const xx = x + (k + j) * dx, yy = y + (k + j) * dy;
          if (xx < 0 || yy < 0 || xx >= NN || yy >= NN) { ok = false; break; }
          if (xx === x && yy === y) c++;
          else {
            const v = b[yy * NN + xx];
            if (v === p) c++;
            else if (v !== 0) { ok = false; break; }
          }
        }
        if (ok) s += WV[c];
      }
    }
    return s;
  }
  function candidates(b) {
    const out = [];
    let any = false;
    const near = new Uint8Array(NN * NN);
    for (let i = 0; i < NN * NN; i++) {
      if (!b[i]) continue;
      any = true;
      const x = i % NN, y = (i / NN) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= NN || yy >= NN) continue;
        const j = yy * NN + xx;
        if (!b[j]) near[j] = 1;
      }
    }
    if (!any) return [7 * NN + 7];
    for (let i = 0; i < NN * NN; i++) if (near[i]) out.push(i);
    return out;
  }
  function cellScore(b, i, me) {
    const x = i % NN, y = (i / NN) | 0, opp = 3 - me;
    const att = lineScore(b, x, y, me), def = lineScore(b, x, y, opp);
    const cx = Math.abs(x - 7), cy = Math.abs(y - 7);
    return att + def * 0.92 + (14 - cx - cy) * 0.15;
  }
  function chooseMove(b, me, level) {
    const cand = candidates(b);
    if (cand.length === 1 && !b[cand[0]]) {
      if (b.every(v => v === 0)) { const a = [7 * NN + 7, 6 * NN + 7, 7 * NN + 6, 8 * NN + 8]; return a[(Math.random() * a.length) | 0]; }
    }
    const scored = cand.map(i => ({ i, s: cellScore(b, i, me) }));
    scored.sort((a, c) => c.s - a.s);
    if (scored[0].s >= 1e6) {
      /* 이기는 수는 항상 두고, 막아야 하는 수는 쉬움에서 가끔 놓친다 */
      const x0 = scored[0].i % NN, y0 = (scored[0].i / NN) | 0;
      const isWin = lineScore(b, x0, y0, me) >= 1e6;
      if (isWin || level !== 'easy' || Math.random() > 0.4) return scored[0].i;
    }
    if (level === 'easy') {
      if (Math.random() < 0.4) return scored[(Math.random() * Math.min(scored.length, 12)) | 0].i; // 가끔 엉뚱한 곳에 둔다
      const top = scored.slice(0, 10);
      let best = null, bv = -1;
      for (const t of top) { const v = t.s * (0.3 + Math.random()); if (v > bv) { bv = v; best = t.i; } }
      return best;
    }
    if (level === 'normal') {
      const top = scored.filter(t => t.s >= scored[0].s * 0.98);
      return top[(Math.random() * top.length) | 0].i;
    }
    /* 어려움: 상위 후보마다 상대의 최선 응수를 한 번 내다본다 */
    let best = scored[0].i, bv = -Infinity;
    for (const t of scored.slice(0, 8)) {
      b[t.i] = me;
      const w = winCells(b, t.i, me);
      let v;
      if (w) v = 1e9;
      else {
        let oppBest = 0;
        for (const j of candidates(b)) { const sc = cellScore(b, j, 3 - me); if (sc > oppBest) oppBest = sc; }
        v = t.s - 0.9 * oppBest;
      }
      b[t.i] = 0;
      v += Math.random() * 0.5;
      if (v > bv) { bv = v; best = t.i; }
    }
    return best;
  }

  /* ---------- 그리기 ---------- */
  function drawBg() {
    let s = '<rect x="1" y="1" width="318" height="318" rx="12" class="orim"/>' +
      '<rect x="6" y="6" width="308" height="308" rx="8" class="owood"/>' +
      '<rect x="6" y="6" width="308" height="308" rx="8" filter="url(#ograin)" opacity="0.7"/>';
    for (let k = 0; k < NN; k++) {
      const e = (k === 0 || k === NN - 1) ? ' edge' : '';
      s += '<line class="oline' + e + '" x1="' + px(0) + '" y1="' + px(k) + '" x2="' + px(NN - 1) + '" y2="' + px(k) + '"/>' +
        '<line class="oline' + e + '" x1="' + px(k) + '" y1="' + px(0) + '" x2="' + px(k) + '" y2="' + px(NN - 1) + '"/>';
    }
    [3, 7, 11].forEach(a => [3, 7, 11].forEach(c => { s += '<circle class="ostar" cx="' + px(a) + '" cy="' + px(c) + '" r="2.2"/>'; }));
    q('#obg').innerHTML = s;
  }
  function stoneMarkup(p, x, y, cls) {
    return '<g class="ost' + (cls ? ' ' + cls : '') + '">' +
      '<ellipse cx="' + (x + 1.6) + '" cy="' + (y + 2.6) + '" rx="' + (R + 0.6) + '" ry="' + (R - 1) + '" fill="url(#gOSh)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#' + (p === 1 ? 'gStB' : 'gStW') + ')"' + (p === 2 ? ' stroke="#9AA39D" stroke-width="0.5"' : '') + '/>' +
      '<ellipse cx="' + (x - 2.6) + '" cy="' + (y - 3.2) + '" rx="2.8" ry="1.6" transform="rotate(-30 ' + (x - 2.6) + ' ' + (y - 3.2) + ')" fill="#fff" opacity="' + (p === 1 ? 0.4 : 0.9) + '"/></g>';
  }
  function dynMarkup() {
    let s = '';
    for (let i = 0; i < NN * NN; i++) {
      const v = G.b[i];
      if (!v) continue;
      s += stoneMarkup(v, px(i % NN), px((i / NN) | 0), G.fx === i ? 'settle' : '');
    }
    if (G.last !== null && G.last !== undefined) s += '<circle class="olastm" cx="' + px(G.last % NN) + '" cy="' + px((G.last / NN) | 0) + '" r="3.4"/>';
    for (const i of G.win) s += '<circle class="owin" cx="' + px(i % NN) + '" cy="' + px((i / NN) | 0) + '" r="' + (R + 2) + '"/>';
    const gh = G.ghost !== null ? G.ghost : (G.kb !== null && humanTurn() ? G.kb : null);
    if (gh !== null && humanTurn() && !G.b[gh]) {
      const x = px(gh % NN), y = px((gh / NN) | 0);
      s += '<line class="ocross" x1="' + (x - 11) + '" y1="' + y + '" x2="' + (x + 11) + '" y2="' + y + '"/><line class="ocross" x1="' + x + '" y1="' + (y - 11) + '" x2="' + x + '" y2="' + (y + 11) + '"/>';
      s += '<g class="oghost">' + stoneMarkup(G.turn, x, y, '') + '</g>';
    }
    return s;
  }
  function fxRipple(i) {
    const l = q('#ofx'); if (!l || reduceMotion) return;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'oripple'); c.setAttribute('cx', px(i % NN)); c.setAttribute('cy', px((i / NN) | 0)); c.setAttribute('r', 9);
    l.appendChild(c); setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 600);
  }
  function fxConfetti() {
    const l = q('#ofx'); if (!l || reduceMotion) return;
    const cols = ['#CC785C', '#4F7DBF', '#E8A55A', '#FAF9F5', '#5DB8A6'];
    for (let k = 0; k < 44; k++) {
      const r = document.createElementNS(NS, 'rect');
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 110;
      r.setAttribute('class', 'conf'); r.setAttribute('x', 157); r.setAttribute('y', 158); r.setAttribute('width', 5); r.setAttribute('height', 3.5);
      r.setAttribute('fill', cols[k % cols.length]);
      r.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      r.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 50) + 'px');
      r.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      l.appendChild(r); setTimeout(() => { if (r.parentNode) r.parentNode.removeChild(r); }, 1600);
    }
  }

  function sayText() {
    if (G.winner === 3) return '판이 가득 찼어요. 무승부예요.';
    if (G.winner) {
      if (oc.mode === 'ai') return iWon(G.winner) ? '이겼어요. ' + G.moves + '수 만에 다섯 줄을 이었어요.' : '컴퓨터가 먼저 다섯 줄을 이었어요.';
      if (isOn() && O.seat > 0) return iWon(G.winner) ? '이겼어요. ' + G.moves + '수 만에 다섯 줄을 이었어요.' : '상대가 먼저 다섯 줄을 이었어요.';
      return colorName(G.winner) + ' 승리. ' + G.moves + '수 만에 끝났어요.';
    }
    if (isOn()) {
      if (!O.code) return '방을 만들거나 코드를 입력해 주세요.';
      if (O.seat === 0) return '관람 중이에요. ' + colorName(G.turn) + ' 차례예요.';
      if (!O.guestIn()) return '상대를 기다리는 중이에요. 방 코드 ' + O.code + ' 를 알려 주세요.';
      if (G.turn !== myColor()) return '상대 차례예요. 잠시 기다려 주세요.';
    }
    if (G.think) return '컴퓨터가 생각하는 중…';
    if (G.note) return G.note;
    if (oc.mode === 'ai' || isOn()) return '내 차례예요. 교차점에 손을 대고 끌어서 놓을 곳을 맞춰 보세요.';
    return colorName(G.turn) + ' 차례예요. 교차점에 손을 대고 끌어서 놓을 곳을 맞춰 보세요.';
  }
  function renderStatus() {
    const nm = names();
    const ready = !(isOn() && !O.guestIn());
    for (let p = 1; p <= 2; p++) {
      let conn = '';
      if (isOn() && O.seat > 0 && p !== myColor()) conn = !ready ? 'wait' : (O.oppOn ? 'on' : 'off');
      setPlayerName(q('#opn' + p), nm[p], conn);
      q('#ops' + p).textContent = G.winner === p ? '승리' : '';
      q('#opl' + p).classList.toggle('on', !G.winner && G.turn === p && ready);
    }
    q('#osay').textContent = sayText();
    q('#ocount').textContent = G.moves + '수 진행';
    q('#oundo').disabled = isOn() || G.busy || G.hist.length === 0;
    q('#oagain').disabled = isOn() && O.seat === 0;
    const r = q('#oresult');
    if (G.winner && !G.busy && !G.hideResult) {
      r.hidden = false;
      const t = q('#ortitle');
      let label;
      if (G.winner === 3) label = '무승부';
      else if (oc.mode === 'ai' || (isOn() && O.seat > 0)) label = iWon(G.winner) ? '승리' : '패배';
      else label = colorName(G.winner) + ' 승리';
      t.textContent = label; t.className = 'rtitle ' + (G.winner === 1 ? 'wb' : 'ww');
      q('#orsub').textContent = G.moves + '수 만에 끝났어요.';
      q('#orAgain').hidden = isOn() && O.seat === 0;
    } else r.hidden = true;
  }
  function render() {
    q('#odyn').innerHTML = dynMarkup();
    G.fx = null;
    renderStatus();
  }

  /* ---------- 설정 ---------- */
  function setDef() {
    const modes = [['ai', '컴퓨터'], ['local', '둘이서']];
    if (typeof Peer !== 'undefined') modes.push(['online', '온라인']);
    return [
      { key: 'mode', label: '상대', opts: modes },
      { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: () => oc.mode === 'ai', own: true },
      { key: 'first', label: '선공', opts: [['me', '나(흑)'], ['cpu', '컴퓨터(흑)']], when: () => oc.mode === 'ai', own: true },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#osettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : oc[s.key];
      return '<div class="set"><span class="setlabel" id="osl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="osl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }

  /* ---------- 흐름 ---------- */
  function maybeAI() {
    if (oc.mode !== 'ai' || G.winner || G.busy || G.turn !== aiP()) return;
    const tk = gtok;
    G.busy = true; G.think = true;
    renderStatus();
    setTimeout(() => {
      if (tk !== gtok) return;
      const me = G.turn;
      const i = chooseMove(G.b, me, oc.level);
      G.busy = false; G.think = false;
      place(i, false);
    }, 420);
  }
  function place(i, remote) {
    if (G.b[i] || G.winner) return;
    const p = G.turn;
    G.b[i] = p; G.hist.push({ i, p }); G.last = i; G.moves++; G.n++; G.fx = i; G.ghost = null; G.kb = null; G.note = '';
    FX.drop(); fxRipple(i);
    const w = winCells(G.b, i, p);
    if (w) {
      G.winner = p; G.win = w; G.hideResult = false;
      const win = iWon(p);
      setTimeout(() => { if (win) { FX.win(); fxConfetti(); } else FX.lose(); }, 240);
    } else if (G.moves >= NN * NN) { G.winner = 3; }
    else G.turn = 3 - p;
    render();
    if (isOn() && !remote) pushDoc();
    maybeAI();
  }
  function undo() {
    if (isOn() || G.busy || !G.hist.length) return;
    gtok++;
    let h = G.hist.pop();
    G.b[h.i] = 0; G.moves--;
    G.turn = h.p;
    if (oc.mode === 'ai' && h.p === aiP() && G.hist.length) { const h2 = G.hist.pop(); G.b[h2.i] = 0; G.moves--; G.turn = h2.p; }
    G.last = G.hist.length ? G.hist[G.hist.length - 1].i : null;
    G.winner = 0; G.win = []; G.note = ''; G.busy = false; G.think = false; G.hideResult = false;
    render();
    maybeAI();
  }
  function newGame() { reset(); render(); maybeAI(); }

  /* ---------- 입력: 손을 대고 끌어서 맞춘 뒤 떼면 놓인다 ---------- */
  const bd = q('#oboard');
  let dr = null;
  function nearest(e, touch) {
    try {
      const pt = bd.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY - (touch ? 26 : 0);
      const m = bd.getScreenCTM(); if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      const gx = Math.round((p.x - OFF) / CELL), gy = Math.round((p.y - OFF) / CELL);
      if (gx < 0 || gy < 0 || gx >= NN || gy >= NN) return null;
      if (Math.hypot(p.x - px(gx), p.y - px(gy)) > CELL * 0.9) return null;
      return gy * NN + gx;
    } catch (err) { return null; }
  }
  function setGhost(i) {
    const v = (i !== null && !G.b[i]) ? i : null;
    if (v === G.ghost) return;
    G.ghost = v;
    if (v !== null) FX.snap();
    q('#odyn').innerHTML = dynMarkup();
  }
  bd.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    audio(); bgmSync();
    if (!humanTurn()) return;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    dr = { id: e.pointerId, touch };
    try { bd.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    G.kb = null;
    const i = nearest(e, touch);
    if (i !== null && !G.b[i]) { haptic('pick'); }
    setGhost(i);
  });
  bd.addEventListener('pointermove', e => {
    if (dr) { if (e.pointerId === dr.id) setGhost(nearest(e, dr.touch)); return; }
    if (e.pointerType === 'mouse' && humanTurn()) setGhost(nearest(e, false));
  });
  bd.addEventListener('pointerleave', e => { if (!dr && e.pointerType === 'mouse') setGhost(null); });
  function endP(e, cancel) {
    if (!dr || e.pointerId !== dr.id) return;
    const d = dr; dr = null;
    try { bd.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const g = G.ghost;
    G.ghost = null;
    if (!cancel && g !== null && humanTurn() && !G.b[g]) place(g, false);
    else q('#odyn').innerHTML = dynMarkup();
  }
  bd.addEventListener('pointerup', e => endP(e, false));
  bd.addEventListener('pointercancel', e => endP(e, true));
  bd.addEventListener('contextmenu', e => e.preventDefault());
  bd.addEventListener('keydown', e => {
    if (!humanTurn()) return;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) {
      e.preventDefault();
      const cur = G.kb === null ? 7 * NN + 7 : G.kb;
      const x = Math.min(NN - 1, Math.max(0, (cur % NN) + mv[0])), y = Math.min(NN - 1, Math.max(0, ((cur / NN) | 0) + mv[1]));
      G.kb = y * NN + x; G.ghost = null; FX.snap(); q('#odyn').innerHTML = dynMarkup();
    } else if ((e.key === 'Enter' || e.key === ' ') && G.kb !== null) {
      e.preventDefault();
      if (!G.b[G.kb]) place(G.kb, false);
    }
  });

  /* ---------- 온라인 (PeerJS, 방장이 기준) ---------- */
  const PFXO = 'gogeon-omk-';
  function docNow() { return { n: G.n, b: Array.prototype.join.call(G.b, ''), turn: G.turn, moves: G.moves, last: G.last, winner: G.winner, win: G.win, sw: O.sw, p2: O.isHost ? O.guestIn() : true }; }
  function netSendO(m, except) {
    if (O.isHost) { [O.guest].concat(O.watchers).forEach(c => { if (c !== except) sendTo(c, m); }); }
    else sendTo(O.conn, m);
  }
  function pushDoc() { const d = docNow(); if (O.isHost) O.doc = d; netSendO({ t: 'doc', d }); }
  function applyDocO(d) {
    G.b = Int8Array.from(String(d.b).split(''), Number);
    G.turn = d.turn; G.moves = d.moves; G.last = d.last === undefined ? null : d.last; G.winner = d.winner || 0; G.win = d.win || [];
    G.n = d.n; O.sw = d.sw || 0; G.ghost = null; G.kb = null; G.note = ''; G.busy = false; G.think = false; G.hideResult = false;
    G.hist = []; G.fx = G.last;
  }
  function onDocO(d) {
    if (d.n <= G.n) { if (d.sw !== O.sw) { O.sw = d.sw; render(); } return; }
    const fresh = d.moves === 0 || d.moves !== G.moves + 1;
    const wasMine = false;
    applyDocO(d);
    if (!fresh && G.last !== null) { FX.pick(); setTimeout(() => FX.drop(), 40); fxRipple(G.last); }
    if (G.winner && G.winner !== 3) { const win = iWon(G.winner); setTimeout(() => { if (win) { FX.win(); fxConfetti(); } else FX.lose(); }, 240); }
    render(); renderOnline();
  }
  const inviteUrl = () => location.origin + location.pathname + '?o=' + O.code;
  function renderInvite() { Invite.render(q('#oinv'), { note: '나는 흑(선공), 친구는 백이에요', avail: typeof Peer !== 'undefined', online: isOn(), busy: O.busy, code: O.code, host: O.isHost, oppOn: O.oppOn }); }
  async function inviteStart() {
    if (typeof Peer === 'undefined' || O.busy) return;
    if (!isOn()) { oc.mode = 'online'; store.set('cg.omok.cfg', JSON.stringify(oc)); renderSet(); onMode(); }
    if (!O.code) await createRoomO();
    if (O.code && Invite.canShare()) Invite.share(inviteUrl());
  }
  function renderOnline() {
    renderInvite();
    const el = q('#oonline');
    if (!isOn()) { el.hidden = true; return; }
    el.hidden = false;
    const old = q('#oCode');
    const keep = old ? old.value.replace(/[^a-z0-9]/gi, '').slice(0, 4) : '';
    let h = '<p class="olh">온라인 대전</p>';
    if (!O.code) {
      h += '<div class="row"><button type="button" class="btn primary" id="oNew"' + (O.busy ? ' disabled' : '') + '>새 방 만들기</button></div>' +
        '<div class="row olin"><input id="oCode" class="olinput" type="text" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="방 코드 4자리" value="' + keep + '">' +
        '<button type="button" class="btn" id="oJoin"' + (O.busy ? ' disabled' : '') + '>들어가기</button></div>' +
        '<p class="hint">한 사람이 방을 만들고 링크(또는 4자리 코드)를 보내면, 상대가 열어서 바로 들어와요. 방을 만든 사람이 페이지를 닫으면 방도 닫혀요.</p>';
    } else {
      const me = myColor();
      h += '<div class="olcodebox"><span class="olcode" id="oShown">' + O.code + '</span><button type="button" class="btn primary" id="oShare">공유하기</button><button type="button" class="btn" id="oCopy">링크 복사</button></div>' +
        '<p class="olst">내 돌: ' + (me === 1 ? '흑(먼저 둬요)' : me === 2 ? '백' : '관람') + '</p>' +
        '<div class="row"><button type="button" class="btn" id="oLeave">방 나가기</button></div>';
    }
    if (O.err) h += '<p class="hint warn" role="alert">' + O.err + '</p>';
    el.innerHTML = h;
  }
  async function createRoomO() {
    if (O.busy) return;
    O.busy = true; O.err = ''; renderOnline();
    try {
      let peer = null, code = '';
      for (let i = 0; i < 6 && !peer; i++) {
        code = newCode('m');
        peer = await openPeer(PFXO + code).catch(e => { if (e && e.type === 'unavailable-id') return null; throw e; });
      }
      if (!peer) throw new Error('code');
      enterHostO(code, peer);
    } catch (e) { O.err = '방을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'; }
    O.busy = false; renderOnline();
  }
  function leaveO() {
    [O.guest, O.conn].concat(O.watchers || []).forEach(c => { try { if (c) c.close(); } catch (e) { /* 무시 */ } });
    if (O.peer) { try { O.peer.destroy(); } catch (e) { /* 무시 */ } }
    Object.assign(O, { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, seat: 0, oppOn: false, pending: null });
  }
  function enterHostO(code, peer) {
    leaveO(); reset(); G.n = 0;
    Object.assign(O, { code, peer, isHost: true, seat: 1, sw: 0, oppOn: false });
    O.doc = docNow();
    peer.on('error', () => { O.err = '연결에 문제가 생겼어요. 방을 다시 만들어 주세요.'; renderOnline(); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* 무시 */ } });
    Beat.host(peer, () => [O.guest].concat(O.watchers));
    peer.on('connection', c => {
      c.on('open', () => {
        let seat = 0;
        if (!O.guest || !O.guest.open) { O.guest = c; seat = 2; O.oppOn = true; }
        else O.watchers.push(c);
        sendTo(c, { t: 'hello', seat, doc: docNow() });
        renderOnline(); render();
      });
      c.on('data', m => {
        if (!m || c !== O.guest) return;
        if (m.t === 'doc' && m.d && m.d.n > G.n) { O.doc = m.d; netSendO({ t: 'doc', d: m.d }, c); onDocO(m.d); }
      });
      c.on('close', () => { if (c === O.guest) { O.oppOn = false; render(); renderOnline(); } });
    });
    render();
  }
  async function joinO(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (O.busy) return;
    if (!/^[a-z0-9]{4}$/.test(code)) { O.err = '방 코드는 4자리예요.'; renderOnline(); return; }
    O.busy = true; O.err = ''; renderOnline();
    Join.joining('omok');
    let peer = null;
    try {
      peer = await openPeer(null);
      const hello = await new Promise((res, rej) => {
        const c = peer.connect(PFXO + code, { reliable: true });
        const t = setTimeout(() => rej(new Error('timeout')), 12000);
        peer.on('error', e => { clearTimeout(t); rej(e); });
        c.on('data', m => { if (m && m.t === 'hello') { clearTimeout(t); res({ c, m }); } });
        c.on('error', e => { clearTimeout(t); rej(e); });
      });
      enterGuestO(code, peer, hello.c, hello.m);
      Join.joined('omok', myColor());
    } catch (e) {
      try { if (peer) peer.destroy(); } catch (x) { /* 무시 */ }
      Join.failed('omok', code, e && e.type === 'peer-unavailable' ? 'gone' : 'net', () => joinO(code));
      O.err = e && e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : '방에 연결하지 못했어요. 방장이 페이지를 열어 둔 상태인지 확인해 주세요.';
    }
    O.busy = false; renderOnline();
  }
  function enterGuestO(code, peer, c, hello) {
    leaveO(); reset(); G.n = -1;
    Object.assign(O, { code, peer, isHost: false, conn: c, seat: hello.seat, oppOn: true });
    c.on('data', m => { if (m && m.t === 'doc' && m.d) onDocO(m.d); });
    c.on('close', () => { const mine = O.conn === c; O.oppOn = false; O.err = '방장과 연결이 끊어졌어요. 방을 나갔다가 다시 들어와 보세요.'; renderOnline(); renderStatus(); if (mine) Join.closed('omok', code, () => joinO(code), () => { leaveO(); reset(); render(); renderOnline(); }); });
    peer.on('error', () => { O.err = '연결에 문제가 생겼어요.'; renderOnline(); });
    Beat.guest(c, peer);
    O.sw = hello.doc.sw || 0;
    G.n = -1; onDocO(hello.doc); G.n = hello.doc.n;
    render(); renderOnline();
  }
  function newGameO() {
    if (!O.code || O.seat === 0) return;
    const btn = q('#oagain');
    if (G.moves > 0 && !G.winner && !G.confirmNew) {
      G.confirmNew = true; btn.textContent = '한 번 더 누르면 새 판';
      setTimeout(() => { G.confirmNew = false; btn.textContent = '새 게임'; }, 3000);
      return;
    }
    G.confirmNew = false; btn.textContent = '새 게임';
    const n = G.n + 1, sw = O.sw ? 0 : 1;
    reset(); G.n = n; O.sw = sw; // 새 판마다 흑백을 서로 바꿔요
    render(); renderOnline();
    pushDoc();
  }

  /* ---------- 연결 ---------- */
  function onMode() {
    if (isOn()) { leaveO(); reset(); render(); renderOnline(); }
    else { leaveO(); newGame(); renderOnline(); }
  }
  q('#obk').addEventListener('click', () => show('hub'));
  q('#oundo').addEventListener('click', undo);
  q('#oagain').addEventListener('click', () => { if (isOn()) newGameO(); else newGame(); });
  q('#orAgain').addEventListener('click', () => { if (isOn()) newGameO(); else newGame(); });
  q('#orView').addEventListener('click', () => { G.hideResult = true; renderStatus(); });
  q('#osettings').addEventListener('click', e => {
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
    oc[b.dataset.k] = b.dataset.v;
    store.set('cg.omok.cfg', JSON.stringify(oc));
    renderSet();
    if (b.dataset.k === 'mode') onMode(); else newGame();
  });
  q('#oonline').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'oNew') createRoomO();
    else if (b.id === 'oJoin') joinO(q('#oCode').value);
    else if (b.id === 'oShare') Invite.share(inviteUrl(), b);
    else if (b.id === 'oCopy') {
      const url = location.origin + location.pathname + '?o=' + O.code;
      const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '링크 복사'; }, 1500); };
      try { navigator.clipboard.writeText(url).then(done, () => {}); } catch (err) { /* 무시 */ }
    } else if (b.id === 'oLeave') { leaveO(); reset(); render(); renderOnline(); }
  });
  q('#oinv').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'start') inviteStart();
    else if (b.dataset.act === 'share') Invite.share(inviteUrl(), b);
  });
  q('#oonline').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'oCode') joinO(e.target.value); });

  window.omokSettings = function () { renderSet(); };
  window.omokJoin = function (code) { oc.mode = 'online'; show('omok'); joinO(code); };
  window.omokEnter = function () {
    renderSet();
    if (wantOnlineO) { wantOnlineO = false; if (typeof Peer !== 'undefined') { oc.mode = 'online'; renderSet(); onMode(); return; } }
    if (isOn() && typeof Peer === 'undefined') { oc.mode = 'ai'; newGame(); renderOnline(); return; }
    render(); renderOnline(); maybeAI();
  };
  window.omokLeave = function () { gtok++; G.busy = false; G.think = false; G.ghost = null; };

  /* 초기화 */
  drawBg();
  reset();
  try {
    const r = new URLSearchParams(location.search).get('o');
    if (r && /^[a-z0-9]{4}$/i.test(r) && typeof Peer !== 'undefined') {
      Join.setOrigin('link');
      Join.joining('omok');
      oc.mode = 'online';
      show('omok');
      joinO(r.toLowerCase());
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
    }
  } catch (e) { /* 무시 */ }
})();
