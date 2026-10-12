/* ===== 다이아몬드 게임 코어 (순수 로직, UI 없음) =====
   좌표: 큐브 좌표 (x,y,z), x+y+z=0.
   별판 = {세 좌표 모두 >= -4} 합집합 {세 좌표 모두 <= 4} = 121칸.
   플레이어 1 = 아래쪽(z>=5) 진영에서 출발, 플레이어 2 = 위쪽(z<=-5) 진영에서 출발. */
const DIRS = [[1,-1,0],[-1,1,0],[1,0,-1],[-1,0,1],[0,1,-1],[0,-1,1]];
const CELLS = [];
const IDX = new Map();
for (let z = -8; z <= 8; z++) {
  for (let x = -8; x <= 8; x++) {
    const y = -x - z;
    if (y < -8 || y > 8) continue;
    const mn = Math.min(x, y, z), mx = Math.max(x, y, z);
    if (mn >= -4 || mx <= 4) { IDX.set(x + ',' + y + ',' + z, CELLS.length); CELLS.push({ x, y, z }); }
  }
}
const N = CELLS.length; // 121
const NB = new Int16Array(N * 6).fill(-1); // 이웃 칸
const JP = new Int16Array(N * 6).fill(-1); // 두 칸 건너 착지 칸
for (let i = 0; i < N; i++) {
  const c = CELLS[i];
  for (let d = 0; d < 6; d++) {
    const dx = DIRS[d][0], dy = DIRS[d][1], dz = DIRS[d][2];
    let j = IDX.get((c.x + dx) + ',' + (c.y + dy) + ',' + (c.z + dz));
    NB[i * 6 + d] = j === undefined ? -1 : j;
    j = IDX.get((c.x + 2 * dx) + ',' + (c.y + 2 * dy) + ',' + (c.z + 2 * dz));
    JP[i * 6 + d] = j === undefined ? -1 : j;
  }
}
const HOME = [null, [], []];
CELLS.forEach((c, i) => { if (c.z >= 5) HOME[1].push(i); else if (c.z <= -5) HOME[2].push(i); });
const ISGOAL = [null, new Uint8Array(N), new Uint8Array(N)];
HOME[2].forEach(i => { ISGOAL[1][i] = 1; });
HOME[1].forEach(i => { ISGOAL[2][i] = 1; });
const APEX = [null, IDX.get('4,4,-8'), IDX.get('-4,-4,8')];
const DA = [null, new Int8Array(N), new Int8Array(N)]; // 목표 꼭짓점까지의 칸 수
for (let p = 1; p <= 2; p++) {
  const a = CELLS[APEX[p]];
  for (let i = 0; i < N; i++) {
    const c = CELLS[i];
    DA[p][i] = Math.max(Math.abs(c.x - a.x), Math.abs(c.y - a.y), Math.abs(c.z - a.z));
  }
}

function newBoard() {
  const b = new Int8Array(N);
  HOME[1].forEach(i => { b[i] = 1; });
  HOME[2].forEach(i => { b[i] = 2; });
  return b;
}

const vis = new Int32Array(N);
const got = new Int32Array(N);
const HPAR = new Int16Array(N);
let stamp = 0;

/* from 칸의 말이 갈 수 있는 모든 칸. 한 칸 이동 + 연속 점프의 모든 중간·최종 착지 칸. */
function dests(board, from) {
  stamp++;
  const res = [];
  const saved = board[from];
  board[from] = 0; // 출발한 말은 자기 자리를 비운 것으로 본다
  for (let d = 0; d < 6; d++) {
    const n = NB[from * 6 + d];
    if (n >= 0 && board[n] === 0) { got[n] = stamp; res.push(n); }
  }
  vis[from] = stamp;
  const queue = [from];
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h];
    for (let d = 0; d < 6; d++) {
      const m = NB[c * 6 + d];
      if (m < 0 || board[m] === 0) continue;
      const j = JP[c * 6 + d];
      if (j < 0 || board[j] !== 0 || vis[j] === stamp) continue;
      vis[j] = stamp;
      HPAR[j] = c;
      if (got[j] !== stamp) { got[j] = stamp; res.push(j); }
      queue.push(j);
    }
  }
  board[from] = saved;
  return res;
}

