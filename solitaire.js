/* ===== 솔리테어 (클론다이크) : 혼자 하는 카드 게임 =====
   탭하면 알아서 옮겨 주고, 끌어서 원하는 곳에 놓을 수도 있어요. 1장 뽑기 / 3장 뽑기. */
(function () {
  const q = (s, r) => (r || document).querySelector(s);
  const SUITS = ['♠', '♥', '♣', '♦'];
  const isRed = s => s === 1 || s === 3;
  const RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ---------- 상태 ---------- */
  let sc = { draw: 1 };
  try { Object.assign(sc, JSON.parse(store.get('cg.sol.cfg') || '{}')); } catch (e) { /* 기본값 */ }
  let G = null;
  let LAY = null;
  let dr = null;
  let timer = 0, auto = 0, bump = 0;

  const emptyG = () => ({ stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], hist: [], moves: 0, sec: 0, started: false, won: false, draw: sc.draw, hide: false });
  function deal() {
    const g = emptyG();
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, u: false });
    for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const cd = deck.pop(); cd.u = k === c; g.tab[c].push(cd); }
    g.stock = deck;
    return g;
  }
  const pileOf = id => id === 's' ? G.stock : id === 'w' ? G.waste : id[0] === 'f' ? G.found[+id[1]] : G.tab[+id[1]];
  const snap = () => JSON.stringify({ stock: G.stock, waste: G.waste, found: G.found, tab: G.tab, moves: G.moves });
  function pushHist() { G.hist.push(snap()); if (G.hist.length > 300) G.hist.shift(); }
  function save() {
    try { store.set('cg.sol.game', JSON.stringify({ stock: G.stock, waste: G.waste, found: G.found, tab: G.tab, moves: G.moves, sec: G.sec, started: G.started, won: G.won, draw: G.draw })); } catch (e) { /* 무시 */ }
  }
  function load() {
    try {
      const d = JSON.parse(store.get('cg.sol.game') || 'null');
      if (!d || !Array.isArray(d.tab) || d.tab.length !== 7 || !Array.isArray(d.found) || d.found.length !== 4) return null;
      const n = d.stock.length + d.waste.length + d.found.reduce((a, b) => a + b.length, 0) + d.tab.reduce((a, b) => a + b.length, 0);
      if (n !== 52) return null;
      const g = emptyG();
      Object.assign(g, { stock: d.stock, waste: d.waste, found: d.found, tab: d.tab, moves: d.moves | 0, sec: d.sec | 0, started: !!d.started, won: !!d.won, draw: d.draw === 3 ? 3 : 1 });
      return g;
    } catch (e) { return null; }
  }

  /* ---------- 규칙 ---------- */
  function canTab(stack, dest) {
    const c = stack[0], top = dest[dest.length - 1];
    if (!top) return c.r === 13;
    return top.u && isRed(top.s) !== isRed(c.s) && top.r === c.r + 1;
  }
  function canFound(c, pile) {
    const top = pile[pile.length - 1];
    return top ? top.s === c.s && top.r === c.r - 1 : c.r === 1;
  }
  function stackAt(pid, i) {
    const p = pileOf(pid);
    if (pid === 's') return null;
    if (i < 0 || i >= p.length) return null;
    if (pid === 'w' || pid[0] === 'f') return i === p.length - 1 ? [p[i]] : null;
    if (!p[i].u) return null;
    return p.slice(i);
  }
  function applyMove(from, i, to) {
    const src = pileOf(from), dst = pileOf(to);
    const moved = src.splice(i, src.length - i);
    dst.push.apply(dst, moved);
    if (from[0] === 't' && src.length && !src[src.length - 1].u) src[src.length - 1].u = true;
  }
  function tryMove(from, i, to) {
    const stack = stackAt(from, i);
    if (!stack || from === to) return false;
    if (to[0] === 'f') { if (stack.length !== 1 || !canFound(stack[0], G.found[+to[1]]) || G.found[+to[1]] === pileOf(from)) return false; }
    else if (to[0] === 't') { if (!canTab(stack, G.tab[+to[1]])) return false; }
    else return false;
    pushHist();
    applyMove(from, i, to);
    afterMove(true);
    return true;
  }
  function afterMove(counts) {
    if (counts) G.moves++;
    G.started = true; G.hide = false;
    if (G.found.every(f => f.length === 13) && !G.won) {
      G.won = true;
      setTimeout(() => { FX.win(); confetti(); }, 200);
    } else FX.drop();
    save(); render();
  }
  /* 탭하면: 먼저 위 칸(A부터 쌓는 곳)으로, 안 되면 놓을 수 있는 줄로 */
  function autoPlace(from, i) {
    const stack = stackAt(from, i);
    if (!stack) return false;
    if (stack.length === 1) {
      const f = stack[0].s;
      if (from !== 'f' + f && canFound(stack[0], G.found[f])) return tryMove(from, i, 'f' + f);
    }
    let pick = null;
    for (let c = 0; c < 7; c++) {
      const id = 't' + c;
      if (id === from) continue;
      const dst = G.tab[c];
      if (!canTab(stack, dst)) continue;
      if (!dst.length && from[0] === 't' && i === 0) continue; // 맨 아래 K를 빈 줄로 옮기는 건 의미가 없어요
      if (dst.length) { pick = id; break; }
      if (!pick) pick = id;
    }
    if (pick) return tryMove(from, i, pick);
    return false;
  }
  function drawStock() {
    if (G.won) return;
    if (G.stock.length) {
      pushHist();
      for (let k = 0; k < G.draw && G.stock.length; k++) { const c = G.stock.pop(); c.u = true; G.waste.push(c); }
      FX.pick(); afterMoveQuiet();
    } else if (G.waste.length) {
      pushHist();
      G.stock = G.waste.reverse(); G.stock.forEach(c => { c.u = false; }); G.waste = [];
      FX.snap(); afterMoveQuiet();
    }
  }
  function afterMoveQuiet() { G.moves++; G.started = true; G.hide = false; save(); render(); }
  function undo() {
    if (!G.hist.length || G.won) return;
    stopAuto();
    const d = JSON.parse(G.hist.pop());
    Object.assign(G, { stock: d.stock, waste: d.waste, found: d.found, tab: d.tab, moves: d.moves });
    FX.snap(); save(); render();
  }
  function newGame() {
    stopAuto();
    const keep = sc.draw;
    G = deal(); G.draw = keep;
    save(); render();
  }
  const canAutoFinish = () => !G.won && !G.stock.length && !G.waste.length && G.tab.every(col => col.every(c => c.u)) && !G.found.every(f => f.length === 13);
  function stopAuto() { if (auto) { clearInterval(auto); auto = 0; } }
  function autoFinish() {
    if (auto || !canAutoFinish()) return;
    auto = setInterval(() => {
      if (!G || G.won) { stopAuto(); return; }
      let moved = false;
      const srcs = ['w', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
      for (const id of srcs) {
        const p = pileOf(id);
        if (!p.length) continue;
        const c = p[p.length - 1];
        if (canFound(c, G.found[c.s])) { tryMove(id, p.length - 1, 'f' + c.s); moved = true; break; }
      }
      if (!moved) stopAuto();
    }, 130);
  }

  /* ---------- 자리 계산 ---------- */
  function layout() {
    const wrap = q('#solfield');
    const W = Math.max(280, Math.min((wrap.parentNode.clientWidth - 20) || 340, 560));
    const g = Math.max(4, Math.round(W * 0.014));
    const cw = Math.floor((W - 6 * g) / 7), ch = Math.round(cw * 1.4);
    LAY = { W: cw * 7 + 6 * g, g, cw, ch, dd: Math.round(ch * 0.17), du: Math.round(ch * 0.3), tabY: ch + g * 3 };
  }
  const X = c => c * (LAY.cw + LAY.g);
  function tabYs(col) {
    const ys = []; let y = LAY.tabY;
    col.forEach(c => { ys.push(y); y += c.u ? LAY.du : LAY.dd; });
    return ys;
  }
  function boardH() {
    let h = LAY.tabY + LAY.ch;
    G.tab.forEach(col => { if (col.length) { const ys = tabYs(col); h = Math.max(h, ys[ys.length - 1] + LAY.ch); } });
    return h + 8;
  }
  function cardPos(pid, i) {
    if (pid === 's') return { x: X(0), y: 0 };
    if (pid === 'w') {
      const n = G.waste.length, show = Math.min(G.draw, n), k = i - (n - show);
      return { x: X(1) + (G.draw === 3 && k > 0 ? k * Math.round(LAY.cw * 0.24) : 0), y: 0 };
    }
    if (pid[0] === 'f') return { x: X(3 + +pid[1]), y: 0 };
    const c = +pid[1];
    return { x: X(c), y: tabYs(G.tab[c])[i] };
  }

  /* ---------- 그리기 ---------- */
  function cardHTML(c, pid, i, pos, z) {
    const st = 'left:' + pos.x + 'px;top:' + pos.y + 'px;width:' + LAY.cw + 'px;height:' + LAY.ch + 'px;z-index:' + z + ';font-size:' + Math.round(LAY.cw * 0.3) + 'px';
    if (!c.u) return '<div class="scard dn" data-p="' + pid + '" data-i="' + i + '" style="' + st + '"></div>';
    return '<div class="scard up ' + (isRed(c.s) ? 'rd' : 'bk') + '" data-p="' + pid + '" data-i="' + i + '" style="' + st + '">' +
      '<span class="cr">' + RK[c.r] + '<i>' + SUITS[c.s] + '</i></span><span class="cs">' + SUITS[c.s] + '</span></div>';
  }
  function slotHTML(pid, x, y, inner, cls) {
    return '<div class="sslot ' + (cls || '') + '" data-p="' + pid + '" style="left:' + x + 'px;top:' + y + 'px;width:' + LAY.cw + 'px;height:' + LAY.ch + 'px;font-size:' + Math.round(LAY.cw * 0.5) + 'px">' + inner + '</div>';
  }
  function render() {
    if (!G) return;
    layout();
    let h = '';
    h += slotHTML('s', X(0), 0, G.stock.length ? '' : '<span class="rec">↻</span>', 'stk');
    h += slotHTML('w', X(1), 0, '');
    for (let f = 0; f < 4; f++) h += slotHTML('f' + f, X(3 + f), 0, '<span class="fs ' + (isRed(f) ? 'rd' : 'bk') + '">' + SUITS[f] + '</span>');
    for (let c = 0; c < 7; c++) h += slotHTML('t' + c, X(c), LAY.tabY, '<span class="fs k">K</span>');
    if (G.stock.length) h += cardHTML(G.stock[G.stock.length - 1], 's', G.stock.length - 1, cardPos('s', 0), 1);
    const wn = G.waste.length, ws = Math.max(0, wn - Math.min(G.draw, wn));
    for (let i = ws; i < wn; i++) h += cardHTML(G.waste[i], 'w', i, cardPos('w', i), i - ws + 1);
    for (let f = 0; f < 4; f++) {
      const p = G.found[f];
      if (p.length) h += cardHTML(p[p.length - 1], 'f' + f, p.length - 1, cardPos('f' + f, 0), 1);
    }
    for (let c = 0; c < 7; c++) { const ys = tabYs(G.tab[c]); G.tab[c].forEach((cd, i) => { h += cardHTML(cd, 't' + c, i, { x: X(c), y: ys[i] }, i + 1); }); }
    const f = q('#solfield');
    f.style.width = LAY.W + 'px'; f.style.height = boardH() + 'px';
    f.innerHTML = h;
    renderStatus();
  }
  const fmt = s => ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
  function renderStatus() {
    q('#solcount').textContent = G.moves + '번 이동 · ' + fmt(G.sec);
    q('#solundo').disabled = !G.hist.length || G.won;
    const fin = canAutoFinish();
    q('#solauto').hidden = !fin;
    const done = G.found.reduce((a, b) => a + b.length, 0);
    q('#solsay').textContent = G.won ? '모든 카드를 쌓았어요!' : fin ? '남은 카드는 자동으로 쌓을 수 있어요.' : done ? '위 칸에 ' + done + '장을 쌓았어요.' : '카드를 눌러 옮기거나 끌어서 놓아요.';
    const r = q('#solresult');
    if (G.won && !G.hide) {
      r.hidden = false;
      q('#solrsub').textContent = G.moves + '번 이동, ' + fmt(G.sec) + ' 걸렸어요.';
    } else r.hidden = true;
  }
  function confetti() {
    if (reduceMotion) return;
    const f = q('#solfield'); if (!f) return;
    const cols = ['#CC785C', '#4F7DBF', '#E8A55A', '#FAF9F5', '#5DB8A6'];
    for (let k = 0; k < 48; k++) {
      const d = document.createElement('div');
      const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 160;
      d.className = 'sconf'; d.style.left = LAY.W / 2 + 'px'; d.style.top = '160px'; d.style.background = cols[k % cols.length];
      d.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      d.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 60) + 'px');
      d.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      f.appendChild(d); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1600);
    }
  }

  /* ---------- 입력: 탭하면 자동으로, 끌면 원하는 곳에 ---------- */
  const field = q('#solfield');
  function dropTargets() {
    const out = [];
    for (let f = 0; f < 4; f++) out.push({ id: 'f' + f, x: X(3 + f), y: 0, w: LAY.cw, h: LAY.ch });
    for (let c = 0; c < 7; c++) {
      const col = G.tab[c], ys = tabYs(col), bottom = col.length ? ys[ys.length - 1] + LAY.ch : LAY.tabY + LAY.ch;
      out.push({ id: 't' + c, x: X(c), y: LAY.tabY, w: LAY.cw, h: bottom - LAY.tabY });
    }
    return out;
  }
  function startDrag(e) {
    const stack = dr.stack, p0 = cardPos(dr.p, dr.i);
    const n = stack.length;
    const el = document.createElement('div');
    el.id = 'soldrag'; el.style.cssText = 'left:' + p0.x + 'px;top:' + p0.y + 'px;width:' + LAY.cw + 'px;height:0';
    stack.forEach((c, k) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = cardHTML(c, dr.p, dr.i + k, { x: 0, y: k * LAY.du }, k + 1);
      el.appendChild(tmp.firstChild);
    });
    field.appendChild(el);
    field.querySelectorAll('.scard').forEach(c => {
      if (c.parentNode === field && c.dataset.p === dr.p && +c.dataset.i >= dr.i) c.style.visibility = 'hidden';
    });
    dr.el = el; dr.p0 = p0; dr.drag = true;
    FX.pick(); haptic('pick');
  }
  field.addEventListener('pointerdown', e => {
    if (e.button > 0 || !G || G.won || auto) return;
    audio(); bgmSync();
    const el = e.target.closest('[data-p]'); if (!el) return;
    const p = el.dataset.p, i = el.dataset.i === undefined ? -1 : +el.dataset.i;
    dr = { p, i, x0: e.clientX, y0: e.clientY, id: e.pointerId, drag: false, stack: stackAt(p, i) };
    try { field.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  });
  field.addEventListener('pointermove', e => {
    if (!dr || e.pointerId !== dr.id) return;
    const dx = e.clientX - dr.x0, dy = e.clientY - dr.y0;
    if (!dr.drag) {
      if (!dr.stack || Math.hypot(dx, dy) < 7) return;
      startDrag(e);
    }
    dr.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    dr.dx = dx; dr.dy = dy;
  });
  function endPointer(e, cancel) {
    if (!dr || e.pointerId !== dr.id) return;
    const d = dr; dr = null;
    try { field.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    if (d.drag) {
      if (!cancel) {
        const rx = d.p0.x + (d.dx || 0), ry = d.p0.y + (d.dy || 0);
        const cand = dropTargets().map(t => {
          const ox = Math.max(0, Math.min(rx + LAY.cw, t.x + t.w) - Math.max(rx, t.x));
          const oy = Math.max(0, Math.min(ry + LAY.ch, t.y + t.h) - Math.max(ry, t.y));
          return { id: t.id, a: ox * oy };
        }).filter(t => t.a > LAY.cw * LAY.ch * 0.18).sort((a, b) => b.a - a.a);
        for (const t of cand) { if (tryMove(d.p, d.i, t.id)) return; }
      }
      render(); // 못 놓으면 제자리로
      return;
    }
    if (cancel) return;
    if (d.p === 's') drawStock();
    else if (d.stack) { if (!autoPlace(d.p, d.i)) { FX.snap(); wiggle(d.p, d.i); } }
  }
  function wiggle(p, i) {
    if (reduceMotion) return;
    const el = field.querySelector('.scard[data-p="' + p + '"][data-i="' + i + '"]');
    if (el) { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); }
  }
  field.addEventListener('pointerup', e => endPointer(e, false));
  field.addEventListener('pointercancel', e => endPointer(e, true));
  field.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- 설정 ---------- */
  function setDef() {
    return [
      { key: 'draw', label: '뽑기', opts: [[1, '1장'], [3, '3장']] },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#solsettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : sc[s.key];
      return '<div class="set"><span class="setlabel" id="solsl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="solsl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }
  q('#solsettings').addEventListener('click', e => {
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
    const v = +b.dataset.v;
    if (sc.draw === v) return;
    sc.draw = v;
    store.set('cg.sol.cfg', JSON.stringify(sc));
    renderSet(); newGame();
  });

  /* ---------- 연결 ---------- */
  let confirmNew = false;
  function askNew() {
    const btn = q('#solnew');
    if (G.moves > 4 && !G.won && !confirmNew) {
      confirmNew = true; btn.textContent = '한 번 더 누르면 새 판';
      setTimeout(() => { confirmNew = false; btn.textContent = '새 게임'; }, 3000);
      return;
    }
    confirmNew = false; btn.textContent = '새 게임'; newGame();
  }
  q('#solbk').addEventListener('click', () => show('hub'));
  q('#solundo').addEventListener('click', undo);
  q('#solauto').addEventListener('click', autoFinish);
  q('#solnew').addEventListener('click', askNew);
  q('#solrAgain').addEventListener('click', newGame);
  q('#solrView').addEventListener('click', () => { G.hide = true; renderStatus(); });
  window.addEventListener('resize', () => { if (G && view === 'solitaire') render(); });

  window.solitaireSettings = function () { renderSet(); };
  window.solitaireEnter = function () {
    renderSet();
    if (!G) G = load() || deal();
    if (G.draw !== sc.draw && !G.started) G.draw = sc.draw;
    render();
    clearInterval(timer);
    timer = setInterval(() => { if (G && G.started && !G.won && view === 'solitaire') { G.sec++; q('#solcount').textContent = G.moves + '번 이동 · ' + fmt(G.sec); if (G.sec % 5 === 0) save(); } }, 1000);
  };
  window.solitaireLeave = function () { clearInterval(timer); timer = 0; stopAuto(); dr = null; if (G) save(); };
  window.__sol = { get g() { return G; }, render: () => render() };
})();
