/* ===== 화면 (허브 + 다이아몬드 게임) ===== */
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r) => (r || document).querySelector(s);
const D = 30, H3 = Math.sqrt(3) / 2;
const f1 = n => Math.round(n * 10) / 10;
const POS = CELLS.map(c => ({ x: f1((c.x - c.y) / 2 * D), y: f1(c.z * H3 * D) }));
const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } }
};

/* ---------- 정적 마크업 ---------- */
const TRI_UP = [[0, -8 * H3 * D], [-6 * D, 4 * H3 * D], [6 * D, 4 * H3 * D]];
const TRI_DN = [[0, 8 * H3 * D], [-6 * D, -4 * H3 * D], [6 * D, -4 * H3 * D]];
const pts = t => t.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
const TRAY =
  '<clipPath id="starClip"><polygon points="' + pts(TRI_UP) + '"/><polygon points="' + pts(TRI_DN) + '"/></clipPath>' +
  '<polygon class="rim" points="' + pts(TRI_UP) + '"/><polygon class="rim" points="' + pts(TRI_DN) + '"/>' +
  '<polygon class="tray" style="fill:url(#gBoard);stroke:url(#gBoard)" points="' + pts(TRI_UP) + '"/><polygon class="tray" style="fill:url(#gBoard);stroke:url(#gBoard)" points="' + pts(TRI_DN) + '"/>' +
  '<rect x="-204" y="-236" width="408" height="472" filter="url(#grain)" clip-path="url(#starClip)"/>';
/* 별판은 180도 돌려도 같은 모양이라, 파랑 좌석은 칸 좌표만 뒤집어 그린다 */
function holesMarkup(sg) {
  let s = '';
  CELLS.forEach((c, i) => {
    const x = f1(POS[i].x * sg), y = f1(POS[i].y * sg);
    s += '<circle class="holerim" cx="' + x + '" cy="' + f1(y + 1) + '" r="12"/>';
    s += '<circle class="hole" cx="' + x + '" cy="' + y + '" r="11"/>';
    if (c.z >= 5) s += '<circle class="tint1" cx="' + x + '" cy="' + y + '" r="11"/>';
    else if (c.z <= -5) s += '<circle class="tint2" cx="' + x + '" cy="' + y + '" r="11"/>';
  });
  return s;
}
const STATIC0 = TRAY + holesMarkup(1), STATIC1 = TRAY + holesMarkup(-1);
let staticFlip = null;
let flip = false;
const P = i => flip ? { x: -POS[i].x, y: -POS[i].y } : POS[i];

/* o.up: 들린 상태(그림자가 멀어짐), o.start: 'up' 클래스를 나중에 붙여 들어 올리는 전환을 보여 줌, o.settle: 놓은 직후 안착 효과 */
const pieceMarkup = (p, o) => {
  o = o || {};
  return '<ellipse class="shadow" cx="2" cy="' + (o.up ? 10 : 3.5) + '" rx="13" ry="7.5"/>' +
    '<g class="lift' + (o.up && !o.start ? ' up' : '') + (o.settle ? ' settle' : '') + '">' +
    '<circle r="16" class="glow glow' + p + '"/>' +
    '<circle r="11.5" class="pc' + p + '"/>' +
    (p === 2 ? '<circle r="6.4" class="inner"/>' : '') +
    '<circle r="11.5" class="gloss"/>' +
    '<ellipse cx="2.6" cy="6.4" rx="5.4" ry="2.1" class="rimlt"/>' +
    '<ellipse cx="-3.9" cy="-5" rx="3.9" ry="2.2" transform="rotate(-32 -3.9 -5)" class="shine"/></g>';
};

/* ---------- 상태 ---------- */
let cfg = { mode: 'ai', level: 'normal', first: 'me', sound: 'on', haptic: 'on', bgm: 'on' };
try { Object.assign(cfg, JSON.parse(store.get('cg.diamond.cfg') || '{}')); } catch (e) { /* 기본값 사용 */ }
let wantOnline = false;
if (cfg.mode === 'online') { wantOnline = true; cfg.mode = 'ai'; } // 온라인 기능이 준비된 뒤에 복귀
let view = 'hub';
let token = 0;
const S = {};

/* 온라인 대전 상태 */
const OL = { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, room: null, seat: 0, p1: null, p2: null, oppOn: false, err: '', busy: false, pending: null, lastLift: null };
const isOnline = () => cfg.mode === 'online';
const onlineOK = () => typeof Peer !== 'undefined';
const olReady = () => !!(OL.p1 && OL.p2);

function resetState() {
  token++;
  S.board = newBoard();
  S.turn = (cfg.mode === 'ai' && cfg.first === 'cpu') ? 2 : 1;
  S.sel = null; S.dests = []; S.last = null; S.moves = 0; S.winner = 0; S.n = 0;
  S.busy = false; S.think = false; S.anim = null; S.drag = null; S.fx = null; S.oppLift = null;
  S.hist = []; S.note = ''; S.hideResult = false; S.focusI = null; S.confirmNew = false;
}

const names = () => {
  if (cfg.mode === 'ai') return ['', '나', '컴퓨터'];
  if (isOnline()) return OL.seat === 1 ? ['', '나', '상대'] : OL.seat === 2 ? ['', '상대', '나'] : ['', '빨강', '파랑'];
  return ['', '빨강', '파랑'];
};
const colorName = p => p === 1 ? '빨강' : '파랑';
const humanTurn = () => {
  if (S.winner !== 0 || S.busy) return false;
  if (isOnline()) return OL.seat > 0 && olReady() && S.turn === OL.seat;
  return !(cfg.mode === 'ai' && S.turn === 2);
};
const iWon = w => cfg.mode === 'ai' ? w === 1 : (isOnline() && OL.seat > 0 ? w === OL.seat : true);

