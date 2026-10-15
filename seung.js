/* ===== 승경도 (조선 관직 말판 놀이, 현대식으로 다듬은 규칙): 컴퓨터 / 둘이서 / 온라인 ===== */
(function () {
  const q = (s, r) => (r || document).querySelector(s);
  const NT = 18, GOAL = 17, COLS = 6;
  const TW = 54, TH = 74, GX = 6, GY = 8, MX = 3, MY = 6;
  const TILES = [['종9품', '참봉'], ['정9품', '정자'], ['종8품', '봉사'], ['정8품', '저작'], ['종7품', '직장'], ['정7품', '박사'],
    ['종6품', '현감'], ['정6품', '좌랑'], ['종5품', '현령'], ['정5품', '지평'], ['종4품', '군수'], ['정4품', '장령'],
    ['종3품', '부사'], ['정3품', '승지'], ['종2품', '참판'], ['정2품', '판서'], ['종1품', '좌찬성'], ['정1품', '영의정']];
  /* 칸 번호 → 일어나는 일. up/dn: 이동, skip: 한 차례 쉼, tok: 상소 +1 */
  const EV = {
    2: { k: 'up', n: 3, t: '암행어사', s: '+3', say: '암행어사로 발탁! 3칸 더 올라요.' },
    5: { k: 'dn', n: -2, t: '탄핵', s: '−2', say: '탄핵을 당했어요. 2칸 물러나요.' },
    7: { k: 'up', n: 2, t: '특진', s: '+2', say: '특진! 2칸 더 올라요.' },
    9: { k: 'skip', t: '귀양', s: '쉼', say: '귀양을 가요. 다음 차례는 쉬어요.' },
    11: { k: 'dn', n: -4, t: '파직', s: '−4', say: '파직! 4칸 물러나요.' },
    13: { k: 'tok', t: '어명', s: '상소+1', say: '어명이 내렸어요. 상소가 하나 늘어요.' },
    15: { k: 'dn', n: -3, t: '사약', s: '−3', say: '사약이 내려왔어요! 3칸 물러나요.' }
  };
  const gradeNo = i => +TILES[i][0][1];
  const tierColor = i => { const g = gradeNo(i); return g >= 7 ? '#4F7DBF' : g >= 5 ? '#5DB8A6' : g >= 3 ? '#C98A3A' : '#A9583E'; };
  const tilePos = i => {
    const r = (i / COLS) | 0, c0 = i % COLS, col = r % 2 === 0 ? c0 : COLS - 1 - c0;
    return { x: MX + col * (TW + GX), y: MY + (2 - r) * (TH + GY), r, col };
  };
  const ctr = i => { const p = tilePos(i); return { x: p.x + TW / 2, y: p.y + TH / 2 }; };
  const tileName = i => TILES[i][0] + ' ' + TILES[i][1];

  /* ---------- 상태 ---------- */
  let sc = { mode: 'ai', level: 'normal', first: 'me' };
  try { Object.assign(sc, JSON.parse(store.get('cg.seung.cfg') || '{}')); } catch (e) { /* 기본값 */ }
  let wantOnlineS = false;
  if (sc.mode === 'online') { wantOnlineS = true; sc.mode = 'ai'; }
  const G = {};
  let gtok = 0;
  const O = { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], seat: 0, sw: 0, oppOn: false, err: '', busy: false };
  const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return w + ((c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0) ? a : b); };
  const isOn = () => sc.mode === 'online';
  const aiP = () => sc.first === 'cpu' ? 1 : 2;
  O.guestIn = () => O.isHost ? !!(O.guest && O.guest.open) : !!(O.conn && O.conn.open);
  const myP = () => O.seat;

  function reset() {
    gtok++;
    G.pos = [0, 0, 0]; G.vis = [0, 0, 0]; G.tok = [0, 2, 2]; G.skip = [0, 0, 0];
    G.turn = isOn() ? (O.sw ? 2 : 1) : 1; G.phase = 'roll'; G.roll = 0; G.winner = 0;
    G.last = null; G.lid = 0; G.played = 0; G.moves = 0; G.queue = []; G.anim = false;
    G.note = ''; G.hideResult = false; G.confirmNew = false; G.rolling = false; G.shownRoll = 0;
    if (G.n === undefined) G.n = 0;
    placeTokens(false);
  }
  G.n = 0;
  const name = p => {
    if (sc.mode === 'ai') return p === aiP() ? '컴퓨터' : '나';
    if (isOn() && O.seat > 0) return p === myP() ? '나' : '상대';
    return p === 1 ? '홍' : '청';
  };
  const humanTurn = () => {
    if (G.winner || G.anim) return false;
    if (isOn()) return O.seat > 0 && O.guestIn() && G.turn === myP();
    if (sc.mode === 'ai') return G.turn !== aiP();
    return true;
  };
  const iWon = w => sc.mode === 'ai' ? w !== aiP() : (isOn() && O.seat > 0 ? w === myP() : true);

  /* ---------- 규칙 (방장/단독 기기에서만 실행) ---------- */
  const rollDie = () => 1 + ((Math.random() * 5) | 0);
  function sim(pos, who, roll) {
    const opp = 3 - who, from = pos[who], to1 = Math.min(GOAL, from + roll);
    let to2 = to1, ev = null, skip = false, tok = 0, bump = null;
    if (to1 < GOAL && EV[to1]) {
      ev = to1; const e = EV[to1];
      if (e.k === 'up') to2 = Math.min(GOAL, to1 + e.n);
      else if (e.k === 'dn') to2 = Math.max(0, to1 + e.n);
      else if (e.k === 'skip') skip = true;
      else if (e.k === 'tok') tok = 1;
    }
    if (to2 < GOAL && to2 > 0 && pos[opp] === to2) bump = { from: pos[opp], to: Math.max(0, pos[opp] - 2) };
    return { from, to1, to2, ev, skip, tok, bump, win: to2 >= GOAL };
  }
  function hostAct(a, who) {
    if (G.winner || who !== G.turn) return false;
    if (a === 'roll' && G.phase === 'roll') {
      G.roll = rollDie(); G.phase = 'choose';
      G.last = { id: ++G.lid, who, k: 'roll', roll: G.roll };
    } else if (a === 'reroll' && G.phase === 'choose' && G.tok[who] > 0) {
      G.tok[who]--; G.roll = rollDie();
      G.last = { id: ++G.lid, who, k: 'reroll', roll: G.roll };
    } else if (a === 'move' && G.phase === 'choose') {
      const r = sim(G.pos, who, G.roll), opp = 3 - who;
      G.pos[who] = r.to2;
      if (r.skip) G.skip[who] = 1;
      if (r.tok) G.tok[who] += 1;
      if (r.bump) G.pos[opp] = r.bump.to;
      G.moves++;
      const last = { id: ++G.lid, who, k: 'move', roll: G.roll, from: r.from, to1: r.to1, to2: r.to2, ev: r.ev, bump: r.bump, skipped: 0 };
      G.roll = 0;
      if (r.win) { G.winner = who; G.phase = 'roll'; }
      else {
        let nt = opp;
        if (G.skip[nt] > 0) { G.skip[nt]--; last.skipped = nt; nt = who; }
        G.turn = nt; G.phase = 'roll';
      }
      G.last = last;
    } else return false;
    G.n++;
    return true;
  }

  /* ---------- 컴퓨터 ---------- */
  function valueOf(pos, tok, who, roll) {
    const r = sim(pos, who, roll);
    if (r.win) return 1000;
    let v = r.to2 * 1.0;
    if (r.bump) v += 2.2 + (r.bump.from - r.bump.to) * 0.2;
    if (r.skip) v -= 2.6;
    if (r.tok) v += 1.4;
    /* 곧 닿을 위험한 칸(뒤로 밀리는 칸)이 앞에 있으면 조금 감점 */
    for (let k = 1; k <= 5; k++) { const e = EV[Math.min(GOAL, r.to2 + k)]; if (e && e.k === 'dn') v -= 0.12; }
    return v;
  }
  function aiShouldReroll(who) {
    if (G.tok[who] <= 0) return false;
    const lvl = sc.level;
    if (lvl === 'easy') return Math.random() < 0.18;
    const cur = valueOf(G.pos, G.tok, who, G.roll);
    if (cur >= 1000) return false;
    let ev = 0; for (let r = 1; r <= 5; r++) ev += Math.min(valueOf(G.pos, G.tok, who, r), 40) / 5;
    const cost = lvl === 'hard' ? (G.pos[who] >= 11 ? 0.5 : 1.3) : 1.9;
    return cur < ev - cost;
  }
  function maybeAI() {
    if (sc.mode !== 'ai' || G.winner || G.anim || G.turn !== aiP()) return;
    const tk = gtok, who = G.turn;
    G.busy = true; renderStatus();
    if (G.phase === 'roll') {
      setTimeout(() => { if (tk === gtok) { G.busy = false; perform('roll', who); } }, 600);
    } else {
      setTimeout(() => {
        if (tk !== gtok) return;
        G.busy = false;
        perform(aiShouldReroll(who) ? 'reroll' : 'move', who);
      }, 700);
    }
  }

  /* ---------- 문장 ---------- */
  function noteFor(l) {
    if (!l) return '';
    const nm = name(l.who);
    if (l.k === 'roll') return nm + ': 윤목이 ' + l.roll + '!';
    if (l.k === 'reroll') return nm + ': 상소로 다시 굴렸더니 윤목이 ' + l.roll + '!';
    let t = nm + ': ' + l.roll + '칸 나아가 ' + tileName(l.to1) + '에 올랐어요.';
    if (l.ev !== null && EV[l.ev]) t += ' ' + EV[l.ev].say;
    if (l.bump) t += ' 같은 칸의 ' + josa(name(3 - l.who), '을', '를') + ' 2칸 뒤로 밀어냈어요.';
    if (l.skipped) t += ' ' + josa(name(l.skipped), '은', '는') + ' 귀양 중이라 이번 차례를 쉬어요.';
    return t;
  }
  function sayText() {
    if (G.winner) {
      if (sc.mode === 'ai' || (isOn() && O.seat > 0)) return iWon(G.winner) ? '영의정에 올랐어요! ' + G.moves + '번 만에 정1품이 되었어요.' : josa(name(G.winner), '이', '가') + ' 먼저 영의정에 올랐어요.';
      return name(G.winner) + ' 영의정 등극! ' + G.moves + '번 만에 끝났어요.';
    }
    if (isOn()) {
      if (!O.code) return '방을 만들거나 코드를 입력해 주세요.';
      if (O.seat === 0) return '관람 중이에요. ' + name(G.turn) + ' 차례예요.';
      if (!O.guestIn()) return '상대를 기다리는 중이에요. 방 코드 ' + O.code + ' 를 알려 주세요.';
    }
    if (G.note) return G.note;
    if (G.busy && sc.mode === 'ai' && G.turn === aiP()) return '컴퓨터가 생각하는 중…';
    if (humanTurn()) return G.phase === 'roll' ? '내 차례예요. 윤목을 굴려 보세요.' : '윤목이 ' + G.roll + '이에요. 이동하거나 상소로 다시 굴려요.';
    return name(G.turn) + ' 차례예요.';
  }

  /* ---------- 그리기 ---------- */
  function drawBg() {
    let s = '<rect x="0" y="0" width="360" height="258" rx="14" class="sbase"/>';
    let d = '';
    for (let i = 0; i < NT; i++) { const c = ctr(i); d += (i ? 'L' : 'M') + c.x + ' ' + c.y; }
    s += '<path d="' + d + '" class="spath"/>';
    for (let i = 0; i < NT; i++) {
      const p = tilePos(i), e = EV[i], col = tierColor(i);
      s += '<g class="stile' + (i === GOAL ? ' goal' : '') + '" id="st' + i + '">' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + TW + '" height="' + TH + '" rx="7" class="stbody"/>' +
        '<path d="M' + (p.x + 7) + ' ' + p.y + 'h' + (TW - 14) + 'a7 7 0 0 1 7 7v7h-' + TW + 'v-7a7 7 0 0 1 7 -7z" fill="' + col + '"/>' +
        '<text x="' + (p.x + TW / 2) + '" y="' + (p.y + 11) + '" class="stgr">' + TILES[i][0] + '</text>' +
        '<text x="' + (p.x + TW / 2) + '" y="' + (p.y + 31) + '" class="stnm">' + TILES[i][1] + '</text>';
      if (e) s += '<rect x="' + (p.x + 3) + '" y="' + (p.y + TH - 19) + '" width="' + (TW - 6) + '" height="16" rx="5" class="stev ' + (e.k === 'up' || e.k === 'tok' ? 'good' : 'bad') + '"/>' +
        '<text x="' + (p.x + TW / 2) + '" y="' + (p.y + TH - 7.5) + '" class="stevt">' + e.t + ' ' + e.s + '</text>';
      if (i === 0) s += '<text x="' + (p.x + TW / 2) + '" y="' + (p.y + TH - 7) + '" class="stflag">출발</text>';
      if (i === GOAL) s += '<text x="' + (p.x + TW / 2) + '" y="' + (p.y + TH - 7) + '" class="stflag goalt">도착!</text>';
      s += '</g>';
    }
    q('#sbg').innerHTML = s;
    q('#stok').innerHTML = [1, 2].map(p =>
      '<g class="stk" id="stk' + p + '"><ellipse class="stsh" cx="1.5" cy="5" rx="11" ry="5.2"/><circle r="11.5" class="spc' + p + '"/><circle r="11.5" fill="url(#gSGl)"/>' +
      '<ellipse cx="-3.6" cy="-4.6" rx="3.8" ry="2.1" transform="rotate(-32 -3.6 -4.6)" class="sshine"/></g>').join('');
  }
  function placeTokens() {
    for (let p = 1; p <= 2; p++) {
      const el = q('#stk' + p); if (!el) continue;
      const c = ctr(G.vis[p]), same = G.vis[1] === G.vis[2];
      const off = same ? (p === 1 ? -12 : 12) : 0;
      el.style.transform = 'translate(' + (c.x + off) + 'px,' + (c.y + 10) + 'px)';
    }
  }
  function flashTile(i, cls) {
    const el = q('#st' + i); if (!el) return;
    el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700);
  }
  function renderStatus() {
    const ready = !(isOn() && !O.guestIn());
    for (let p = 1; p <= 2; p++) {
      const pos = G.pos[p];
      let conn = '';
      if (isOn() && O.seat > 0 && p !== myP()) conn = !ready ? 'wait' : (O.oppOn ? 'on' : 'off');
      setPlayerName(q('#spn' + p), name(p), conn);
      q('#sps' + p).textContent = TILES[pos][0] + ' ' + TILES[pos][1] + ' · 상소 ' + G.tok[p] + (G.skip[p] ? ' · 귀양' : '');
      q('#spl' + p).classList.toggle('on', !G.winner && G.turn === p && ready);
    }
    q('#ssay').textContent = sayText();
    q('#scount').textContent = G.moves + '번 진행';
    q('#sagain').disabled = isOn() && O.seat === 0;
    const r = q('#sresult');
    if (G.winner && !G.anim && !G.hideResult) {
      r.hidden = false;
      let label;
      if (sc.mode === 'ai' || (isOn() && O.seat > 0)) label = iWon(G.winner) ? '승리' : '패배';
      else label = name(G.winner) + ' 승리';
      q('#srtitle').textContent = label;
      q('#srsub').textContent = G.moves + '번 만에 ' + (G.winner === 1 ? '홍' : '청') + ' 말이 영의정에 올랐어요.';
      q('#srAgain').hidden = isOn() && O.seat === 0;
    } else r.hidden = true;
    renderAct();
  }
  function renderAct() {
    const yn = q('#syn'), yun = q('#syun');
    const shown = G.rolling ? null : (G.shownRoll || 0);
    if (!G.rolling) yn.textContent = shown ? shown : '–';
    yun.classList.toggle('rolling', !!G.rolling);
    const ht = humanTurn();
    const roll = q('#sroll'), mv = q('#smove'), rr = q('#sreroll');
    const canRollBtn = ht && G.phase === 'roll';
    const canChoose = ht && G.phase === 'choose' && !G.rolling;
    roll.hidden = !canRollBtn; mv.hidden = !canChoose; rr.hidden = !canChoose;
    if (canChoose) {
      const r = sim(G.pos, G.turn, G.roll);
      mv.textContent = '이동하기 · ' + G.roll + '칸';
      rr.textContent = '상소로 다시 굴리기 · 남은 ' + G.tok[G.turn];
      rr.disabled = G.tok[G.turn] <= 0;
      mv.title = r.ev !== null ? EV[r.ev].t : '';
    }
    q('#swait').hidden = canRollBtn || canChoose || !!G.winner;
    q('#swait').textContent = G.winner ? '' : (isOn() && !O.guestIn() ? '상대를 기다리는 중' : (humanTurn() ? '' : (G.anim ? '' : name(G.turn) + ' 차례')));
  }
  function render() { placeTokens(); renderStatus(); }

  /* ---------- 연출 ---------- */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function playRoll(v) {
    G.rolling = true; renderAct();
    const yn = q('#syn');
    const n = reduceMotion ? 1 : 7;
    for (let k = 0; k < n; k++) { yn.textContent = 1 + ((Math.random() * 5) | 0); FX.snap(); knockTick(k); await wait(75 + k * 12); }
    G.rolling = false; G.shownRoll = v; yn.textContent = v; FX.drop();
    q('#syun').classList.remove('rolling'); void q('#syun').offsetWidth;
    q('#syun').classList.add('landed'); setTimeout(() => q('#syun').classList.remove('landed'), 400);
  }
  function knockTick(k) { try { if (k % 2 === 0) FX.pick(); } catch (e) { /* 무시 */ } }
  async function hopTo(p, from, to) {
    const dir = to >= from ? 1 : -1;
    for (let i = from + dir, k = 0; dir > 0 ? i <= to : i >= to; i += dir, k++) {
      G.vis[p] = i; placeTokens(); FX.hop(k); await wait(reduceMotion ? 20 : 170);
    }
  }
  async function playLast(l) {
    G.note = noteFor(l);
    if (l.k === 'roll' || l.k === 'reroll') { await playRoll(l.roll); renderStatus(); return; }
    G.shownRoll = 0;
    renderStatus();
    await hopTo(l.who, G.vis[l.who], l.to1);
    if (l.ev !== null && EV[l.ev]) {
      const e = EV[l.ev];
      flashTile(l.ev, e.k === 'up' || e.k === 'tok' ? 'okflash' : 'badflash');
      if (e.k === 'dn' || e.k === 'skip') FX.bad(); else FX.win();
      await wait(reduceMotion ? 20 : 520);
      if (l.to2 !== l.to1) { await hopTo(l.who, l.to1, l.to2); }
    }
    if (l.bump) {
      const o = 3 - l.who;
      flashTile(l.bump.from, 'badflash'); FX.bad();
      await wait(reduceMotion ? 20 : 300);
      await hopTo(o, l.bump.from, l.bump.to);
    }
    G.vis[1] = G.pos[1]; G.vis[2] = G.pos[2]; placeTokens();
  }
  async function drain() {
    if (G.anim) return;
    G.anim = true; renderStatus();
    const tk = gtok;
    while (G.queue.length) {
      const l = G.queue.shift();
      await playLast(l);
      if (tk !== gtok) return;
      G.played = l.id;
    }
    G.anim = false;
    if (G.winner) {
      const win = iWon(G.winner);
      setTimeout(() => { if (win) { FX.win(); confetti(); } else FX.lose(); }, 160);
    }
    G.vis[1] = G.pos[1]; G.vis[2] = G.pos[2];
    render();
    maybeAI();
  }
  function confetti() {
    const l = q('#sfx'); if (!l || reduceMotion) return;
    const cols = ['#CC785C', '#4F7DBF', '#E8A55A', '#FAF9F5', '#5DB8A6'];
    for (let k = 0; k < 44; k++) {
      const r = document.createElementNS(NS, 'rect');
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 130;
      r.setAttribute('class', 'conf'); r.setAttribute('x', 178); r.setAttribute('y', 120); r.setAttribute('width', 5); r.setAttribute('height', 3.5);
      r.setAttribute('fill', cols[k % cols.length]);
      r.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      r.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 40) + 'px');
      r.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      l.appendChild(r); setTimeout(() => { if (r.parentNode) r.parentNode.removeChild(r); }, 1600);
    }
  }

  /* ---------- 행동 ---------- */
  function perform(a, who) {
    if (!hostAct(a, who)) return;
    G.queue.push(G.last);
    if (isOn()) pushDoc();
    drain();
  }
  function uiAct(a) {
    audio(); bgmSync();
    if (!humanTurn()) return;
    if (isOn() && !O.isHost) { netSendS({ t: 'act', a }); return; }
    perform(a, G.turn);
  }
  function newGame() { reset(); renderSet(); render(); maybeAI(); }

  /* ---------- 설정 ---------- */
  function setDef() {
    const modes = [['ai', '컴퓨터'], ['local', '둘이서']];
    if (typeof Peer !== 'undefined') modes.push(['online', '온라인']);
    return [
      { key: 'mode', label: '상대', opts: modes },
      { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: () => sc.mode === 'ai' },
      { key: 'first', label: '선공', opts: [['me', '나 먼저'], ['cpu', '컴퓨터 먼저']], when: () => sc.mode === 'ai' },
      { key: 'sound', label: '소리', opts: ONOFF, g: true },
      { key: 'haptic', label: '진동', opts: ONOFF, g: true },
      { key: 'bgm', label: '배경음', opts: ONOFF, g: true, when: () => bgmOK }
    ];
  }
  function renderSet() {
    q('#ssettings').innerHTML = setDef().filter(s => !s.when || s.when()).map(s => {
      const cur = s.g ? cfg[s.key] : sc[s.key];
      return '<div class="set"><span class="setlabel" id="ssl-' + s.key + '">' + s.label + '</span><div class="seg" role="radiogroup" aria-labelledby="ssl-' + s.key + '">' +
        s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div></div>';
    }).join('');
  }

  /* ---------- 온라인 (PeerJS, 방장이 기준) ---------- */
  const PFXS = 'gogeon-sng-';
  function docNow() { return { n: G.n, pos: G.pos.slice(), tok: G.tok.slice(), skip: G.skip.slice(), turn: G.turn, phase: G.phase, roll: G.roll, winner: G.winner, moves: G.moves, last: G.last, lid: G.lid, sw: O.sw }; }
  function netSendS(m, except) {
    if (O.isHost) { [O.guest].concat(O.watchers).forEach(c => { if (c !== except) sendTo(c, m); }); }
    else sendTo(O.conn, m);
  }
  function pushDoc() { netSendS({ t: 'doc', d: docNow() }); }
  function onDocS(d, fresh) {
    if (!fresh && d.n <= G.n) { if (d.sw !== O.sw) { O.sw = d.sw; render(); } return; }
    const prevPlayed = G.lid;
    G.pos = d.pos.slice(); G.tok = d.tok.slice(); G.skip = d.skip.slice(); G.turn = d.turn; G.phase = d.phase;
    G.roll = d.roll; G.winner = d.winner || 0; G.moves = d.moves; G.n = d.n; G.lid = d.lid; O.sw = d.sw || 0; G.hideResult = false;
    if (fresh) { G.vis = G.pos.slice(); G.last = d.last; G.shownRoll = G.phase === 'choose' ? G.roll : 0; G.note = ''; G.queue = []; G.anim = false; render(); renderOnline(); return; }
    if (d.last && d.last.id > prevPlayed) { G.queue.push(d.last); G.last = d.last; drain(); }
    else { G.vis = G.pos.slice(); G.note = ''; G.shownRoll = G.phase === 'choose' ? G.roll : 0; render(); }
    renderOnline();
  }
  const inviteUrl = () => location.origin + location.pathname + '?s=' + O.code;
  function renderInvite() { Invite.render(q('#sinv'), { note: '나는 홍, 친구는 청이에요', avail: typeof Peer !== 'undefined', online: isOn(), busy: O.busy, code: O.code, host: O.isHost, oppOn: O.oppOn }); }
  async function inviteStart() {
    if (typeof Peer === 'undefined' || O.busy) return;
    if (!isOn()) { sc.mode = 'online'; store.set('cg.seung.cfg', JSON.stringify(sc)); renderSet(); onMode(); }
    if (!O.code) await createRoomS();
    if (O.code && Invite.canShare()) Invite.share(inviteUrl());
  }
  function renderOnline() {
    renderInvite();
    const el = q('#sonline');
    if (!isOn()) { el.hidden = true; return; }
    el.hidden = false;
    const old = q('#sCode');
    const keep = old ? old.value.replace(/[^a-z0-9]/gi, '').slice(0, 4) : '';
    let h = '<p class="olh">온라인 대전</p>';
    if (!O.code) {
      h += '<div class="row"><button type="button" class="btn primary" id="sNew"' + (O.busy ? ' disabled' : '') + '>새 방 만들기</button></div>' +
        '<div class="row olin"><input id="sCode" class="olinput" type="text" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="방 코드 4자리" value="' + keep + '">' +
        '<button type="button" class="btn" id="sJoin"' + (O.busy ? ' disabled' : '') + '>들어가기</button></div>' +
        '<p class="hint">한 사람이 방을 만들고 링크(또는 4자리 코드)를 보내면, 상대가 열어서 바로 들어와요. 방을 만든 사람이 페이지를 닫으면 방도 닫혀요.</p>';
    } else {
      h += '<div class="olcodebox"><span class="olcode" id="sShown">' + O.code + '</span><button type="button" class="btn primary" id="sShare">공유하기</button><button type="button" class="btn" id="sCopy">링크 복사</button></div>' +
        '<p class="olst">내 말: ' + (O.seat === 1 ? '홍' : O.seat === 2 ? '청' : '관람') + '</p>' +
        '<div class="row"><button type="button" class="btn" id="sLeave">방 나가기</button></div>';
    }
    if (O.err) h += '<p class="hint warn" role="alert">' + O.err + '</p>';
    el.innerHTML = h;
  }
  async function createRoomS() {
    if (O.busy) return;
    O.busy = true; O.err = ''; renderOnline();
    try {
      let peer = null, code = '';
      for (let i = 0; i < 6 && !peer; i++) {
        code = newCode('s');
        peer = await openPeer(PFXS + code).catch(e => { if (e && e.type === 'unavailable-id') return null; throw e; });
      }
      if (!peer) throw new Error('code');
      enterHostS(code, peer);
    } catch (e) { O.err = '방을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'; }
    O.busy = false; renderOnline();
  }
  function leaveS() {
    [O.guest, O.conn].concat(O.watchers || []).forEach(c => { try { if (c) c.close(); } catch (e) { /* 무시 */ } });
    if (O.peer) { try { O.peer.destroy(); } catch (e) { /* 무시 */ } }
    Object.assign(O, { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], seat: 0, oppOn: false });
  }
  function enterHostS(code, peer) {
    leaveS(); Object.assign(O, { sw: 0 }); reset(); G.n = 0;
    Object.assign(O, { code, peer, isHost: true, seat: 1, oppOn: false });
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
        if (!m || c !== O.guest || m.t !== 'act') return;
        if (['roll', 'reroll', 'move'].indexOf(m.a) >= 0) perform(m.a, 2);
      });
      c.on('close', () => { if (c === O.guest) { O.oppOn = false; render(); renderOnline(); } });
    });
    render();
  }
  async function joinS(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (O.busy) return;
    if (!/^[a-z0-9]{4}$/.test(code)) { O.err = '방 코드는 4자리예요.'; renderOnline(); return; }
    O.busy = true; O.err = ''; renderOnline();
    Join.joining('seung');
    let peer = null;
    try {
      peer = await openPeer(null);
      const hello = await new Promise((res, rej) => {
        const c = peer.connect(PFXS + code, { reliable: true });
        const t = setTimeout(() => rej(new Error('timeout')), 12000);
        peer.on('error', e => { clearTimeout(t); rej(e); });
        c.on('data', m => { if (m && m.t === 'hello') { clearTimeout(t); res({ c, m }); } });
        c.on('error', e => { clearTimeout(t); rej(e); });
      });
      enterGuestS(code, peer, hello.c, hello.m);
      Join.joined('seung', O.seat);
    } catch (e) {
      try { if (peer) peer.destroy(); } catch (x) { /* 무시 */ }
      Join.failed('seung', code, e && e.type === 'peer-unavailable' ? 'gone' : 'net', () => joinS(code));
      O.err = e && e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : '방에 연결하지 못했어요. 방장이 페이지를 열어 둔 상태인지 확인해 주세요.';
    }
    O.busy = false; renderOnline();
  }
  function enterGuestS(code, peer, c, hello) {
    leaveS(); reset();
    Object.assign(O, { code, peer, isHost: false, conn: c, seat: hello.seat, oppOn: true });
    c.on('data', m => { if (m && m.t === 'doc' && m.d) onDocS(m.d, false); });
    c.on('close', () => { const mine = O.conn === c; O.oppOn = false; O.err = '방장과 연결이 끊어졌어요. 방을 나갔다가 다시 들어와 보세요.'; renderOnline(); renderStatus(); if (mine) Join.closed('seung', code, () => joinS(code), () => { leaveS(); reset(); render(); renderOnline(); }); });
    peer.on('error', () => { O.err = '연결에 문제가 생겼어요.'; renderOnline(); });
    Beat.guest(c, peer);
    G.n = -1; onDocS(hello.doc, true);
    render(); renderOnline();
  }
  function newGameOnline() {
    if (!O.code || O.seat !== 1) { if (O.seat === 2) { O.err = '새 판은 방을 만든 사람이 시작할 수 있어요.'; renderOnline(); } return; }
    const btn = q('#sagain');
    if (G.moves > 0 && !G.winner && !G.confirmNew) {
      G.confirmNew = true; btn.textContent = '한 번 더 누르면 새 판';
      setTimeout(() => { G.confirmNew = false; btn.textContent = '새 게임'; }, 3000);
      return;
    }
    G.confirmNew = false; btn.textContent = '새 게임';
    const n = G.n + 1; O.sw = O.sw ? 0 : 1;
    reset(); G.n = n; G.lid = 0;
    render(); renderOnline(); pushDoc();
  }

  /* ---------- 연결 ---------- */
  function onMode() {
    if (isOn()) { leaveS(); reset(); render(); renderOnline(); }
    else { leaveS(); newGame(); renderOnline(); }
  }
  const startNew = () => { if (isOn()) newGameOnline(); else newGame(); };
  q('#sbk').addEventListener('click', () => show('hub'));
  q('#sagain').addEventListener('click', startNew);
  q('#srAgain').addEventListener('click', startNew);
  q('#srView').addEventListener('click', () => { G.hideResult = true; renderStatus(); });
  q('#sroll').addEventListener('click', () => uiAct('roll'));
  q('#smove').addEventListener('click', () => uiAct('move'));
  q('#sreroll').addEventListener('click', () => uiAct('reroll'));
  q('#ssettings').addEventListener('click', e => {
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
    sc[b.dataset.k] = b.dataset.v;
    store.set('cg.seung.cfg', JSON.stringify(sc));
    renderSet();
    if (b.dataset.k === 'mode') onMode(); else newGame();
  });
  q('#sonline').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'sNew') createRoomS();
    else if (b.id === 'sJoin') joinS(q('#sCode').value);
    else if (b.id === 'sShare') Invite.share(inviteUrl(), b);
    else if (b.id === 'sCopy') {
      const url = location.origin + location.pathname + '?s=' + O.code;
      const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '링크 복사'; }, 1500); };
      try { navigator.clipboard.writeText(url).then(done, () => {}); } catch (err) { /* 무시 */ }
    } else if (b.id === 'sLeave') { leaveS(); reset(); render(); renderOnline(); }
  });
  q('#sinv').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'start') inviteStart();
    else if (b.dataset.act === 'share') Invite.share(inviteUrl(), b);
  });
  q('#sonline').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'sCode') joinS(e.target.value); });

  window.seungSettings = function () { renderSet(); };
  window.seungJoin = function (code) { sc.mode = 'online'; show('seung'); joinS(code); };
  window.seungEnter = function () {
    renderSet();
    if (wantOnlineS) { wantOnlineS = false; if (typeof Peer !== 'undefined') { sc.mode = 'online'; renderSet(); onMode(); return; } }
    if (isOn() && typeof Peer === 'undefined') { sc.mode = 'ai'; newGame(); renderOnline(); return; }
    render(); renderOnline(); maybeAI();
  };
  window.seungLeave = function () { gtok++; G.busy = false; };

  /* 초기화 */
  drawBg();
  reset();
  try {
    const r = new URLSearchParams(location.search).get('s');
    if (r && /^[a-z0-9]{4}$/i.test(r) && typeof Peer !== 'undefined') {
      Join.setOrigin('link');
      Join.joining('seung');
      sc.mode = 'online';
      show('seung');
      joinS(r.toLowerCase());
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
    }
  } catch (e) { /* 무시 */ }
})();
