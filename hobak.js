/* ===== 호박고누 : 컴퓨터 / 둘이서 / 온라인 =====
   판: 호박(원) 하나와 양쪽 끝의 집(세 점). 점 11개.
   규칙: 말 3개씩, 선을 따라 한 칸씩만 가요. 건너뛰기·잡기 없음.
   한 번 말머리 줄을 떠난 말은 어느 말머리 줄에도 다시 못 들어가요.
   상대가 움직일 수 없게 막으면 이겨요. */
(function () {
  const VW = 320, VH = 400, R = 15;
  const q = (s, r) => (r || document).querySelector(s);

  /* ---------- 판 ---------- */
  const CX = 160, CY = 200, RAD = 88;
  const PT = [
    [55, 36], [160, 36], [265, 36],       // 0~2 위쪽 집 (ㄱ ㄴ ㄷ)
    [55, 364], [160, 364], [265, 364],    // 3~5 아래쪽 집 (ㄹ ㅁ ㅂ)
    [CX, CY - RAD], [CX + RAD, CY], [CX, CY + RAD], [CX - RAD, CY], // 6~9 원 위의 네 점 (위·오른·아래·왼)
    [CX, CY]                              // 10 가운데
  ];
  const EDGES = [[0, 1], [1, 2], [1, 6], [3, 4], [4, 5], [4, 8],
    [6, 7], [7, 8], [8, 9], [9, 6], [6, 10], [8, 10], [7, 10], [9, 10]];
  const ADJ = PT.map(() => []);
  EDGES.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });
  const isHead = i => i < 6;
  /* 값: 0 빈칸, 1·2 말머리 줄에 있는 말, 3·4 줄을 떠난 말 (주인은 v>2 ? v-2 : v) */
  const own = v => v > 2 ? v - 2 : v;
  const START = () => [2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0];
  const DRAW_AT = 100;

  function movesOf(b, p) {
    const out = [];
    for (let i = 0; i < PT.length; i++) {
      const v = b[i];
      if (!v || own(v) !== p) continue;
      for (const j of ADJ[i]) {
        if (b[j]) continue;
        if (isHead(j) && v > 2) continue; // 떠난 말은 말머리 줄로 못 돌아가요
        out.push([i, j]);
      }
    }
    return out;
  }
  function apply(b, m) {
    const nb = b.slice();
    let v = nb[m[0]];
    nb[m[0]] = 0;
    if (!isHead(m[1]) && v <= 2) v += 2;
    nb[m[1]] = v;
    return nb;
  }

  /* ---------- 컴퓨터: 막히면 지는 게임이라 갈 수 있는 길의 수를 따져요 ---------- */
  function evalB(b, me) {
    return movesOf(b, me).length - movesOf(b, 3 - me).length;
  }
  function search(b, turn, depth, a, bt, me) {
    const mv = movesOf(b, turn);
    if (!mv.length) return turn === me ? -1000 - depth : 1000 + depth;
    if (depth === 0) return evalB(b, me);
    if (turn === me) {
      let v = -Infinity;
      for (const m of mv) { v = Math.max(v, search(apply(b, m), 3 - turn, depth - 1, a, bt, me)); a = Math.max(a, v); if (a >= bt) break; }
      return v;
    }
    let v = Infinity;
    for (const m of mv) { v = Math.min(v, search(apply(b, m), 3 - turn, depth - 1, a, bt, me)); bt = Math.min(bt, v); if (a >= bt) break; }
    return v;
  }
  /* 어려움: 판 상태가 2천여 개뿐이라 처음에 전부 풀어 두고, 이기는 길과 상대가 실수하기 쉬운 길을 골라요 */
  let SOLVED = null;
  const skey = (b, t) => b.join('') + t;
  function solveAll() {
    const seen = new Map(), st = [[START(), 1]];
    seen.set(skey(START(), 1), []);
    while (st.length) {
      const [b, t] = st.pop();
      const succ = seen.get(skey(b, t));
      for (const m of movesOf(b, t)) {
        const nb = apply(b, m), k = skey(nb, 3 - t);
        succ.push(k);
        if (!seen.has(k)) { seen.set(k, []); st.push([nb, 3 - t]); }
      }
    }
    const pred = new Map(), cnt = new Map(), res = new Map(), q = [];
    seen.forEach((succ, k) => succ.forEach(s => { if (!pred.has(s)) pred.set(s, []); pred.get(s).push(k); }));
    seen.forEach((succ, k) => { cnt.set(k, succ.length); if (!succ.length) { res.set(k, 'L'); q.push(k); } });
    while (q.length) {
      const k = q.shift(), r = res.get(k);
      for (const p of pred.get(k) || []) {
        if (res.has(p)) continue;
        if (r === 'L') { res.set(p, 'W'); q.push(p); }
        else { cnt.set(p, cnt.get(p) - 1); if (!cnt.get(p)) { res.set(p, 'L'); q.push(p); } }
      }
    }
    return res;
  }
  function solvedMove(b, me) {
    if (!SOLVED) SOLVED = solveAll();
    const mv = movesOf(b, me);
    const wins = [], draws = [];
    for (const m of mv) {
      const nb = apply(b, m), r = SOLVED.get(skey(nb, 3 - me));
      if (r === 'L') wins.push([m, 0]);
      else if (!r) {
        // 상대가 한 번 잘못 두면 내가 이기는 길이 많을수록 좋은 수
        const trap = movesOf(nb, 3 - me).filter(m2 => SOLVED.get(skey(apply(nb, m2), me)) === 'W').length;
        draws.push([m, trap]);
      }
    }
    const pool = wins.length ? wins : draws.length ? draws : mv.map(m => [m, 0]);
    const top = Math.max.apply(null, pool.map(x => x[1]));
    const best = pool.filter(x => x[1] === top);
    return best[(Math.random() * best.length) | 0][0];
  }
  function chooseMove(b, me, level) {
    if (level === 'hard') return solvedMove(b, me);
    const mv = movesOf(b, me);
    if (!mv.length) return null;
    const depth = level === 'easy' ? 1 : level === 'normal' ? 3 : 6;
    if (level === 'easy' && Math.random() < 0.4) return mv[(Math.random() * mv.length) | 0];
    let best = [], bv = -Infinity;
    for (const m of mv) {
      const v = search(apply(b, m), 3 - me, depth - 1, -Infinity, Infinity, me) + Math.random() * 0.3;
      if (v > bv) { bv = v; best = [m]; } else if (v === bv) best.push(m);
    }
    return best[(Math.random() * best.length) | 0];
  }

  /* ---------- 상태 ---------- */
  let hc = { mode: 'ai', level: 'normal', first: 'me' };
  try { Object.assign(hc, JSON.parse(store.get('cg.hobak.cfg') || '{}')); } catch (e) { /* 기본값 */ }
  let wantOnlineH = false;
  if (hc.mode === 'online') { wantOnlineH = true; hc.mode = 'ai'; }
  const G = {};
  let gtok = 0;
  const O = { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, seat: 0, sw: 0, oppOn: false, err: '', busy: false };
  const isOn = () => hc.mode === 'online';
  const aiP = () => hc.first === 'cpu' ? 1 : 2;
  O.guestIn = () => O.isHost ? !!(O.guest && O.guest.open) : !!(O.conn && O.conn.open);
  const myColor = () => O.seat === 0 ? 0 : (O.isHost ? (O.sw ? 2 : 1) : (O.sw ? 1 : 2));

  function reset() {
    gtok++;
    G.b = START(); G.turn = 1; G.moves = 0; G.last = null; G.winner = 0;
    G.hist = []; G.busy = false; G.think = false; G.sel = null; G.fx = null;
    G.hideResult = false; G.confirmNew = false; G.note = '';
    if (G.n === undefined) G.n = 0;
  }
  G.n = 0;
  const humanTurn = () => {
    if (G.winner || G.busy) return false;
    if (isOn()) return O.seat > 0 && O.guestIn() && G.turn === myColor();
    if (hc.mode === 'ai') return G.turn !== aiP();
    return true;
  };
  const colorName = p => p === 1 ? '빨강' : '파랑';
  const names = () => {
    if (hc.mode === 'ai') return aiP() === 1 ? ['', '컴퓨터', '나'] : ['', '나', '컴퓨터'];
    if (isOn() && O.seat > 0) return myColor() === 1 ? ['', '나', '상대'] : ['', '상대', '나'];
    return ['', '빨강', '파랑'];
  };
  const iWon = w => hc.mode === 'ai' ? w !== aiP() : (isOn() && O.seat > 0 ? w === myColor() : true);
  /* 내 말이 아래쪽에 오도록 판을 돌려 봐요 */
  const flipped = () => (hc.mode === 'ai' && aiP() === 1) || (isOn() && O.seat > 0 && myColor() === 2);
  const P = i => flipped() ? [VW - PT[i][0], VH - PT[i][1]] : PT[i];

  /* ---------- 그리기 ---------- */
  function drawBg() {
    let s = '<rect x="2" y="2" width="316" height="396" rx="18" class="hrim"/><rect x="7" y="7" width="306" height="386" rx="14" class="hbd"/>';
    s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + RAD + '" class="hln"/>';
    EDGES.forEach(([a, b]) => {
      const onRing = a >= 6 && a <= 9 && b >= 6 && b <= 9;
      if (onRing) return;
      s += '<line class="hln" x1="' + PT[a][0] + '" y1="' + PT[a][1] + '" x2="' + PT[b][0] + '" y2="' + PT[b][1] + '"/>';
    });
    PT.forEach((p, i) => { s += '<circle class="hnode' + (isHead(i) ? ' head' : '') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (isHead(i) ? 4.5 : 3.6) + '"/>'; });
    q('#hbg').innerHTML = s;
  }
  function pieceMarkup(p, x, y, cls) {
    return '<g class="hpc' + (cls ? ' ' + cls : '') + '">' +
      '<ellipse cx="' + (x + 1.6) + '" cy="' + (y + 2.8) + '" rx="' + (R + 0.6) + '" ry="' + (R - 2) + '" fill="rgba(0,0,0,0.4)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#' + (p === 1 ? 'gHR' : 'gHB') + ')" stroke="' + (p === 1 ? 'var(--red-ink)' : 'var(--blue-ink)') + '" stroke-width="1.4"/>' +
      '<ellipse cx="' + (x - 4.5) + '" cy="' + (y - 5.5) + '" rx="4.6" ry="2.6" transform="rotate(-30 ' + (x - 4.5) + ' ' + (y - 5.5) + ')" fill="#fff" opacity="0.55"/></g>';
  }
  const legalFrom = i => movesOf(G.b, G.turn).filter(m => m[0] === i).map(m => m[1]);
  function dynMarkup() {
    let s = '';
    const targets = G.sel !== null && humanTurn() ? legalFrom(G.sel) : [];
    if (G.last) {
      const a = P(G.last[0]), b = P(G.last[1]);
      s += '<line class="hlastl" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/><circle class="hlastm" cx="' + a[0] + '" cy="' + a[1] + '" r="5"/>';
    }
    for (const t of targets) { const p = P(t); s += '<circle class="htarget" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (R - 2) + '"/>'; }
    for (let i = 0; i < PT.length; i++) {
      const v = G.b[i];
      if (!v) continue;
      const p = P(i), o = own(v);
      const mine = humanTurn() && o === G.turn && (hc.mode === 'local' || !isOn() || o === myColor());
      const can = mine && legalFrom(i).length > 0;
      if (G.sel === i) s += '<circle class="hsel" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (R + 6) + '"/>';
      s += pieceMarkup(o, p[0], p[1], (G.fx === i ? 'settle ' : '') + (can ? 'can' : ''));
    }
    for (let i = 0; i < PT.length; i++) {
      const p = P(i);
      const t = targets.indexOf(i) >= 0, v = G.b[i];
      const mine = humanTurn() && v && own(v) === G.turn && legalFrom(i).length > 0;
      s += '<circle class="hhit" data-i="' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="22"' + (t || mine ? ' tabindex="0" role="button" aria-label="' + (t ? '여기로 옮기기' : '내 말 선택') + '"' : '') + '/>';
    }
    return s;
  }
  function fxConfetti() {
    const l = q('#hfx'); if (!l || reduceMotion) return;
    const cols = ['#CC785C', '#4F7DBF', '#E8A55A', '#FAF9F5', '#5DB8A6'];
    for (let k = 0; k < 44; k++) {
      const r = document.createElementNS(NS, 'rect');
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 110;
      r.setAttribute('class', 'conf'); r.setAttribute('x', 157); r.setAttribute('y', 198); r.setAttribute('width', 5); r.setAttribute('height', 3.5);
      r.setAttribute('fill', cols[k % cols.length]);
      r.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      r.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 50) + 'px');
      r.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      l.appendChild(r); setTimeout(() => { if (r.parentNode) r.parentNode.removeChild(r); }, 1600);
    }
  }

  function sayText() {
    if (G.winner === 3) return '오래 이어져서 무승부예요.';
    if (G.winner) {
      const loser = 3 - G.winner;
      if (hc.mode === 'ai') return iWon(G.winner) ? '이겼어요. 컴퓨터의 말이 움직일 수 없어요.' : '졌어요. 내 말이 움직일 수 없어요.';
      if (isOn() && O.seat > 0) return iWon(G.winner) ? '이겼어요. 상대의 말이 움직일 수 없어요.' : '졌어요. 내 말이 움직일 수 없어요.';
      return colorName(G.winner) + ' 승리. ' + colorName(loser) + ' 말이 움직일 수 없어요.';
    }
    if (isOn()) {
      if (!O.code) return '방을 만들거나 코드를 입력해 주세요.';
      if (O.seat === 0) return '관람 중이에요. ' + colorName(G.turn) + ' 차례예요.';
      if (!O.guestIn()) return '상대를 기다리는 중이에요. 방 코드 ' + O.code + ' 를 알려 주세요.';
      if (G.turn !== myColor()) return '상대 차례예요. 잠시 기다려 주세요.';
    }
    if (G.think) return '컴퓨터가 생각하는 중…';
    if (G.note) return G.note;
    const who = hc.mode === 'local' ? colorName(G.turn) + ' 차례예요. ' : '내 차례예요. ';
    return who + (G.sel === null ? '움직일 말을 눌러 주세요.' : '갈 수 있는 곳을 눌러 주세요.');
  }
  function renderStatus() {
    const nm = names();
    const ready = !(isOn() && !O.guestIn());
    for (let p = 1; p <= 2; p++) {
      q('#hpn' + p).textContent = nm[p];
      let extra = '';
      if (isOn() && O.seat > 0 && p !== myColor()) extra = !ready ? ' · 대기 중' : (O.oppOn ? ' · 접속 중' : ' · 오프라인');
      q('#hps' + p).textContent = (G.winner === p ? '승리' : (!G.winner && G.turn === p && ready ? '차례' : '')) + extra;
      q('#hpl' + p).classList.toggle('on', !G.winner && G.turn === p && ready);
    }
    q('#hsay').textContent = sayText();
    q('#hcount').textContent = G.moves + '수 진행';
    q('#hundo').disabled = isOn() || G.busy || G.hist.length === 0;
    q('#hagain').disabled = isOn() && O.seat === 0;
    const r = q('#hresult');
    if (G.winner && !G.busy && !G.hideResult) {
      r.hidden = false;
      const t = q('#hrtitle');
      let label;
      if (G.winner === 3) label = '무승부';
      else if (hc.mode === 'ai' || (isOn() && O.seat > 0)) label = iWon(G.winner) ? '승리' : '패배';
      else label = colorName(G.winner) + ' 승리';
      t.textContent = label; t.className = 'rtitle ' + (G.winner === 1 ? 'wr' : 'wbl');
      q('#hrsub').textContent = G.winner === 3 ? G.moves + '수 동안 승부가 나지 않았어요.' : G.moves + '수 만에 끝났어요.';
      q('#hrAgain').hidden = isOn() && O.seat === 0;
    } else r.hidden = true;
  }
  function render() {
    q('#hdyn').innerHTML = dynMarkup();
    G.fx = null;
    renderStatus();
  }

  /* ---------- 설정 ---------- */
  function setDef() {
    const modes = [['ai', '컴퓨터'], ['local', '둘이서']];
    if (typeof Peer !== 'undefined') modes.push(['online', '온라인']);
    return [
      { key: 'mode', label: '상대', opts: modes },
      { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: () => hc.mode === 'ai' },
      { key: 'first', label: '선공', opts: [['me', '나(빨강)'], ['cpu', '컴퓨터(빨강)']], when: () => hc.mode === 'ai' },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#hsettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : hc[s.key];
      return '<div class="set"><span class="setlabel" id="hsl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="hsl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }

  /* ---------- 흐름 ---------- */
  function maybeAI() {
    if (hc.mode !== 'ai' || G.winner || G.busy || G.turn !== aiP()) return;
    const tk = gtok;
    G.busy = true; G.think = true;
    renderStatus();
    setTimeout(() => {
      if (tk !== gtok) return;
      const m = chooseMove(G.b, G.turn, hc.level);
      G.busy = false; G.think = false;
      if (m) doMove(m, false);
    }, 520);
  }
  function doMove(m, remote) {
    if (G.winner) return;
    const p = G.turn;
    G.hist.push({ b: G.b.slice(), turn: G.turn, moves: G.moves, last: G.last });
    G.b = apply(G.b, m); G.last = m; G.moves++; G.n++; G.fx = m[1]; G.sel = null; G.note = '';
    FX.drop();
    if (!movesOf(G.b, 3 - p).length) {
      G.winner = p; G.hideResult = false;
      const win = iWon(p);
      setTimeout(() => { if (win) { FX.win(); fxConfetti(); } else FX.lose(); }, 240);
    } else if (G.moves >= DRAW_AT) { G.winner = 3; }
    else G.turn = 3 - p;
    render();
    if (isOn() && !remote) pushDoc();
    maybeAI();
  }
  function undo() {
    if (isOn() || G.busy || !G.hist.length) return;
    gtok++;
    let h = G.hist.pop();
    if (hc.mode === 'ai' && h.turn === aiP() && G.hist.length) h = G.hist.pop();
    G.b = h.b; G.turn = h.turn; G.moves = h.moves; G.last = h.last;
    G.winner = 0; G.sel = null; G.note = ''; G.busy = false; G.think = false; G.hideResult = false;
    render();
    maybeAI();
  }
  function newGame() { reset(); render(); maybeAI(); }

  /* ---------- 입력: 말을 누르고, 갈 곳을 눌러요 ---------- */
  const bd = q('#hboard');
  function tapNode(i) {
    audio(); bgmSync();
    if (!humanTurn()) return;
    const v = G.b[i];
    if (G.sel !== null && legalFrom(G.sel).indexOf(i) >= 0) { doMove([G.sel, i], false); return; }
    if (v && own(v) === G.turn) {
      if (G.sel === i) G.sel = null;
      else if (legalFrom(i).length) { G.sel = i; FX.snap(); haptic('pick'); }
      else { G.sel = null; G.note = '이 말은 지금 갈 곳이 없어요. 다른 말을 눌러 보세요.'; }
      render();
      G.note = '';
    } else if (G.sel !== null) { G.sel = null; render(); }
  }
  bd.addEventListener('click', e => {
    const t = e.target.closest('[data-i]'); if (!t) return;
    tapNode(+t.dataset.i);
  });
  bd.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[data-i]'); if (!t) return;
    e.preventDefault(); tapNode(+t.dataset.i);
  });
  bd.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- 온라인 (PeerJS, 방장이 기준) ---------- */
  const PFXH = 'gogeon-hbk-';
  function docNow() { return { n: G.n, b: G.b.join(''), turn: G.turn, moves: G.moves, last: G.last, winner: G.winner, sw: O.sw, p2: O.isHost ? O.guestIn() : true }; }
  function netSendH(m, except) {
    if (O.isHost) { [O.guest].concat(O.watchers).forEach(c => { if (c !== except) sendTo(c, m); }); }
    else sendTo(O.conn, m);
  }
  function pushDoc() { const d = docNow(); if (O.isHost) O.doc = d; netSendH({ t: 'doc', d }); }
  function applyDocH(d) {
    G.b = String(d.b).split('').map(Number);
    G.turn = d.turn; G.moves = d.moves; G.last = d.last || null; G.winner = d.winner || 0;
    G.n = d.n; O.sw = d.sw || 0; G.sel = null; G.note = ''; G.busy = false; G.think = false; G.hideResult = false;
    G.hist = []; G.fx = G.last ? G.last[1] : null;
  }
  function onDocH(d) {
    if (d.n <= G.n) { if (d.sw !== O.sw) { O.sw = d.sw; render(); } return; }
    const fresh = d.moves === 0 || d.moves !== G.moves + 1;
    applyDocH(d);
    if (!fresh && G.last) { FX.pick(); setTimeout(() => FX.drop(), 40); }
    if (G.winner && G.winner !== 3) { const win = iWon(G.winner); setTimeout(() => { if (win) { FX.win(); fxConfetti(); } else FX.lose(); }, 240); }
    render(); renderOnline();
  }
  const inviteUrl = () => location.origin + location.pathname + '?h=' + O.code;
  function renderInvite() { Invite.render(q('#hinv'), { note: '나는 빨강(먼저 움직여요), 친구는 파랑이에요', avail: typeof Peer !== 'undefined', online: isOn(), busy: O.busy, code: O.code, host: O.isHost, oppOn: O.oppOn }); }
  async function inviteStart() {
    if (typeof Peer === 'undefined' || O.busy) return;
    if (!isOn()) { hc.mode = 'online'; store.set('cg.hobak.cfg', JSON.stringify(hc)); renderSet(); onMode(); }
    if (!O.code) await createRoomH();
    if (O.code && Invite.canShare()) Invite.share(inviteUrl());
  }
  function renderOnline() {
    renderInvite();
    const el = q('#honline');
    if (!isOn()) { el.hidden = true; return; }
    el.hidden = false;
    const old = q('#hCode');
    const keep = old ? old.value.replace(/[^a-z0-9]/gi, '').slice(0, 4) : '';
    let h = '<p class="olh">온라인 대전</p>';
    if (!O.code) {
      h += '<div class="row"><button type="button" class="btn primary" id="hNew"' + (O.busy ? ' disabled' : '') + '>새 방 만들기</button></div>' +
        '<div class="row olin"><input id="hCode" class="olinput" type="text" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="방 코드 4자리" value="' + keep + '">' +
        '<button type="button" class="btn" id="hJoin"' + (O.busy ? ' disabled' : '') + '>들어가기</button></div>' +
        '<p class="hint">한 사람이 방을 만들고 링크(또는 4자리 코드)를 보내면, 상대가 열어서 바로 들어와요. 방을 만든 사람이 페이지를 닫으면 방도 닫혀요.</p>';
    } else {
      const me = myColor();
      h += '<div class="olcodebox"><span class="olcode" id="hShown">' + O.code + '</span><button type="button" class="btn primary" id="hShare">공유하기</button><button type="button" class="btn" id="hCopy">링크 복사</button></div>' +
        '<p class="olst">내 말: ' + (me === 1 ? '빨강(먼저 움직여요)' : me === 2 ? '파랑' : '관람') + '</p>' +
        '<div class="row"><button type="button" class="btn" id="hLeave">방 나가기</button></div>';
    }
    if (O.err) h += '<p class="hint warn" role="alert">' + O.err + '</p>';
    el.innerHTML = h;
  }
  async function createRoomH() {
    if (O.busy) return;
    O.busy = true; O.err = ''; renderOnline();
    try {
      let peer = null, code = '';
      for (let i = 0; i < 6 && !peer; i++) {
        code = newCode('h');
        peer = await openPeer(PFXH + code).catch(e => { if (e && e.type === 'unavailable-id') return null; throw e; });
      }
      if (!peer) throw new Error('code');
      enterHostH(code, peer);
    } catch (e) { O.err = '방을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'; }
    O.busy = false; renderOnline();
  }
  function leaveH() {
    [O.guest, O.conn].concat(O.watchers || []).forEach(c => { try { if (c) c.close(); } catch (e) { /* 무시 */ } });
    if (O.peer) { try { O.peer.destroy(); } catch (e) { /* 무시 */ } }
    Object.assign(O, { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, seat: 0, oppOn: false });
  }
  function enterHostH(code, peer) {
    leaveH(); reset(); G.n = 0;
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
        if (m.t === 'doc' && m.d && m.d.n > G.n) { O.doc = m.d; netSendH({ t: 'doc', d: m.d }, c); onDocH(m.d); }
      });
      c.on('close', () => { if (c === O.guest) { O.oppOn = false; render(); renderOnline(); } });
    });
    render();
  }
  async function joinH(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (O.busy) return;
    if (!/^[a-z0-9]{4}$/.test(code)) { O.err = '방 코드는 4자리예요.'; renderOnline(); return; }
    O.busy = true; O.err = ''; renderOnline();
    Join.joining('hobak');
    let peer = null;
    try {
      peer = await openPeer(null);
      const hello = await new Promise((res, rej) => {
        const c = peer.connect(PFXH + code, { reliable: true });
        const t = setTimeout(() => rej(new Error('timeout')), 12000);
        peer.on('error', e => { clearTimeout(t); rej(e); });
        c.on('data', m => { if (m && m.t === 'hello') { clearTimeout(t); res({ c, m }); } });
        c.on('error', e => { clearTimeout(t); rej(e); });
      });
      enterGuestH(code, peer, hello.c, hello.m);
      Join.joined('hobak', myColor());
    } catch (e) {
      try { if (peer) peer.destroy(); } catch (x) { /* 무시 */ }
      Join.failed('hobak', code, e && e.type === 'peer-unavailable' ? 'gone' : 'net', () => joinH(code));
      O.err = e && e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : '방에 연결하지 못했어요. 방장이 페이지를 열어 둔 상태인지 확인해 주세요.';
    }
    O.busy = false; renderOnline();
  }
  function enterGuestH(code, peer, c, hello) {
    leaveH(); reset(); G.n = -1;
    Object.assign(O, { code, peer, isHost: false, conn: c, seat: hello.seat, oppOn: true });
    c.on('data', m => { if (m && m.t === 'doc' && m.d) onDocH(m.d); });
    c.on('close', () => { const mine = O.conn === c; O.oppOn = false; O.err = '방장과 연결이 끊어졌어요. 방을 나갔다가 다시 들어와 보세요.'; renderOnline(); renderStatus(); if (mine) Join.closed('hobak', code, () => joinH(code), () => { leaveH(); reset(); render(); renderOnline(); }); });
    peer.on('error', () => { O.err = '연결에 문제가 생겼어요.'; renderOnline(); });
    Beat.guest(c, peer);
    O.sw = hello.doc.sw || 0;
    G.n = -1; onDocH(hello.doc); G.n = hello.doc.n;
    render(); renderOnline();
  }
  function newGameH() {
    if (!O.code || O.seat === 0) return;
    const btn = q('#hagain');
    if (G.moves > 0 && !G.winner && !G.confirmNew) {
      G.confirmNew = true; btn.textContent = '한 번 더 누르면 새 판';
      setTimeout(() => { G.confirmNew = false; btn.textContent = '새 게임'; }, 3000);
      return;
    }
    G.confirmNew = false; btn.textContent = '새 게임';
    const n = G.n + 1, sw = O.sw ? 0 : 1;
    reset(); G.n = n; O.sw = sw; // 새 판마다 빨강과 파랑을 서로 바꿔요
    render(); renderOnline();
    pushDoc();
  }

  /* ---------- 연결 ---------- */
  function onMode() {
    if (isOn()) { leaveH(); reset(); render(); renderOnline(); }
    else { leaveH(); newGame(); renderOnline(); }
  }
  q('#hbk').addEventListener('click', () => show('hub'));
  q('#hundo').addEventListener('click', undo);
  q('#hagain').addEventListener('click', () => { if (isOn()) newGameH(); else newGame(); });
  q('#hrAgain').addEventListener('click', () => { if (isOn()) newGameH(); else newGame(); });
  q('#hrView').addEventListener('click', () => { G.hideResult = true; renderStatus(); });
  q('#hsettings').addEventListener('click', e => {
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
    hc[b.dataset.k] = b.dataset.v;
    store.set('cg.hobak.cfg', JSON.stringify(hc));
    renderSet();
    if (b.dataset.k === 'mode') onMode(); else newGame();
  });
  q('#honline').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'hNew') createRoomH();
    else if (b.id === 'hJoin') joinH(q('#hCode').value);
    else if (b.id === 'hShare') Invite.share(inviteUrl(), b);
    else if (b.id === 'hCopy') {
      const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '링크 복사'; }, 1500); };
      try { navigator.clipboard.writeText(inviteUrl()).then(done, () => {}); } catch (err) { /* 무시 */ }
    } else if (b.id === 'hLeave') { leaveH(); reset(); render(); renderOnline(); }
  });
  q('#hinv').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'start') inviteStart();
    else if (b.dataset.act === 'share') Invite.share(inviteUrl(), b);
  });
  q('#honline').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'hCode') joinH(e.target.value); });

  window.hobakSettings = function () { renderSet(); };
  window.hobakJoin = function (code) { hc.mode = 'online'; show('hobak'); joinH(code); };
  window.hobakEnter = function () {
    renderSet();
    if (wantOnlineH) { wantOnlineH = false; if (typeof Peer !== 'undefined') { hc.mode = 'online'; renderSet(); onMode(); return; } }
    if (isOn() && typeof Peer === 'undefined') { hc.mode = 'ai'; newGame(); renderOnline(); return; }
    render(); renderOnline(); maybeAI();
  };
  window.hobakLeave = function () { gtok++; G.busy = false; G.think = false; G.sel = null; };

  /* 초기화 */
  drawBg();
  reset();
  try {
    const r = new URLSearchParams(location.search).get('h');
    if (r && /^[a-z0-9]{4}$/i.test(r) && typeof Peer !== 'undefined') {
      Join.setOrigin('link');
      Join.joining('hobak');
      hc.mode = 'online';
      show('hobak');
      joinH(r.toLowerCase());
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
    }
  } catch (e) { /* 무시 */ }
})();