/* ---------- 소리와 진동 ---------- */
let AC = null, noiseBuf = null, OUT = null, REV = null;
function audio() {
  if (cfg.sound === 'off') return null;
  try {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      AC = new C();
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      OUT = AC.createGain(); OUT.gain.value = 0.9;
      OUT.connect(comp); comp.connect(AC.destination);
      /* 작은 방 울림: 생성한 잔향 임펄스 */
      const len = Math.floor(AC.sampleRate * 1.1), ir = AC.createBuffer(2, len, AC.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const cv = AC.createConvolver(); cv.buffer = ir;
      REV = AC.createGain(); REV.gain.value = 0.22;
      REV.connect(cv); cv.connect(comp);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch (e) { return null; }
}
const vary = () => 1 + (Math.random() - 0.5) * 0.05;
function out(g, wet) { g.connect(OUT); if (wet && REV) { const w = AC.createGain(); w.gain.value = wet; g.connect(w); w.connect(REV); } }
function tone(f0, f1, dur, gain, type, delay, wet) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); out(g, wet);
  o.start(t); o.stop(t + dur + 0.02);
}
function click(freq, dur, gain, delay, q) {
  const a = audio(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.12), a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + (delay || 0);
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.4;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); out(g, 0);
  s.start(t); s.stop(t + dur + 0.02);
}
/* 유리구슬 맑은 울림: 어긋난 배음 세 개가 짧게 사라진다 */
function glass(f, gain, delay) {
  [[1, 1, 0.16], [2.76, 0.42, 0.1], [5.4, 0.18, 0.05]].forEach(p => tone(f * p[0], f * p[0], p[2], gain * p[1], 'sine', delay, 0.5));
}
/* 나무판 위에 구슬이 놓이는 둔탁한 소리 */
function knock(gain, delay) {
  tone(190 * vary(), 78, 0.09, gain, 'sine', delay, 0.15);
  click(1100, 0.04, gain * 0.9, delay, 0.9);
}
/* 가야금처럼 튕기는 소리: 삼각파 + 한 옥타브 위, 빠르게 닫히는 필터 */
function pluck(f, gain, delay, dur) {
  const a = audio(); if (!a) return;
  dur = dur || 0.5;
  const t = a.currentTime + (delay || 0);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [['triangle', 1, 1], ['sine', 2, 0.35]].forEach(p => {
    const o = a.createOscillator(), og = a.createGain();
    o.type = p[0]; o.frequency.value = f * p[1]; og.gain.value = p[2];
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dur + 0.03);
  });
  lp.connect(g); out(g, 0.7);
}
const PENTA = [0, 2, 4, 7, 9]; // 계면조가 아닌 밝은 평조 느낌의 5음
const note = (k, base) => (base || 392) * Math.pow(2, (PENTA[k % 5] + 12 * Math.floor(k / 5)) / 12);

/* ---------- 배경음악: bgm.mp3 파일이 있을 때만 켜진다 ---------- */
let bgmEl = null, bgmOK = false;
function bgmProbe() {
  const ok = r => r.ok && /audio|mpeg|octet/i.test(r.headers.get('content-type') || '');
  const done = v => { bgmOK = v; if (v) { renderSettings(); if (window.omokSettings) window.omokSettings(); } };
  try {
    fetch('bgm.mp3', { method: 'HEAD' }).then(r => {
      if (ok(r)) return done(true);
      return fetch('bgm.mp3', { headers: { Range: 'bytes=0-0' } }).then(r2 => done(ok(r2)));
    }).catch(() => fetch('bgm.mp3', { headers: { Range: 'bytes=0-0' } }).then(r2 => done(ok(r2))).catch(() => { /* 파일 없음 */ }));
  } catch (e) { /* 무시 */ }
}
function bgmSync() {
  if (!bgmOK) return;
  try {
    if (!bgmEl) { bgmEl = new Audio('bgm.mp3'); bgmEl.loop = true; bgmEl.volume = 0.32; }
    if (cfg.bgm !== 'off' && !document.hidden) { const p = bgmEl.play(); if (p && p.catch) p.catch(() => { /* 첫 터치 뒤에 재생 */ }); }
    else bgmEl.pause();
  } catch (e) { /* 무시 */ }
}
document.addEventListener('visibilitychange', bgmSync);
let hapticFail = !(typeof navigator !== 'undefined' && navigator.vibrate);
const HAPTIC = { pick: 10, snap: 6, drop: 18, hop: 10, bad: [28, 40, 28], win: [20, 70, 20, 70, 50], lose: [70, 60, 70] };
function haptic(kind) {
  if (cfg.haptic === 'off') return;
  try {
    if (!navigator.vibrate) return;
    const ok = navigator.vibrate(HAPTIC[kind]);
    if (ok === false && !hapticFail) { hapticFail = true; renderSettings(); }
  } catch (e) { /* 진동 불가 환경 */ }
}
const FX = {
  pick() { glass(1760 * vary(), 0.05); click(3200, 0.03, 0.05); haptic('pick'); },
  snap() { glass(2480, 0.02); haptic('snap'); },
  drop() { knock(0.2); glass(1320 * vary(), 0.045, 0.012); haptic('drop'); },
  hop(k) { pluck(note(k, 392), 0.1, 0, 0.42); click(2600 + k * 120, 0.025, 0.05); haptic('hop'); },
  bad() { tone(150, 100, 0.12, 0.12, 'sine'); knock(0.1, 0.09); haptic('bad'); },
  win() { [0, 1, 2, 3, 4, 5].forEach(k => pluck(note(k + 2, 392), 0.12, k * 0.11, 0.9)); glass(2093, 0.05, 0.7); haptic('win'); },
  lose() { [587, 494, 392].forEach((f, i) => pluck(f, 0.09, i * 0.2, 0.8)); haptic('lose'); }
};