/* dests(board, from) 직후에 호출: from -> to 이동 경로(칸 인덱스 배열). */
function pathTo(from, to) {
  for (let d = 0; d < 6; d++) if (NB[from * 6 + d] === to) return [from, to];
  const p = [to];
  let c = to;
  let guard = 0;
  while (c !== from && guard++ < 200) { c = HPAR[c]; p.push(c); }
  return p.reverse();
}

function countGoal(board, p) {
  const g = HOME[p === 1 ? 2 : 1];
  let n = 0;
  for (const i of g) if (board[i] === p) n++;
  return n;
}

/* 목표 진영이 모두 차 있고 내 말이 하나 이상이면 승리 (상대 말이 남아 막고 있어도 인정) */
function hasWon(board, p) {
  const g = HOME[p === 1 ? 2 : 1];
  let mine = 0;
  for (const i of g) {
    if (board[i] === 0) return false;
    if (board[i] === p) mine++;
  }
  return mine > 0;
}

function winnerAfter(board, mover) {
  const other = mover === 1 ? 2 : 1;
  if (hasWon(board, mover)) return mover;
  if (hasWon(board, other)) return other;
  return 0;
}

function anyMove(board, p) {
  for (let i = 0; i < N; i++) if (board[i] === p && dests(board, i).length > 0) return true;
  return false;
}

/* ---------- AI ---------- */
function evaluate(board, ai) {
  const opp = ai === 1 ? 2 : 1;
  let sa = 0, so = 0, ma = 0, mo = 0;
  for (let i = 0; i < N; i++) {
    const v = board[i];
    if (v === ai) { const d = DA[ai][i]; sa += d; if (d > ma) ma = d; }
    else if (v === opp) { const d = DA[opp][i]; so += d; if (d > mo) mo = d; }
  }
  return (so - sa) + 0.5 * (mo - ma);
}

function genOrdered(board, p, K) {
  const list = [];
  for (let i = 0; i < N; i++) {
    if (board[i] !== p) continue;
    const ds = dests(board, i);
    const di = DA[p][i];
    for (let k = 0; k < ds.length; k++) {
      const t = ds[k];
      list.push({ f: i, t, s: di - DA[p][t] + di * 0.02 + Math.random() * 0.3 });
    }
  }
  list.sort((a, b) => b.s - a.s);
  return K && list.length > K ? list.slice(0, K) : list;
}

function minimax(board, p, depth, alpha, beta, ai, K) {
  if (depth === 0) return evaluate(board, ai);
  const moves = genOrdered(board, p, K);
  if (!moves.length) return evaluate(board, ai);
  const opp = p === 1 ? 2 : 1;
  const maxing = p === ai;
  let best = maxing ? -Infinity : Infinity;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    board[m.t] = p; board[m.f] = 0;
    let v;
    if (ISGOAL[p][m.t] && hasWon(board, p)) v = (maxing ? 1 : -1) * (100000 + depth);
    else v = minimax(board, opp, depth - 1, alpha, beta, ai, K);
    board[m.f] = p; board[m.t] = 0;
    if (maxing) { if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}

const LEVELS = { easy: { depth: 0, K: 0 }, normal: { depth: 2, K: 16 }, hard: { depth: 4, K: 16 } };

function chooseAIMove(board, ai, level) {
  const opp = ai === 1 ? 2 : 1;
  const cfg = LEVELS[level] || LEVELS.normal;
  const root = genOrdered(board, ai, 0);
  if (!root.length) return null;
  for (const m of root) {
    if (!ISGOAL[ai][m.t]) continue;
    board[m.t] = ai; board[m.f] = 0;
    const w = hasWon(board, ai);
    board[m.f] = ai; board[m.t] = 0;
    if (w) return m;
  }
  if (cfg.depth === 0) {
    const top = root.slice(0, 8);
    const r = Math.random();
    return top[Math.min(top.length - 1, Math.floor(r * r * top.length))];
  }
  const cand = root.slice(0, Math.max(cfg.K + 8, 20));
  let best = null, bv = -Infinity;
  for (const m of cand) {
    board[m.t] = ai; board[m.f] = 0;
    const v = minimax(board, opp, cfg.depth - 1, bv, Infinity, ai, cfg.K) + Math.random() * 0.05;
    board[m.f] = ai; board[m.t] = 0;
    if (v > bv) { bv = v; best = m; }
  }
  return best || cand[0];
}

