/* ===== 튜토리얼: 게임마다 처음 한 번은 끝까지 봐야 하고, 이후엔 상단 버튼으로 언제든 다시 볼 수 있다 ===== */
(function () {
  const $t = (s) => document.querySelector(s);
  const KEY = id => 'cg.tut.' + id;
  const W = inner => '<svg viewBox="0 0 280 150" width="100%" height="150" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const marble = (x, y, c, extra) => '<g' + (extra || '') + '><ellipse cx="' + (x + 1.5) + '" cy="' + (y + 4) + '" rx="10" ry="5" fill="#000" opacity="0.28"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="10.5" fill="var(--' + c + ')" stroke="var(--' + c + '-ink)" stroke-width="1.2"/>' +
    '<ellipse cx="' + (x - 3.4) + '" cy="' + (y - 4.4) + '" rx="3.6" ry="2" transform="rotate(-32 ' + (x - 3.4) + ' ' + (y - 4.4) + ')" fill="#fff" opacity="0.75"/></g>';
  const hole = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="11" fill="#16211C"/>';
  const dest = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="var(--gold)" class="tpulse"/>';
  const arc = (x1, x2, y) => '<path d="M' + x1 + ' ' + y + ' Q' + ((x1 + x2) / 2) + ' ' + (y - 34) + ' ' + x2 + ' ' + y + '" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round"/>' +
    '<path d="M' + (x2 - 7) + ' ' + (y - 9) + ' L' + x2 + ' ' + y + ' L' + (x2 - 10) + ' ' + (y - 1) + '" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  const lbl = (x, y, t, anchor, c) => '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" font-size="12" font-weight="600" fill="' + (c || 'var(--ink-2)') + '">' + t + '</text>';
  const PL = '#D9D5CC';
  const panel = inner => '<rect x="4" y="4" width="272" height="142" rx="14" fill="var(--board-lo)" opacity="0.9"/>' + inner;

  /* ----- 다이아몬드 ----- */
  const triCells = (cx, y0, dir, fill) => {
    let s = '';
    for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) s += '<circle cx="' + (cx + (k - r / 2) * 18) + '" cy="' + (y0 + dir * r * 15.6) + '" r="6.4" fill="' + fill + '"/>';
    return s;
  };
  const diaGoal = () => W(panel(
    triCells(140, 14, 1, 'var(--blue)') + triCells(140, 136, -1, 'var(--red)') +
    '<path d="M92 112 C 60 90 60 60 92 38" fill="none" stroke="var(--gold)" stroke-width="2.6" stroke-dasharray="6 5" stroke-linecap="round"/>' +
    '<path d="M84 47 L92 38 L97 50" fill="none" stroke="var(--gold)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    lbl(226, 76, '반대편 진영', 'middle', 'var(--gold)') + lbl(226, 92, '10칸 먼저 채우기', 'middle', PL)));
  const diaMove = () => {
    const cx = 140, cy = 78, d = 36;
    const nb = [[-d, 0], [d, 0], [-d / 2, -d * 0.866], [d / 2, -d * 0.866], [-d / 2, d * 0.866], [d / 2, d * 0.866]];
    let s = '';
    nb.forEach(n => { s += hole(cx + n[0], cy + n[1]); });
    nb.forEach(n => { s += dest(cx + n[0], cy + n[1]); });
    return W(panel(hole(cx, cy) + s + '<circle cx="' + cx + '" cy="' + cy + '" r="16" fill="none" stroke="var(--gold)" stroke-width="2.8"/>' + marble(cx, cy, 'red')));
  };
  const diaHop = () => {
    const y = 88, xs = [40, 74, 108, 142, 176, 210];
    let s = xs.map(x => hole(x, y)).join('');
    s += marble(40, y, 'red') + marble(74, y, 'blue') + marble(142, y, 'blue');
    s += dest(108, y) + dest(176, y);
    s += arc(40, 108, y - 12) + arc(108, 176, y - 12);
    s += lbl(140, 30, '뛰어넘고, 또 뛰어넘고!', 'middle', 'var(--gold)') + lbl(140, 128, '한 턴에 계속 이어 갈 수 있어요', 'middle', PL);
    return W(panel(s));
  };
  const diaControl = () => W(panel(
    hole(70, 100) + hole(206, 100) + dest(206, 100) +
    '<path d="M86 84 C 120 40 170 40 198 86" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>' +
    marble(72, 72, 'red', ' class="tlift"') +
    lbl(70, 130, '집어서', 'middle', PL) + lbl(206, 130, '내려놓기', 'middle', PL) + lbl(140, 28, '끌어서 놓거나, 눌러서 고르고 눌러서 놓아요', 'middle', PL)));

  /* ----- 오목 ----- */
  const gridBoard = (cols, rows, x0, y0, g) => {
    let s = '<rect x="' + (x0 - 14) + '" y="' + (y0 - 14) + '" width="' + ((cols - 1) * g + 28) + '" height="' + ((rows - 1) * g + 28) + '" rx="8" fill="#C9985A"/>';
    for (let i = 0; i < cols; i++) s += '<line x1="' + (x0 + i * g) + '" y1="' + y0 + '" x2="' + (x0 + i * g) + '" y2="' + (y0 + (rows - 1) * g) + '" stroke="#5A3F1E" stroke-width="1"/>';
    for (let j = 0; j < rows; j++) s += '<line x1="' + x0 + '" y1="' + (y0 + j * g) + '" x2="' + (x0 + (cols - 1) * g) + '" y2="' + (y0 + j * g) + '" stroke="#5A3F1E" stroke-width="1"/>';
    return s;
  };
  const stone = (x, y, p, o) => '<circle cx="' + (x + 1) + '" cy="' + (y + 2) + '" r="9" fill="#000" opacity="0.25"/><circle cx="' + x + '" cy="' + y + '" r="9" fill="' + (p === 1 ? '#161C19' : '#F4F6F2') + '" stroke="' + (p === 1 ? '#000' : '#9AA39D') + '" stroke-width="0.6" opacity="' + (o || 1) + '"/>' +
    '<ellipse cx="' + (x - 3) + '" cy="' + (y - 3.5) + '" rx="3" ry="1.7" fill="#fff" opacity="' + (p === 1 ? 0.35 : 0.9) + '" transform="rotate(-30 ' + (x - 3) + ' ' + (y - 3.5) + ')"/>';
  const omkGoal = () => {
    const x0 = 48, y0 = 26, g = 26;
    let s = gridBoard(8, 5, x0, y0, g);
    s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + (x0 + 4 * g) + '" y2="' + (y0 + 4 * g) + '" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" opacity="0.8"/>';
    for (let k = 0; k < 5; k++) s += stone(x0 + k * g, y0 + k * g, 1);
    s += stone(x0 + 5 * g, y0 + 1 * g, 2) + stone(x0 + 3 * g, y0 + 0 * g, 2) + stone(x0 + 6 * g, y0 + 3 * g, 2);
    return W(s);
  };
  const omkTurn = () => {
    const x0 = 62, y0 = 30, g = 26;
    let s = gridBoard(7, 4, x0, y0, g);
    s += stone(x0 + 2 * g, y0 + 1 * g, 1) + stone(x0 + 3 * g, y0 + 1 * g, 2) + stone(x0 + 3 * g, y0 + 2 * g, 1) + stone(x0 + 4 * g, y0 + 2 * g, 2);
    s += '<circle cx="' + (x0 + 4 * g) + '" cy="' + (y0 + 2 * g) + '" r="3.2" fill="var(--red)"/>';
    return W(s + lbl(140, 140, '검은 돌이 먼저, 번갈아 한 개씩', 'middle', 'var(--ink-2)'));
  };
  const omkTouch = () => {
    const x0 = 62, y0 = 40, g = 26;
    let s = gridBoard(7, 4, x0, y0, g);
    s += stone(x0 + 1 * g, y0 + 1 * g, 1) + stone(x0 + 2 * g, y0 + 2 * g, 2);
    const tx = x0 + 4 * g, ty = y0 + 2 * g;
    s += '<line x1="' + (tx - 11) + '" y1="' + ty + '" x2="' + (tx + 11) + '" y2="' + ty + '" stroke="var(--red)" stroke-width="1.6"/><line x1="' + tx + '" y1="' + (ty - 11) + '" x2="' + tx + '" y2="' + (ty + 11) + '" stroke="var(--red)" stroke-width="1.6"/>';
    s += '<g class="tlift">' + stone(tx, ty - 24, 1, 0.8) + '</g>';
    s += '<circle cx="' + tx + '" cy="' + (ty + 30) + '" r="13" fill="#fff" opacity="0.55" stroke="var(--ink-2)" stroke-width="1.2"/>';
    return W(s);
  };
  const omkModes = () => W(
    '<g font-size="13" font-weight="700">' +
    ['컴퓨터와', '친구와 한 화면에서', '링크로 온라인'].map((t, i) => '<rect x="40" y="' + (22 + i * 38) + '" width="200" height="30" rx="15" fill="var(--surface)" stroke="var(--line)"/><text x="140" y="' + (42 + i * 38) + '" text-anchor="middle" fill="var(--ink)">' + t + '</text>').join('') + '</g>');

  /* ----- 승경도 ----- */
  const sgLadder = () => {
    let s = '';
    const names = ['종9품', '종7품', '종5품', '정3품', '정1품'];
    names.forEach((n, i) => {
      const x = 20 + i * 48, h = 24 + i * 18, y = 132 - h;
      const c = ['var(--blue)', 'var(--blue)', '#2E6A56', 'var(--gold)', 'var(--red)'][i];
      s += '<rect x="' + x + '" y="' + y + '" width="44" height="' + h + '" rx="5" fill="' + c + '" opacity="0.9"/><text x="' + (x + 22) + '" y="' + (y + 15) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">' + n + '</text>';
    });
    s += marble(42, 108, 'red');
    s += '<path d="M54 92 C 96 40 150 70 214 30" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="5 5" stroke-linecap="round"/>' + lbl(236, 24, '영의정', 'middle', 'var(--gold)');
    return W(s);
  };
  const sgYun = () => W(
    '<g transform="rotate(-14 110 78)"><rect x="46" y="52" width="128" height="52" rx="20" fill="#C9985A" stroke="#6B4A22" stroke-width="2"/>' +
    '<rect x="52" y="58" width="116" height="14" rx="7" fill="#fff" opacity="0.18"/><text x="110" y="92" text-anchor="middle" font-size="30" font-weight="800" fill="#3B2A12">3</text></g>' +
    '<path d="M196 80 L236 80" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/><path d="M228 72 L238 80 L228 88" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    lbl(216, 108, '3칸 전진', 'middle', 'var(--gold)') + lbl(110, 30, '윤목: 1~5가 나와요', 'middle', 'var(--ink-2)'));
  const sgAppeal = () => W(panel(
    '<rect x="64" y="34" width="62" height="84" rx="8" fill="#EFE6D0" stroke="#8A7550" stroke-width="2"/><g stroke="#8A7550" stroke-width="2" stroke-linecap="round"><path d="M76 54h38M76 70h38M76 86h26"/></g>' +
    '<text x="95" y="108" text-anchor="middle" font-size="13" font-weight="800" fill="var(--red)">上疏</text>' +
    '<text x="170" y="62" font-size="26" font-weight="800" fill="#fff">2</text><text x="190" y="62" font-size="14" fill="#fff">→ 다시!</text>' +
    lbl(190, 88, '결과가 별로면 상소로 다시', 'middle', 'var(--gold)') + lbl(190, 106, '한 판에 2번만 쓸 수 있어요', 'middle', PL)));
  const sgTiles = () => {
    const items = [['암행어사', '+3', 'g'], ['특진', '+2', 'g'], ['어명', '상소+1', 'g'], ['탄핵', '−2', 'b'], ['사약', '−3', 'b'], ['파직', '−4', 'b'], ['귀양', '쉼', 'b']];
    let s = '';
    items.forEach((it, i) => {
      const col = i % 2, row = (i / 2) | 0, x = 14 + col * 134, y = 10 + row * 34;
      s += '<rect x="' + x + '" y="' + y + '" width="124" height="28" rx="8" fill="var(--surface)" stroke="var(--line)"/><text x="' + (x + 10) + '" y="' + (y + 19) + '" font-size="12.5" font-weight="700" fill="var(--ink)">' + it[0] + '</text><text x="' + (x + 114) + '" y="' + (y + 19) + '" text-anchor="end" font-size="12.5" font-weight="800" fill="' + (it[2] === 'g' ? 'var(--accent-ink,#2E6A56)' : 'var(--red-ink)') + '">' + it[1] + '</text>';
    });
    return W(s);
  };
  const sgBump = () => W(panel(
    '<rect x="40" y="48" width="86" height="50" rx="9" fill="var(--surface)" stroke="var(--line)"/><rect x="154" y="48" width="86" height="50" rx="9" fill="var(--surface)" stroke="var(--line)"/>' +
    marble(83, 72, 'blue') + marble(70, 72, 'red') +
    '<path d="M100 40 C 120 14 150 14 168 40" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round"/>' +
    lbl(83, 118, '상대가 있는 칸에 멈추면', 'middle', PL) + lbl(197, 74, '상대 −2칸', 'middle', 'var(--red-ink)')));


  /* ----- 호박고누 ----- */
  const hbNode = (x, y, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + (c ? 9 : 4) + '" fill="' + (c ? 'var(--' + c + ')' : 'var(--ink-2)') + '"' + (c ? ' stroke="var(--' + c + '-ink)" stroke-width="1.2"' : '') + '/>';
  const hbLine = (a, b, c) => '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + (c || 'var(--ink-2)') + '" stroke-width="2" opacity="0.7"/>';
  const HB = { r: [[100, 124], [140, 124], [180, 124]], b: [[100, 24], [140, 24], [180, 24]], c: [140, 74] };
  const hbBoard = (reds, blues, extra) => {
    let s = '<circle cx="140" cy="74" r="40" fill="none" stroke="var(--ink-2)" stroke-width="2" opacity="0.7"/>' +
      hbLine([140, 34], [140, 114]) + hbLine([100, 74], [180, 74]) + hbLine([140, 24], [140, 34]) + hbLine([140, 114], [140, 124]) +
      hbLine(HB.b[0], HB.b[1]) + hbLine(HB.b[1], HB.b[2]) + hbLine(HB.r[0], HB.r[1]) + hbLine(HB.r[1], HB.r[2]);
    [[140, 34], [180, 74], [140, 114], [100, 74], HB.c].forEach(p => { s += hbNode(p[0], p[1]); });
    HB.b.concat(HB.r).forEach(p => { s += hbNode(p[0], p[1]); });
    return W(s + (extra || '') + reds.map(p => marble(p[0], p[1], 'red')).join('') + blues.map(p => marble(p[0], p[1], 'blue')).join(''));
  };
  const hbGoal = () => hbBoard(HB.r, HB.b, lbl(236, 70, '상대를', 'middle', 'var(--gold)') + lbl(236, 88, '막아 보세요', 'middle', PL));
  const hbMove = () => hbBoard([HB.r[0], HB.r[2], [140, 114]], HB.b,
    dest(100, 74) + dest(180, 74) + dest(140, 74) +
    '<circle cx="140" cy="114" r="15" fill="none" stroke="var(--gold)" stroke-width="2.6"/>');
  const hbNoBack = () => hbBoard([HB.r[0], HB.r[2], [180, 74]], [HB.b[0], HB.b[2], [100, 74]],
    '<path d="M168 82 C 160 108 150 118 140 122" fill="none" stroke="var(--red-ink)" stroke-width="2.4" stroke-dasharray="4 4" stroke-linecap="round"/>' +
    '<path d="M132 114 L146 130 M146 114 L132 130" stroke="var(--red-ink)" stroke-width="3" stroke-linecap="round" transform="translate(-4 -2)"/>' +
    lbl(60, 148, '집을 떠난 말은 어느 집에도 못 들어가요', 'start', PL));
  const hbBlock = () => hbBoard([[140, 34], HB.r[1], HB.r[2]], HB.b,
    '<rect x="84" y="9" width="112" height="30" rx="15" fill="none" stroke="var(--gold)" stroke-width="2.4"/>' + lbl(240, 70, '못 움직이면', 'middle', 'var(--gold)') + lbl(240, 88, '져요', 'middle', PL));

  /* ----- 솔리테어 ----- */
  const card = (x, y, up, txt, red) => '<rect x="' + x + '" y="' + y + '" width="34" height="48" rx="5" fill="' + (up ? '#fff' : 'var(--blue)') + '" stroke="' + (up ? '#B9B4A8' : 'var(--blue-ink)') + '" stroke-width="1.2"/>' +
    (up ? '<text x="' + (x + 6) + '" y="' + (y + 18) + '" font-size="14" font-weight="800" fill="' + (red ? '#C0432E' : '#1B1A17') + '">' + txt + '</text>' : '');
  const solGoal = () => {
    let s = '';
    ['♠', '♥', '♣', '♦'].forEach((c, i) => { s += card(24 + i * 40, 20, true, 'A', i % 2 === 1 || i === 3).replace('>A<', '>' + c + '<') ; });
    s += lbl(140, 92, 'A부터 K까지 무늬별로', 'middle', 'var(--gold)') + lbl(140, 112, '네 줄을 모두 쌓으면 이겨요', 'middle', PL);
    return W(panel(s));
  };
  const solStack = () => W(panel(
    card(60, 20, true, '8♠') + card(60, 44, true, '7♥', true) + card(60, 68, true, '6♣') +
    card(170, 20, true, '8♥', true) + '<path d="M138 70 L166 70" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="5 4"/>' + card(170, 58, true, '7♠') +
    lbl(140, 140, '빨강·검정을 번갈아, 큰 수에서 작은 수로', 'middle', PL)));
  const solTap = () => W(panel(
    card(40, 40, false) + card(92, 40, true, '5♦', true) +
    '<path d="M140 62 C 170 40 190 40 214 62" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round"/>' +
    card(204, 40, true, '4♠') +
    lbl(57, 108, '덱', 'middle', PL) + lbl(109, 108, '눌러서', 'middle', 'var(--gold)') + lbl(221, 108, '자동으로 이동', 'middle', PL) +
    lbl(140, 134, '카드를 누르면 갈 수 있는 곳으로 가요. 끌어서 놓아도 돼요', 'middle', PL)));
  const solK = () => W(panel(
    '<rect x="103" y="30" width="34" height="48" rx="5" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 4"/>' +
    card(160, 30, true, 'K♥', true) + '<path d="M146 54 L152 54" stroke="var(--gold)" stroke-width="2.4"/>' +
    lbl(120, 100, '빈 줄', 'middle', PL) + lbl(177, 100, 'K만', 'middle', 'var(--gold)') + lbl(140, 128, '빈 줄에는 K(또는 K로 시작한 묶음)만 놓아요', 'middle', PL)));
  const solTools = () => W(
    '<g font-size="13" font-weight="700">' + ['되돌리기로 한 수 취소', '자동 완성으로 마무리', '1장 / 3장 뽑기는 설정에서'].map((t, i) =>
      '<rect x="40" y="' + (22 + i * 38) + '" width="200" height="30" rx="15" fill="var(--surface)" stroke="var(--line)"/><text x="140" y="' + (42 + i * 38) + '" text-anchor="middle" fill="var(--ink)">' + t + '</text>').join('') + '</g>');

  const STEPS = {
    diamond: [
      { t: '목표', d: '별 모양 판에서 <b>내 구슬 10개</b>를 <b>반대편 삼각형 진영</b>으로 먼저 옮기면 이겨요.', a: diaGoal },
      { t: '한 칸 움직이기', d: '구슬을 누르면 갈 수 있는 곳에 <b>노란 점</b>이 떠요. 이웃한 빈 칸으로 한 칸씩 갈 수 있어요.', a: diaMove },
      { t: '뛰어넘기', d: '바로 옆 구슬(내 것이든 상대 것이든)을 <b>뛰어넘어</b> 그 뒤 빈 칸에 내려요. 뛰어넘은 자리에서 또 뛰어넘을 수 있으면 한 턴에 계속 이어 가요. 구슬을 잡지는 않아요.', a: diaHop },
      { t: '놓는 법', d: '구슬을 <b>끌어서</b> 노란 점에 놓거나, 눌러서 고른 뒤 도착할 곳을 눌러도 돼요. 설정은 위쪽 <b>설정</b> 버튼에 있어요.', a: diaControl }
    ],
    omok: [
      { t: '목표', d: '가로, 세로, 대각선 어느 방향이든 내 돌 <b>다섯 개</b>를 먼저 한 줄로 이으면 이겨요. 여섯 개 이상도 승리예요.', a: omkGoal },
      { t: '차례', d: '<b>검은 돌이 먼저</b> 두고, 번갈아 가며 교차점에 돌을 하나씩 놓아요. 금수(3·3 같은 제한)는 없는 자유룰이에요.', a: omkTurn },
      { t: '놓는 법', d: '교차점에 <b>손을 대고 끌어</b> 맞춰 보세요. 손가락 위쪽에 돌이 떠서 가리지 않아요. 자리를 맞춘 뒤 손을 떼면 놓여요.', a: omkTouch },
      { t: '누구와 할까요', d: '<b>컴퓨터</b>와 겨루거나, 한 화면에서 <b>둘이서</b>, 링크를 보내 <b>온라인</b>으로 할 수 있어요. 위쪽 설정 버튼에서 바꿔요.', a: omkModes }
    ],
    seung: [
      { t: '목표', d: '말은 <b>종9품</b>에서 출발해요. 관직 칸을 올라 <b>정1품 영의정</b>에 먼저 오르면 이겨요.', a: sgLadder },
      { t: '윤목 굴리기', d: '내 차례에 <b>윤목</b>을 굴리면 1~5가 나와요. 나온 수만큼 관직 칸을 앞으로 나아가요.', a: sgYun },
      { t: '상소(다시 굴리기)', d: '나온 수가 마음에 안 들면 <b>상소</b>로 다시 굴릴 수 있어요. 한 판에 <b>2번</b>이고, 다시 굴린 결과는 따라야 해요.', a: sgAppeal },
      { t: '특별한 칸', d: '일부 칸에 멈추면 일이 생겨요. 암행어사·특진은 앞으로, 탄핵·사약·파직은 뒤로, 귀양은 한 번 쉬어요. 어명을 받으면 상소가 하나 늘어요.', a: sgTiles },
      { t: '정적 견제', d: '상대가 서 있는 칸에 멈추면 상대를 <b>2칸 뒤로</b> 보내요. 앞서 가는 상대를 따라잡을 기회예요.', a: sgBump }
    ],
    hobak: [
      { t: '목표', d: '말 <b>세 개</b>씩 들고 겨뤄요. 상대 말이 <b>더 움직일 수 없게 막으면</b> 이겨요. 잡는 규칙은 없어요.', a: hbGoal },
      { t: '움직이기', d: '말을 누르면 갈 수 있는 곳에 <b>노란 점</b>이 떠요. 선을 따라 <b>이웃한 빈 점</b>으로 한 칸씩 가요. 번갈아 한 번씩 움직여요.', a: hbMove },
      { t: '돌아갈 수 없어요', d: '한 번 <b>집을 떠난 말</b>은 내 집이든 상대 집이든 <b>다시 들어갈 수 없어요</b>. 아직 집에 있는 말만 집에 머물러요.', a: hbNoBack },
      { t: '막아서 이겨요', d: '내 차례에 <b>움직일 수 있는 말이 하나도 없으면</b> 져요. 100수가 넘도록 승부가 안 나면 비겨요.', a: hbBlock }
    ],
    solitaire: [
      { t: '목표', d: '카드를 모두 <b>위쪽 네 칸</b>에 무늬별로 <b>A부터 K까지</b> 차례로 쌓으면 이겨요.', a: solGoal },
      { t: '아래에 쌓기', d: '아래 일곱 줄에는 <b>빨강과 검정을 번갈아</b> 큰 수에서 작은 수로 쌓아요. 뒤집힌 카드는 위 카드를 옮기면 열려요.', a: solStack },
      { t: '카드 옮기기', d: '카드를 <b>누르면</b> 갈 수 있는 곳으로 자동 이동해요. <b>끌어서</b> 놓아도 되고, 덱을 누르면 새 카드를 뽑아요.', a: solTap },
      { t: '빈 줄', d: '줄이 비면 <b>K</b>(또는 K로 시작하는 묶음)만 놓을 수 있어요.', a: solK },
      { t: '도구', d: '틀렸다면 <b>되돌리기</b>, 다 풀렸다면 <b>자동 완성</b>을 눌러요. 한 번에 1장·3장 뽑기는 설정에서 바꿔요.', a: solTools }
    ]
  };

  /* ----- 화면 ----- */
  let cur = null;
  const seen = id => { try { return localStorage.getItem(KEY(id)) === '1'; } catch (e) { return false; } };
  const mark = id => { try { localStorage.setItem(KEY(id), '1'); } catch (e) { /* 저장 불가 */ } };
  function render() {
    const el = $t('#tut'); if (!el || !cur) return;
    const steps = STEPS[cur.id], st = steps[cur.i], last = cur.i === steps.length - 1;
    el.querySelector('.tart').innerHTML = st.a();
    el.querySelector('.tstep').textContent = (cur.i + 1) + ' / ' + steps.length;
    el.querySelector('.ttitle').textContent = st.t;
    el.querySelector('.tdesc').innerHTML = st.d;
    el.querySelector('.tdots').innerHTML = steps.map((s, k) => '<i' + (k === cur.i ? ' class="on"' : '') + '></i>').join('');
    const prev = el.querySelector('.tprev'), next = el.querySelector('.tnext'), close = el.querySelector('.tclose');
    prev.hidden = cur.i === 0;
    next.textContent = last ? (cur.must ? '시작하기' : '닫기') : '다음';
    close.hidden = cur.must && !cur.done;
    el.querySelector('.tmust').hidden = !cur.must || cur.done;
    try { next.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
  }
  function open(id, must) {
    if (!STEPS[id]) return;
    cur = { id, i: 0, must: !!must, done: !must };
    const el = $t('#tut'); el.hidden = false; document.body.classList.add('tutopen');
    render();
  }
  function close() {
    const el = $t('#tut'); if (!el || !cur) return;
    if (cur.must && !cur.done) return;
    el.hidden = true; document.body.classList.remove('tutopen');
    const id = cur.id; cur = null;
    document.dispatchEvent(new CustomEvent('tutclose', { detail: id }));
  }
  function next() {
    if (!cur) return;
    const steps = STEPS[cur.id];
    if (cur.i < steps.length - 1) { cur.i++; if (cur.i === steps.length - 1) { cur.done = true; } render(); return; }
    mark(cur.id); cur.done = true; close();
  }
  function prev() { if (cur && cur.i > 0) { cur.i--; render(); } }
  document.addEventListener('click', e => {
    const b = e.target.closest('.tutbtn');
    if (b) { open(b.dataset.t, false); return; }
    if (!cur) return;
    if (e.target.closest('.tnext')) next();
    else if (e.target.closest('.tprev')) prev();
    else if (e.target.closest('.tclose') || e.target.classList.contains('tutbg')) close();
  });
  document.addEventListener('keydown', e => {
    if (!cur) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });
  window.Tut = {
    /* 게임 화면에 들어올 때: 처음이면 필수로 띄운다 */
    enter(id) { if (window.__noTut) return; if (STEPS[id] && !seen(id)) open(id, true); },
    open, seen
  };
})();