/* ---------- 효과: 빛 꼬리, 착지 물결, 승리 색종이 ---------- */
function fxAdd(el, ms) {
  const l = $('#fxl'); if (!l) return;
  l.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms);
}
function trailAt(i, p) {
  if (reduceMotion) return;
  const q = P(i), c = document.createElementNS(NS, 'circle');
  c.setAttribute('class', 'trail t' + p); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); c.setAttribute('r', 9);
  fxAdd(c, 560);
}
function rippleAt(i) {
  if (reduceMotion) return;
  const q = P(i), c = document.createElementNS(NS, 'circle');
  c.setAttribute('class', 'ripple'); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); c.setAttribute('r', 11);
  fxAdd(c, 620);
}
function confetti() {
  if (reduceMotion) return;
  const cols = ['#D8472F', '#3A66B8', '#E0A92E', '#EDEFE8', '#2E6A56'];
  for (let k = 0; k < 44; k++) {
    const r = document.createElementNS(NS, 'rect');
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 150;
    r.setAttribute('class', 'conf');
    r.setAttribute('x', -3); r.setAttribute('y', -2); r.setAttribute('width', 6); r.setAttribute('height', 4);
    r.setAttribute('fill', cols[k % cols.length]);
    r.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
    r.style.setProperty('--dy', Math.round(Math.sin(ang) * dist + 60) + 'px');
    r.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    fxAdd(r, 1600);
  }
}

/* ---------- 렌더 ---------- */
function boardMarkup() {
  let s = '';
  const act = humanTurn();
  if (S.last) {
    const a = P(S.last.f), b = P(S.last.t);
    s += '<circle class="lastf" cx="' + a.x + '" cy="' + a.y + '" r="10.5"/>';
    s += '<circle class="lastt" cx="' + b.x + '" cy="' + b.y + '" r="15.5"/>';
  }
  if (act && S.sel !== null) {
    for (const d of S.dests) s += '<circle class="dest" data-d="' + d + '" cx="' + P(d).x + '" cy="' + P(d).y + '" r="5.5"/>';
  }
  s += '<g id="pieces">';
  for (let i = 0; i < N; i++) {
    const v = S.board[i];
    if (!v || (S.anim && S.anim.f === i) || (S.drag && S.drag.i === i)) continue;
    if (act && S.sel === null && v === S.turn) s += '<circle class="halo" cx="' + P(i).x + '" cy="' + P(i).y + '" r="15"/>';
    const lifted = (act && S.sel === i) || (isOnline() && !act && S.oppLift === i && v !== OL.seat);
    s += '<g class="pcg" style="transform:translate(' + P(i).x + 'px,' + P(i).y + 'px)">' +
      pieceMarkup(v, { up: lifted, settle: S.fx === i }) + '</g>';
  }
  s += '</g>';
  if (act && S.sel !== null) s += '<circle class="ring" cx="' + P(S.sel).x + '" cy="' + P(S.sel).y + '" r="15.5"/>';
  for (let i = 0; i < N; i++) {
    const own = S.board[i] === S.turn && act;
    const isDest = S.sel !== null && S.dests.indexOf(i) >= 0;
    const live = act && (own || isDest);
    s += '<circle class="hit' + (live ? ' act' : '') + '" cx="' + P(i).x + '" cy="' + P(i).y + '" r="15" data-i="' + i + '"' +
      (live ? ' tabindex="0" role="button" aria-label="' + (own ? '내 말 선택' : '이 칸으로 이동') + '"' : '') + '/>';
  }
  return s;
}

function sayText() {
  const nm = names();
  if (S.winner) {
    if (cfg.mode === 'ai') return S.winner === 1 ? '이겼어요. ' + S.moves + '수 만에 반대편 진영을 채웠어요.' : '컴퓨터가 먼저 진영을 채웠어요.';
    if (isOnline() && OL.seat > 0) return S.winner === OL.seat ? '이겼어요. ' + S.moves + '수 만에 반대편 진영을 채웠어요.' : '상대가 먼저 진영을 채웠어요.';
    return colorName(S.winner) + ' 승리. ' + S.moves + '수 만에 끝났어요.';
  }
  if (isOnline()) {
    if (!OL.code) return '방을 만들거나 코드를 입력해 주세요.';
    if (OL.seat === 0) return '관람 중이에요. ' + colorName(S.turn) + ' 차례예요.';
    if (!olReady()) return '상대를 기다리는 중이에요. 방 코드 ' + OL.code + ' 를 알려 주세요.';
    if (S.busy) return '';
    if (S.turn !== OL.seat) return '상대 차례예요. 잠시 기다려 주세요.';
  }
  if (S.think) return '컴퓨터가 생각하는 중…';
  if (S.busy) return '';
  if (S.note) return S.note;
  if (S.sel !== null) return '구슬을 끌어 노란 점에 놓거나, 점을 눌러 주세요.';
  if (cfg.mode === 'ai' || isOnline()) return '내 차례예요. 구슬을 눌러 집어 보세요.';
  return nm[S.turn] + ' 차례예요. 구슬을 눌러 집어 보세요.';
}

function renderStatus() {
  const nm = names();
  const oppSeat = OL.seat === 1 ? 2 : 1;
  for (let p = 1; p <= 2; p++) {
    $('#pn' + p).textContent = nm[p];
    let extra = '';
    if (isOnline() && OL.seat > 0 && p === oppSeat) {
      if (!olReady()) extra = ' · 대기 중';
      else if (OL.room) extra = OL.oppOn ? ' · 접속 중' : ' · 오프라인';
    }
    $('#ps' + p).textContent = '목표 ' + countGoal(S.board, p) + '/10' + (!S.winner && S.turn === p && !(isOnline() && !olReady()) ? ' · 차례' : '') + extra;
    $('#pl' + p).classList.toggle('on', !S.winner && S.turn === p && !(isOnline() && !olReady()));
  }
  $('#say').textContent = sayText();
  $('#count').textContent = S.moves + '수 진행';
  $('#undo').disabled = isOnline() || S.busy || S.hist.length === 0;
  $('#again').disabled = isOnline() && OL.seat === 0;
  const r = $('#result');
  if (S.winner && !S.busy && !S.hideResult) {
    r.hidden = false;
    const t = $('#rtitle');
    let label;
    if (cfg.mode === 'ai' || (isOnline() && OL.seat > 0)) label = iWon(S.winner) ? '승리' : '패배';
    else label = colorName(S.winner) + ' 승리';
    t.textContent = label;
    t.className = 'rtitle w' + S.winner;
    $('#rsub').textContent = S.moves + '수 만에 끝났어요.';
    $('#rAgain').hidden = isOnline() && OL.seat === 0;
  } else r.hidden = true;
}

function render() {
  if (staticFlip !== flip) { $('#bgl').innerHTML = flip ? STATIC1 : STATIC0; staticFlip = flip; }
  $('#dyn').innerHTML = boardMarkup();
  S.fx = null;
  renderStatus();
  syncLift();
  if (S.focusI !== null) {
    const el = $('#board [data-i="' + S.focusI + '"][tabindex]');
    if (el) el.focus();
    S.focusI = null;
  }
}

/* ---------- 설정 ---------- */
const ONOFF = [['on', '켜짐'], ['off', '꺼짐']];
function settingsDef() {
  const modes = [['ai', '컴퓨터'], ['local', '둘이서']];
  if (onlineOK()) modes.push(['online', '온라인']);
  return [
    { key: 'mode', label: '상대', opts: modes },
    { key: 'level', label: '난이도', opts: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], when: c => c.mode === 'ai' },
    { key: 'first', label: '선공', opts: [['me', '나'], ['cpu', '컴퓨터']], when: c => c.mode === 'ai' },
    { key: 'sound', label: '소리', opts: ONOFF, live: true },
    { key: 'haptic', label: '진동', opts: ONOFF, live: true },
    { key: 'bgm', label: '배경음', opts: ONOFF, live: true, when: () => bgmOK }
  ];
}
function renderSettings() {
  $('#settings').innerHTML = settingsDef().filter(s => !s.when || s.when(cfg)).map(s =>
    '<div class="set"><span class="setlabel" id="sl-' + s.key + '">' + s.label + '</span>' +
    '<div class="seg" role="radiogroup" aria-labelledby="sl-' + s.key + '">' +
    s.opts.map(o => '<button type="button" role="radio" aria-checked="' + (cfg[s.key] === o[0]) + '" data-k="' + s.key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
    '</div></div>'
  ).join('') +
    (hapticFail ? '<p class="hint">이 기기나 보기 환경에서는 진동이 지원되지 않아요. 아이폰 Safari는 진동 기능이 없어요.</p>' : '');
}

/* ---------- 온라인 대전 ---------- */
const enc = b => Array.prototype.join.call(b, '');
const dec = s => Int8Array.from(String(s).split(''), Number);
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function renderOnline() {
  const el = $('#online');
  if (!isOnline()) { el.hidden = true; return; }
  el.hidden = false;
  const old = $('#olCode');
  const keep = old ? old.value.replace(/[^a-z0-9]/gi, '').slice(0, 4) : '';
  const seatLabel = OL.seat === 1 ? '빨강(아래쪽)' : OL.seat === 2 ? '파랑(아래쪽으로 돌려 보여요)' : '관람';
  let h = '<p class="olh">온라인 대전</p>';
  if (!OL.code) {
    h += '<div class="row"><button type="button" class="btn primary" id="olNew"' + (OL.busy ? ' disabled' : '') + '>새 방 만들기</button></div>' +
      '<div class="row olin"><input id="olCode" class="olinput" type="text" inputmode="text" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="방 코드 4자리" value="' + keep + '">' +
      '<button type="button" class="btn" id="olJoin"' + (OL.busy ? ' disabled' : '') + '>들어가기</button></div>' +
      '<p class="hint">한 사람이 방을 만들고 링크(또는 4자리 코드)를 보내면, 상대가 열어서 바로 들어와요. 방을 만든 사람이 페이지를 닫으면 방도 닫혀요.</p>';
  } else {
    h += '<div class="olcodebox"><span class="olcode" id="olShown">' + OL.code + '</span><button type="button" class="btn" id="olCopy">링크 복사</button></div>' +
      '<p class="olst">내 자리: ' + seatLabel + '</p>' +
      '<div class="row"><button type="button" class="btn" id="olLeave">방 나가기</button></div>';
  }
  if (OL.err) h += '<p class="hint warn" role="alert">' + OL.err + '</p>';
  el.innerHTML = h;
}

function copyText(text, btn) {
  const done = () => { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = '링크 복사'; }, 1500); };
  const fallback = () => {
    const n = $('#olShown');
    try { const sel = window.getSelection(); sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(n); sel.addRange(r); } catch (e) { /* 무시 */ }
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

/* ---------- P2P 연결 (PeerJS): 방장이 상태를 쥐고, 친구와 직접 주고받는다 ---------- */
const PFX = 'gogeon-dia-';
const PEER_OPTS = { config: { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
] } };

Object.assign(PEER_OPTS, window.__PEER_OPTS || {});
function openPeer(id) {
  return new Promise((res, rej) => {
    let done = false;
    const p = id ? new Peer(id, PEER_OPTS) : new Peer(PEER_OPTS);
    const fail = e => { if (done) return; done = true; try { p.destroy(); } catch (x) { /* 무시 */ } rej(e); };
    p.on('open', () => { if (!done) { done = true; res(p); } });
    p.on('error', fail);
    setTimeout(() => fail(new Error('timeout')), 10000);
  });
}
const sendTo = (c, m) => { try { if (c && c.open) c.send(m); } catch (e) { /* 무시 */ } };
const lifter = { presence: p => { netSend({ t: 'lift', i: p.lift }); return Promise.resolve(); }, leave: () => {} };
function netSend(m, except) {
  if (OL.isHost) { [OL.guest].concat(OL.watchers).forEach(c => { if (c !== except) sendTo(c, m); }); }
  else sendTo(OL.conn, m);
}

async function createRoom() {
  if (!onlineOK() || OL.busy) return;
  OL.busy = true; OL.err = ''; renderOnline();
  try {
    let peer = null, code = '';
    for (let i = 0; i < 6 && !peer; i++) {
      code = newCode();
      peer = await openPeer(PFX + code).catch(e => { if (e && e.type === 'unavailable-id') return null; throw e; });
    }
    if (!peer) throw new Error('code');
    enterHost(code, peer);
  } catch (e) { OL.err = '방을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'; }
  OL.busy = false; renderOnline();
}

function enterHost(code, peer) {
  leaveRoom(false);
  resetState(); S.n = 0;
  Object.assign(OL, { code, peer, isHost: true, seat: 1, p1: 'host', p2: null, guest: null, watchers: [], conn: null, oppOn: false, room: lifter });
  OL.doc = { n: 0, board: enc(S.board), turn: 1, moves: 0, last: null, winner: 0, p1: 'host', p2: null };
  flip = false;
  peer.on('error', () => { OL.err = '연결에 문제가 생겼어요. 방을 다시 만들어 주세요.'; renderOnline(); });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* 무시 */ } });
  peer.on('connection', c => {
    c.on('open', () => {
      let seat = 0;
      if (!OL.guest || !OL.guest.open) { OL.guest = c; seat = 2; OL.doc.p2 = 'guest'; OL.p2 = 'guest'; OL.oppOn = true; }
      else OL.watchers.push(c);
      sendTo(c, { t: 'hello', seat, doc: OL.doc });
      renderOnline(); render();
    });
    c.on('data', m => {
      if (!m || c !== OL.guest) return;
      if (m.t === 'lift') { const v = typeof m.i === 'number' ? m.i : null; if (v !== S.oppLift) { S.oppLift = v; if (!drag && !S.busy) render(); } netSend(m, c); }
      else if (m.t === 'doc' && m.d && m.d.n > OL.doc.n) {
        OL.doc = Object.assign({}, m.d, { p1: 'host', p2: OL.doc.p2 });
        netSend({ t: 'doc', d: OL.doc }, c);
        onDoc({ exists: true, data: () => OL.doc });
      }
    });
    c.on('close', () => { if (c === OL.guest) { OL.oppOn = false; S.oppLift = null; render(); } });
  });
  store.set('cg.diamond.room', '');
  render();
}

async function joinByCode(raw) {
  const code = String(raw || '').trim().toLowerCase();
  if (OL.busy) return;
  if (!/^[a-z0-9]{4}$/.test(code)) { OL.err = '방 코드는 4자리예요.'; renderOnline(); return; }
  OL.busy = true; OL.err = ''; renderOnline();
  let peer = null;
  try {
    peer = await openPeer(null);
    const hello = await new Promise((res, rej) => {
      const c = peer.connect(PFX + code, { reliable: true });
      const t = setTimeout(() => rej(new Error('timeout')), 12000);
      peer.on('error', e => { clearTimeout(t); rej(e); });
      c.on('data', m => { if (m && m.t === 'hello') { clearTimeout(t); res({ c, m }); } });
      c.on('error', e => { clearTimeout(t); rej(e); });
    });
    enterGuest(code, peer, hello.c, hello.m);
  } catch (e) {
    try { if (peer) peer.destroy(); } catch (x) { /* 무시 */ }
    OL.err = e && e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : '방에 연결하지 못했어요. 방장이 페이지를 열어 둔 상태인지 확인해 주세요.';
  }
  OL.busy = false; renderOnline();
}

function enterGuest(code, peer, c, hello) {
  leaveRoom(false);
  resetState(); S.n = -1;
  Object.assign(OL, { code, peer, isHost: false, conn: c, seat: hello.seat, guest: null, watchers: [], oppOn: true, room: lifter });
  flip = OL.seat === 2;
  c.on('data', m => {
    if (!m) return;
    if (m.t === 'doc' && m.d) onDoc({ exists: true, data: () => m.d });
    else if (m.t === 'lift') { const v = typeof m.i === 'number' ? m.i : null; if (v !== S.oppLift) { S.oppLift = v; if (!drag && !S.busy) render(); } }
  });
  c.on('close', () => { OL.oppOn = false; OL.err = '방장과 연결이 끊어졌어요. 방을 나갔다가 다시 들어와 보세요.'; renderOnline(); renderStatus(); });
  peer.on('error', () => { OL.err = '연결에 문제가 생겼어요.'; renderOnline(); });
  store.set('cg.diamond.room', '');
  onDoc({ exists: true, data: () => hello.doc });
  render();
}

function leaveRoom(clear) {
  [OL.guest, OL.conn].concat(OL.watchers || []).forEach(c => { try { if (c) c.close(); } catch (e) { /* 무시 */ } });
  if (OL.peer) { try { OL.peer.destroy(); } catch (e) { /* 무시 */ } }
  Object.assign(OL, { code: '', peer: null, isHost: false, conn: null, guest: null, watchers: [], doc: null, room: null, seat: 0, p1: null, p2: null, oppOn: false, pending: null, lastLift: null });
  S.oppLift = null; flip = false;
}

function syncLift() {
  if (!isOnline() || !OL.room) return;
  const want = (humanTurn() && S.sel !== null) ? S.sel : null;
  if (want === OL.lastLift) return;
  OL.lastLift = want;
  netSend({ t: 'lift', i: want });
}

function pushState() {
  if (!OL.code) return;
  const body = { board: enc(S.board), turn: S.turn, last: S.last, moves: S.moves, winner: S.winner, n: S.n };
  if (OL.isHost) { OL.doc = Object.assign({}, OL.doc, body); netSend({ t: 'doc', d: OL.doc }); }
  else sendTo(OL.conn, { t: 'doc', d: body });
}

function onDoc(snap) {
  if (!snap.exists) { OL.err = '방이 사라졌어요.'; renderOnline(); return; }
  const d = snap.data();
  const seatsChanged = OL.p1 !== d.p1 || OL.p2 !== (d.p2 || null);
  OL.p1 = d.p1; OL.p2 = d.p2 || null;
  if (d.n > S.n) { OL.pending = d; tryRemote(); }
  else if (seatsChanged) { renderOnline(); render(); }
}

function applyDoc(d) {
  S.board = dec(d.board); S.turn = d.turn; S.moves = d.moves || 0; S.last = d.last || null;
  S.winner = d.winner || 0; S.n = d.n;
  S.sel = null; S.dests = []; S.note = ''; S.busy = false; S.think = false; S.anim = null; S.drag = null; S.fx = null; S.hideResult = false;
  render(); renderOnline();
}

function tryRemote() {
  const d = OL.pending;
  if (!d) return;
  if (d.n <= S.n) { OL.pending = null; return; }
  if (S.busy || drag) return; // 진행 중인 동작이 끝나면 다시 불린다
  OL.pending = null;
  if (d.n === S.n + 1 && d.moves === S.moves + 1 && d.last && S.board[d.last.f] === S.turn && S.turn !== OL.seat) {
    commit(d.last.f, d.last.t, token, null, true);
  } else applyDoc(d);
}

function onlineNewGame() {
  if (!OL.code || OL.seat === 0) return;
  const btn = $('#again');
  if (S.moves > 0 && !S.winner && !S.confirmNew) {
    S.confirmNew = true; btn.textContent = '한 번 더 누르면 새 판';
    setTimeout(() => { S.confirmNew = false; btn.textContent = '새 게임'; }, 3000);
    return;
  }
  S.confirmNew = false; btn.textContent = '새 게임';
  const n = S.n + 1;
  resetState(); S.n = n; S.turn = 1;
  render();
  pushState();
}
function requestNew() { if (isOnline()) onlineNewGame(); else newGame(); }

/* ---------- 흐름 ---------- */
function maybeAI() {
  if (cfg.mode === 'ai' && S.turn === 2 && !S.winner && !S.busy) aiTurn();
}

function aiTurn() {
  const tk = token;
  S.busy = true; S.think = true;
  renderStatus();
  setTimeout(() => {
    if (tk !== token) return;
    const m = chooseAIMove(S.board, 2, cfg.level);
    S.think = false;
    if (!m) { S.busy = false; S.turn = 1; S.note = '컴퓨터가 움직일 수 없어 내 차례예요.'; render(); return; }
    commit(m.f, m.t, tk, null, false);
  }, 380);
}

/* el: 드래그로 이미 화면 위에 올라와 있는 구슬 요소(있으면 홉 애니메이션 없이 바로 안착), remote: 상대가 둔 수 */
function commit(f, t, tk, el, remote) {
  const snap = { board: S.board.slice(), turn: S.turn, last: S.last, moves: S.moves };
  const p = S.turn;
  S.sel = null; S.dests = []; S.busy = true; S.note = '';
  const fin = () => {
    if (tk !== token) return;
    S.drag = null;
    S.hist.push(snap);
    S.board[t] = p; S.board[f] = 0;
    S.last = { f, t }; S.moves++; S.n++;
    S.busy = false; S.think = false; S.fx = t;
    FX.drop(); rippleAt(t);
    const w = winnerAfter(S.board, p);
    if (w) {
      S.winner = w; S.hideResult = false; render();
      if (isOnline() && !remote) pushState();
      setTimeout(() => { if (tk === token) { if (iWon(w)) { FX.win(); confetti(); } else FX.lose(); } }, 260);
      tryRemote();
      return;
    }
    const next = p === 1 ? 2 : 1;
    if (anyMove(S.board, next)) S.turn = next;
    else { S.turn = p; S.note = '상대가 움직일 수 없어 한 번 더 둡니다.'; }
    render();
    if (isOnline() && !remote) pushState();
    maybeAI();
    tryRemote();
  };
  if (el) {
    S.drag = { i: f };
    el.style.transition = 'transform 90ms ease-out';
    setPos(el, t);
    const l = el.querySelector('.lift'); if (l) l.classList.remove('up');
    setTimeout(fin, 100);
  } else {
    dests(S.board, f);
    const path = pathTo(f, t);
    animate(f, path, p, fin, tk, !!remote);
  }
}

function setPos(g, i) { const q = P(i); g.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px)'; }

function animate(f, path, p, done, tk, remote) {
  S.anim = { f };
  render();
  const layer = $('#pieces');
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pcg mover');
  g.innerHTML = pieceMarkup(p, { up: true, start: true });
  setPos(g, path[0]);
  layer.appendChild(g);
  if (reduceMotion) { S.anim = null; done(); return; }
  g.getBoundingClientRect();
  const l = g.querySelector('.lift'); if (l) l.classList.add('up');
  g.style.transition = 'transform 150ms ease-in-out';
  if (remote || (cfg.mode === 'ai' && p === 2)) FX.pick();
  let k = 1;
  const step = () => {
    if (tk !== token) return;
    if (k >= path.length) { S.anim = null; done(); return; }
    const kk = k;
    trailAt(path[k - 1], p);
    setPos(g, path[k]); k++;
    if (kk < path.length - 1) setTimeout(() => { if (tk === token) FX.hop(kk); }, 140);
    setTimeout(step, 175);
  };
  setTimeout(step, 70);
}

/* 키보드·탭으로 선택/이동 */
function pickPiece(i) {
  S.sel = i; S.dests = dests(S.board, i);
  if (S.dests.length) { S.note = ''; FX.pick(); }
  else { S.note = '이 말은 움직일 곳이 없어요.'; FX.bad(); }
  render();
}

function tap(i) {
  if (!humanTurn()) return;
  const v = S.board[i];
  if (v === S.turn) {
    if (S.sel === i) { S.sel = null; S.dests = []; S.note = ''; render(); }
    else pickPiece(i);
    return;
  }
  if (S.sel !== null && S.dests.indexOf(i) >= 0) { commit(S.sel, i, token, null, false); return; }
  if (S.sel !== null) { S.sel = null; S.dests = []; S.note = ''; render(); }
}

/* ---------- 드래그: 구슬을 쥐고 옮겨 놓기 ---------- */
const boardEl = $('#board');
let drag = null;

function svgPt(e) {
  try {
    const pt = boardEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = boardEl.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : null;
  } catch (err) { return null; }
}
function setSnap(d, on) {
  if (d === null || d === undefined) return;
  const el = $('#board .dest[data-d="' + d + '"]');
  if (el) el.classList.toggle('snapon', on);
}

function startDrag(e) {
  drag.mode = 'drag';
  S.drag = { i: drag.i };
  render();
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pcg drag');
  g.innerHTML = pieceMarkup(S.turn, { up: true, start: true });
  const p = svgPt(e) || P(drag.i);
  g.style.transform = 'translate(' + p.x + 'px,' + (p.y - (drag.touch ? 26 : 0)) + 'px)';
  $('#pieces').appendChild(g);
  drag.el = g;
  g.getBoundingClientRect();
  const l = g.querySelector('.lift'); if (l) l.classList.add('up');
}

function moveDrag(e) {
  const p = svgPt(e);
  if (!p) return;
  const x = p.x, y = p.y - (drag.touch ? 26 : 0);
  drag.el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  let best = null, bd = 22 * 22;
  for (const d of S.dests) {
    const q = P(d), dx = q.x - x, dy = q.y - y, dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = d; }
  }
  if (best !== drag.snap) {
    setSnap(drag.snap, false);
    drag.snap = best;
    setSnap(best, true);
    if (best !== null) FX.snap();
  }
}

boardEl.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  audio(); bgmSync();
  const t = e.target.closest && e.target.closest('[data-i]');
  if (!t || !humanTurn()) return;
  const i = +t.dataset.i;
  drag = {
    id: e.pointerId, i, x0: e.clientX, y0: e.clientY, mode: 'down',
    touch: e.pointerType === 'touch' || e.pointerType === 'pen',
    own: S.board[i] === S.turn, wasSel: S.sel === i, snap: null, el: null
  };
  try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  if (drag.own && !drag.wasSel) pickPiece(i);
});
boardEl.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'down') {
    if (!drag.own || S.sel !== drag.i || !S.dests.length) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    startDrag(e);
  }
  if (drag.mode === 'drag') moveDrag(e);
});
function endPointer(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  try { boardEl.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  if (d.mode === 'drag') {
    setSnap(d.snap, false);
    if (!cancelled && d.snap !== null) { commit(d.i, d.snap, token, d.el, false); return; }
    const tk = token, el = d.el;
    S.busy = true;
    el.style.transition = 'transform 140ms ease-out';
    setPos(el, d.i);
    const l = el.querySelector('.lift'); if (l) l.classList.remove('up');
    FX.snap();
    setTimeout(() => {
      if (tk !== token) return;
      S.busy = false; S.drag = null; S.sel = null; S.dests = []; S.note = '';
      render();
      tryRemote();
    }, 150);
    return;
  }
  if (cancelled) return;
  if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) return;
  if (d.own) {
    if (d.wasSel) { S.sel = null; S.dests = []; S.note = ''; render(); }
  } else tap(d.i);
}
boardEl.addEventListener('pointerup', e => endPointer(e, false));
boardEl.addEventListener('pointercancel', e => endPointer(e, true));
boardEl.addEventListener('contextmenu', e => e.preventDefault());
boardEl.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest('[data-i]');
  if (!t) return;
  e.preventDefault();
  S.focusI = +t.dataset.i;
  tap(S.focusI);
});

function undo() {
  if (isOnline() || S.busy || !S.hist.length) return;
  token++;
  let h = S.hist.pop();
  if (cfg.mode === 'ai' && h.turn === 2 && S.hist.length) h = S.hist.pop();
  S.board = h.board.slice(); S.turn = h.turn; S.last = h.last; S.moves = h.moves;
  S.winner = 0; S.sel = null; S.dests = []; S.note = ''; S.busy = false; S.think = false; S.anim = null; S.drag = null; S.hideResult = false;
  render();
  maybeAI();
}

function newGame() {
  resetState();
  render();
  maybeAI();
}

/* 상대(모드) 바꾸기 */
function onModeChange() {
  if (isOnline()) {
    leaveRoom(false);
    resetState();
    render(); renderOnline();
  } else {
    leaveRoom(false);
    newGame(); renderOnline();
  }
}

/* ---------- 허브 ---------- */
function miniStar() {
  let s = '<svg viewBox="-204 -236 408 472" width="60" height="69" aria-hidden="true">';
  CELLS.forEach((c, i) => {
    s += '<circle cx="' + POS[i].x + '" cy="' + POS[i].y + '" r="12.5" class="' + (c.z >= 5 ? 'm1' : c.z <= -5 ? 'm2' : 'm0') + '"/>';
  });
  return s + '</svg>';
}
function miniOmok() {
  let s = '<svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">';
  for (let k = 0; k < 5; k++) {
    const v = 10 + k * 10;
    s += '<line x1="10" y1="' + v + '" x2="50" y2="' + v + '" class="gl"/><line x1="' + v + '" y1="10" x2="' + v + '" y2="50" class="gl"/>';
  }
  const st = [[20, 20, 'b'], [30, 20, 'w'], [30, 30, 'b'], [40, 30, 'w'], [40, 40, 'b']];
  st.forEach(a => { s += '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="4.6" class="' + (a[2] === 'b' ? 'stb' : 'stw') + '"/>'; });
  return s + '</svg>';
}
function miniDash() {
  return '<svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true"><rect x="7" y="7" width="46" height="46" rx="10" class="dash"/></svg>';
}
const GAMES = [
  { id: 'diamond', name: '다이아몬드 게임', ready: true, mini: miniStar, meta: '2인 · 컴퓨터 · 온라인 대전',
    desc: '별 모양 판에서 내 구슬 10개를 반대편 진영으로 먼저 옮기면 이겨요. 구슬을 뛰어넘어 길게 이어 가는 게 핵심이에요.' },
  { id: 'hobak', name: '호박고누', ready: false, mini: miniDash, meta: '2인',
    desc: '한국 전통 고누예요. 규칙을 확정한 뒤에 추가해요.' },
  { id: 'omok', name: '오목', ready: true, mini: miniOmok, meta: '2인 · 컴퓨터 · 온라인 대전',
    desc: '돌 다섯 개를 먼저 한 줄로 이으면 이겨요. 손가락 위로 돌이 떠서, 놓을 자리를 가리지 않고 맞출 수 있어요.' }
];
function renderHub() {
  $('#games').innerHTML = GAMES.map(g =>
    '<li><button type="button" class="game" data-id="' + g.id + '"' + (g.ready ? '' : ' disabled') + '>' +
    '<span class="mini">' + g.mini() + '</span>' +
    '<span class="gtext"><span class="gname">' + g.name + '<span class="chip' + (g.ready ? ' go' : '') + '">' + (g.ready ? '바로 하기' : '준비 중') + '</span></span>' +
    '<span class="gdesc">' + g.desc + '</span><span class="gmeta">' + g.meta + '</span></span></button></li>'
  ).join('');
}

function show(v) {
  view = v;
  document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
  $('#view-hub').hidden = v !== 'hub';
  $('#view-diamond').hidden = v !== 'diamond';
  const ov = $('#view-omok'); if (ov) ov.hidden = v !== 'omok';
  if (v === 'omok') {
    token++; S.busy = false; S.think = false; S.anim = null; S.drag = null;
    if (window.omokEnter) window.omokEnter();
  } else if (window.omokLeave) window.omokLeave();
  if (v === 'diamond') {
    if (S.busy && S.think) { S.busy = false; S.think = false; }
    render();
    maybeAI();
    tryRemote();
  } else if (v !== 'omok') {
    token++;
    S.busy = false; S.think = false; S.anim = null; S.drag = null;
  }
  try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ }
}

/* ---------- 이벤트 ---------- */
$('#games').addEventListener('click', e => {
  const b = e.target.closest('.game');
  if (b && !b.disabled) show(b.dataset.id);
});

/* 설정 시트(좁은 화면) */
(function () {
  const setP = (p, on) => {
    p.classList.toggle('open', on);
    const g = document.querySelector('.gear[data-p="' + p.id + '"]');
    if (g) g.setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  document.addEventListener('click', e => {
    const g = e.target.closest('.gear');
    if (g) { const p = document.getElementById(g.dataset.p); setP(p, !p.classList.contains('open')); return; }
    if (e.target.closest('.pclose')) { setP(e.target.closest('.panel'), false); return; }
    document.querySelectorAll('.panel.open').forEach(p => { if (!e.composedPath().includes(p)) setP(p, false); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.panel.open').forEach(p => setP(p, false)); });
})();
$('#back').addEventListener('click', () => show('hub'));
$('#undo').addEventListener('click', undo);
$('#again').addEventListener('click', requestNew);
$('#rAgain').addEventListener('click', requestNew);
$('#rView').addEventListener('click', () => { S.hideResult = true; renderStatus(); });
$('#settings').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const def = settingsDef().find(s => s.key === b.dataset.k);
  cfg[b.dataset.k] = b.dataset.v;
  store.set('cg.diamond.cfg', JSON.stringify(cfg));
  renderSettings();
  if (def && def.live) {
    if (b.dataset.k === 'sound' && b.dataset.v === 'on') FX.pick();
    else if (b.dataset.k === 'haptic' && b.dataset.v === 'on') haptic('pick');
    else if (b.dataset.k === 'bgm') bgmSync();
  } else if (b.dataset.k === 'mode') onModeChange();
  else newGame();
});
$('#online').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'olNew') createRoom();
  else if (b.id === 'olJoin') joinByCode($('#olCode').value);
  else if (b.id === 'olCopy') copyText(location.origin + location.pathname + '?r=' + OL.code, b);
  else if (b.id === 'olLeave') { leaveRoom(true); resetState(); render(); renderOnline(); }
});
$('#online').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'olCode') joinByCode(e.target.value);
});

/* ---------- 시작 ---------- */
function onCaps() {
  renderSettings();
  if (wantOnline) {
    wantOnline = false;
    if (onlineOK()) { cfg.mode = 'online'; renderSettings(); onModeChange(); }
  } else if (isOnline() && !onlineOK()) { cfg.mode = 'ai'; newGame(); }
  renderOnline();
}
function start(data) {
  bgmProbe();
  renderHub();
  resetState();
  if (data && data.board) {
    Object.assign(cfg, data.cfg || {});
    if (cfg.mode === 'online') { wantOnline = true; cfg.mode = 'ai'; }
    S.board = Int8Array.from(data.board);
    S.turn = data.turn; S.moves = data.moves || 0; S.last = data.last || null; S.winner = data.winner || 0;
    S.hist = (data.hist || []).map(h => ({ board: Int8Array.from(h.board), turn: h.turn, last: h.last, moves: h.moves }));
    view = data.view || 'hub';
  }
  renderSettings();
  renderOnline();
  if (window.matchMedia && matchMedia('(min-width: 820px)').matches) $('#rules').open = true;
  show(view);
  loadCaps();
}
function loadCaps() {
  onCaps();
  try {
    const r = new URLSearchParams(location.search).get('r');
    if (r && /^[a-z0-9]{4}$/i.test(r) && onlineOK()) {
      cfg.mode = 'online'; renderSettings(); show('diamond'); onModeChange();
      joinByCode(r);
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
    }
  } catch (e) { /* 무시 */ }
}
try {
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(() => ({
      cfg: Object.assign({}, cfg, { mode: cfg.mode === 'online' ? 'ai' : cfg.mode }),
      view, board: Array.from(S.board), turn: S.turn, moves: S.moves, last: S.last, winner: S.winner,
      hist: S.hist.map(h => ({ board: Array.from(h.board), turn: h.turn, last: h.last, moves: h.moves }))
    }));
  }
} catch (e) { /* 선택 기능 */ }
try {
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
} catch (e) { start({}); }
