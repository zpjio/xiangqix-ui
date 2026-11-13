import {
  BLACK_ROAD_NUMERALS,
  INITIAL_FEN,
  MATERIAL_QUOTA_WEIGHTS,
  PIECE_LABELS,
  RED_ROAD_NUMERALS,
} from '../constants/xiangqiConstants';
import {
  Camp,
  CompactLibraryMove,
  HandicapType,
  MoveQuality,
  MoveRecord,
  MultiPVArrow,
  MultiPVLine,
  Piece,
  PieceType,
  Position,
} from '../types/xiangqi';
import {
  playCheckChimeSound,
  playCheckmateGongSound,
  playInvalidWarningSound,
  playWoodClackSound,
} from './soundEffects';

export {
  BLACK_ROAD_NUMERALS,
  INITIAL_FEN,
  PIECE_LABELS,
  playCheckChimeSound,
  playCheckmateGongSound,
  playInvalidWarningSound,
  playWoodClackSound,
  RED_ROAD_NUMERALS,
};

export function createInitialPieces(handicap: HandicapType = 'even'): Piece[] {
  const full: Piece[] = [
    // Black camp (top, rows 0-4)
    { id: 'b-chariot-1', type: 'chariot', camp: 'black', row: 0, col: 0 },
    { id: 'b-horse-1', type: 'horse', camp: 'black', row: 0, col: 1 },
    { id: 'b-elephant-1', type: 'elephant', camp: 'black', row: 0, col: 2 },
    { id: 'b-advisor-1', type: 'advisor', camp: 'black', row: 0, col: 3 },
    { id: 'b-general', type: 'general', camp: 'black', row: 0, col: 4 },
    { id: 'b-advisor-2', type: 'advisor', camp: 'black', row: 0, col: 5 },
    { id: 'b-elephant-2', type: 'elephant', camp: 'black', row: 0, col: 6 },
    { id: 'b-horse-2', type: 'horse', camp: 'black', row: 0, col: 7 },
    { id: 'b-chariot-2', type: 'chariot', camp: 'black', row: 0, col: 8 },
    { id: 'b-cannon-1', type: 'cannon', camp: 'black', row: 2, col: 1 },
    { id: 'b-cannon-2', type: 'cannon', camp: 'black', row: 2, col: 7 },
    { id: 'b-soldier-1', type: 'soldier', camp: 'black', row: 3, col: 0 },
    { id: 'b-soldier-2', type: 'soldier', camp: 'black', row: 3, col: 2 },
    { id: 'b-soldier-3', type: 'soldier', camp: 'black', row: 3, col: 4 },
    { id: 'b-soldier-4', type: 'soldier', camp: 'black', row: 3, col: 6 },
    { id: 'b-soldier-5', type: 'soldier', camp: 'black', row: 3, col: 8 },
    // Red camp (bottom, rows 5-9)
    { id: 'r-soldier-1', type: 'soldier', camp: 'red', row: 6, col: 0 },
    { id: 'r-soldier-2', type: 'soldier', camp: 'red', row: 6, col: 2 },
    { id: 'r-soldier-3', type: 'soldier', camp: 'red', row: 6, col: 4 },
    { id: 'r-soldier-4', type: 'soldier', camp: 'red', row: 6, col: 6 },
    { id: 'r-soldier-5', type: 'soldier', camp: 'red', row: 6, col: 8 },
    { id: 'r-cannon-1', type: 'cannon', camp: 'red', row: 7, col: 1 },
    { id: 'r-cannon-2', type: 'cannon', camp: 'red', row: 7, col: 7 },
    { id: 'r-chariot-1', type: 'chariot', camp: 'red', row: 9, col: 0 },
    { id: 'r-horse-1', type: 'horse', camp: 'red', row: 9, col: 1 },
    { id: 'r-elephant-1', type: 'elephant', camp: 'red', row: 9, col: 2 },
    { id: 'r-advisor-1', type: 'advisor', camp: 'red', row: 9, col: 3 },
    { id: 'r-general', type: 'general', camp: 'red', row: 9, col: 4 },
    { id: 'r-advisor-2', type: 'advisor', camp: 'red', row: 9, col: 5 },
    { id: 'r-elephant-2', type: 'elephant', camp: 'red', row: 9, col: 6 },
    { id: 'r-horse-2', type: 'horse', camp: 'red', row: 9, col: 7 },
    { id: 'r-chariot-2', type: 'chariot', camp: 'red', row: 9, col: 8 },
  ];

  if (handicap === 'left-horse') {
    return full.filter((p) => p.id !== 'b-horse-1');
  }
  if (handicap === 'two-horses') {
    return full.filter((p) => p.id !== 'b-horse-1' && p.id !== 'b-horse-2');
  }
  return full;
}

export function createKingsOnlyPieces(): Piece[] {
  return [
    { id: 'b-general', type: 'general', camp: 'black', row: 0, col: 4 },
    { id: 'r-general', type: 'general', camp: 'red', row: 9, col: 4 },
  ];
}

export function buildBoardGrid(pieces: Piece[]): (Piece | null)[] {
  const grid: (Piece | null)[] = new Array(90).fill(null);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.row >= 0 && p.row <= 9 && p.col >= 0 && p.col <= 8) {
      grid[p.row * 9 + p.col] = p;
    }
  }
  return grid;
}

export function getPieceAtGrid(
  grid: (Piece | null)[],
  row: number,
  col: number
): Piece | null {
  if (row < 0 || row > 9 || col < 0 || col > 8) return null;
  return grid[row * 9 + col];
}

export function getPieceAt(pieces: Piece[], row: number, col: number): Piece | undefined {
  return pieces.find((p) => p.row === row && p.col === col);
}

// 计算红黑双方子力净分差（单次遍历 O(32) 统计）
export function calculateMaterialAndCaptures(pieces: Piece[]): {
  redCapturedBlack: PieceType[];
  blackCapturedRed: PieceType[];
  netAdvantageRed: number;
  advantageSummary: string;
} {
  const redCounts: Record<PieceType, number> = {
    general: 0,
    advisor: 0,
    elephant: 0,
    horse: 0,
    chariot: 0,
    cannon: 0,
    soldier: 0,
  };
  const blackCounts: Record<PieceType, number> = {
    general: 0,
    advisor: 0,
    elephant: 0,
    horse: 0,
    chariot: 0,
    cannon: 0,
    soldier: 0,
  };

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.camp === 'red') redCounts[p.type]++;
    else blackCounts[p.type]++;
  }

  const redCapturedBlack: PieceType[] = [];
  const blackCapturedRed: PieceType[] = [];
  let redTotal = 0;
  let blackTotal = 0;

  for (const item of MATERIAL_QUOTA_WEIGHTS) {
    const redAlive = redCounts[item.type];
    const blackAlive = blackCounts[item.type];

    redTotal += redAlive * item.weight;
    blackTotal += blackAlive * item.weight;

    const missingBlack = Math.max(0, item.count - blackAlive);
    for (let i = 0; i < missingBlack; i++) {
      redCapturedBlack.push(item.type);
    }

    const missingRed = Math.max(0, item.count - redAlive);
    for (let i = 0; i < missingRed; i++) {
      blackCapturedRed.push(item.type);
    }
  }

  const netAdvantageRed = Number((redTotal - blackTotal).toFixed(1));
  let advantageSummary = '子力均势';
  if (netAdvantageRed > 0.5) {
    advantageSummary = `红方子力 +${netAdvantageRed}`;
  } else if (netAdvantageRed < -0.5) {
    advantageSummary = `黑方子力 +${Math.abs(netAdvantageRed)}`;
  }

  return {
    redCapturedBlack,
    blackCapturedRed,
    netAdvantageRed,
    advantageSummary,
  };
}

function isInsidePalace(camp: Camp, row: number, col: number): boolean {
  if (col < 3 || col > 5) return false;
  if (camp === 'black') return row >= 0 && row <= 2;
  return row >= 7 && row <= 9;
}

export function getLegalMovesForPiece(
  piece: Piece,
  pieces: Piece[],
  prebuiltGrid?: (Piece | null)[]
): Position[] {
  const grid = prebuiltGrid || buildBoardGrid(pieces);
  const moves: Position[] = [];
  const { row, col, camp, type } = piece;

  const tryAdd = (r: number, c: number) => {
    if (r < 0 || r > 9 || c < 0 || c > 8) return;
    const target = grid[r * 9 + c];
    if (!target || target.camp !== camp) {
      moves.push({ row: r, col: c });
    }
  };

  switch (type) {
    case 'general': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInsidePalace(camp, nr, nc)) {
          tryAdd(nr, nc);
        }
      }
      // 飞将照面判定：沿同列向敌方宫城方向扫描首个棋子，无需遍历 pieces
      const flyDir = camp === 'red' ? -1 : 1;
      for (let nr = row + flyDir; nr >= 0 && nr <= 9; nr += flyDir) {
        const hit = grid[nr * 9 + col];
        if (hit) {
          if (hit.camp !== camp && hit.type === 'general') {
            moves.push({ row: nr, col });
          }
          break;
        }
      }
      break;
    }
    case 'advisor': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (isInsidePalace(camp, nr, nc)) {
          tryAdd(nr, nc);
        }
      }
      break;
    }
    case 'elephant': {
      const dirs = [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (camp === 'black' && nr > 4) continue;
        if (camp === 'red' && nr < 5) continue;
        const eyeR = row + dr / 2;
        const eyeC = col + dc / 2;
        if (!grid[eyeR * 9 + eyeC]) {
          tryAdd(nr, nc);
        }
      }
      break;
    }
    case 'horse': {
      const jumps = [
        { dr: -2, dc: -1, legR: -1, legC: 0 },
        { dr: -2, dc: 1, legR: -1, legC: 0 },
        { dr: 2, dc: -1, legR: 1, legC: 0 },
        { dr: 2, dc: 1, legR: 1, legC: 0 },
        { dr: -1, dc: -2, legR: 0, legC: -1 },
        { dr: 1, dc: -2, legR: 0, legC: -1 },
        { dr: -1, dc: 2, legR: 0, legC: 1 },
        { dr: 1, dc: 2, legR: 0, legC: 1 },
      ];
      for (const j of jumps) {
        const lr = row + j.legR;
        const lc = col + j.legC;
        if (lr >= 0 && lr <= 9 && lc >= 0 && lc <= 8 && !grid[lr * 9 + lc]) {
          tryAdd(row + j.dr, col + j.dc);
        }
      }
      break;
    }
    case 'chariot': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
          const target = grid[nr * 9 + nc];
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            if (target.camp !== camp) {
              moves.push({ row: nr, col: nc });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }
    case 'cannon': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
          const target = grid[nr * 9 + nc];
          if (!jumped) {
            if (!target) {
              moves.push({ row: nr, col: nc });
            } else {
              jumped = true;
            }
          } else {
            if (target) {
              if (target.camp !== camp) {
                moves.push({ row: nr, col: nc });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }
    case 'soldier': {
      const forward = camp === 'red' ? -1 : 1;
      tryAdd(row + forward, col);
      const crossedRiver = camp === 'red' ? row <= 4 : row >= 5;
      if (crossedRiver) {
        tryAdd(row, col - 1);
        tryAdd(row, col + 1);
      }
      break;
    }
  }

  return moves;
}

const ORTHO_DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const HORSE_CHECK_OFFSETS: readonly { hr: number; hc: number; legR: number; legC: number }[] = [
  { hr: -2, hc: -1, legR: -1, legC: -1 },
  { hr: -2, hc: 1, legR: -1, legC: 1 },
  { hr: 2, hc: -1, legR: 1, legC: -1 },
  { hr: 2, hc: 1, legR: 1, legC: 1 },
  { hr: -1, hc: -2, legR: -1, legC: -1 },
  { hr: 1, hc: -2, legR: 1, legC: -1 },
  { hr: -1, hc: 2, legR: -1, legC: 1 },
  { hr: 1, hc: 2, legR: 1, legC: 1 },
];

// 核心原位网格将军检测：给定 90 格网格与将/帅坐标 (gr, gc)，零内存分配完成常数级 O(1) 向心反查
function isGeneralInCheckOnGrid(
  grid: (Piece | null)[],
  camp: Camp,
  gr: number,
  gc: number
): boolean {
  const enemyCamp: Camp = camp === 'red' ? 'black' : 'red';

  // 1. 车、炮与将帅照面（四向正交射线）
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = ORTHO_DIRS[d];
    let nr = gr + dr;
    let nc = gc + dc;
    let screenFound = false;
    while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
      const p = grid[nr * 9 + nc];
      if (p) {
        if (!screenFound) {
          if (p.camp === enemyCamp && (p.type === 'chariot' || p.type === 'general')) {
            return true;
          }
          screenFound = true;
        } else {
          if (p.camp === enemyCamp && p.type === 'cannon') {
            return true;
          }
          break;
        }
      }
      nr += dr;
      nc += dc;
    }
  }

  // 2. 敌方马位反查（含蹩马腿检验）
  for (let i = 0; i < 8; i++) {
    const hc = HORSE_CHECK_OFFSETS[i];
    const r = gr + hc.hr;
    const c = gc + hc.hc;
    if (r < 0 || r > 9 || c < 0 || c > 8) continue;
    const p = grid[r * 9 + c];
    if (p && p.camp === enemyCamp && p.type === 'horse') {
      const lr = gr + hc.legR;
      const lc = gc + hc.legC;
      if (lr >= 0 && lr <= 9 && lc >= 0 && lc <= 8 && !grid[lr * 9 + lc]) {
        return true;
      }
    }
  }

  // 3. 敌方兵/卒反查（前方与左右临位）
  const soldierFromRow = camp === 'red' ? gr - 1 : gr + 1;
  if (soldierFromRow >= 0 && soldierFromRow <= 9) {
    const frontP = grid[soldierFromRow * 9 + gc];
    if (frontP && frontP.camp === enemyCamp && frontP.type === 'soldier') return true;
  }
  if (gc - 1 >= 0) {
    const leftP = grid[gr * 9 + (gc - 1)];
    if (leftP && leftP.camp === enemyCamp && leftP.type === 'soldier') return true;
  }
  if (gc + 1 <= 8) {
    const rightP = grid[gr * 9 + (gc + 1)];
    if (rightP && rightP.camp === enemyCamp && rightP.type === 'soldier') return true;
  }

  return false;
}

// 向心射线将军检测：从将/帅位置向四向、马位与兵卒位反查，复杂度降为常数级 O(1)
export function isCampInCheck(
  pieces: Piece[],
  camp: Camp,
  prebuiltGrid?: (Piece | null)[]
): Position | null {
  const general = pieces.find((p) => p.type === 'general' && p.camp === camp);
  if (!general) return null;
  const grid = prebuiltGrid || buildBoardGrid(pieces);
  return isGeneralInCheckOnGrid(grid, camp, general.row, general.col)
    ? { row: general.row, col: general.col }
    : null;
}

// 过滤送将、将帅照面及未应将着法：采用原位 90 格网格试走与回溯，消除候选走法枚举中的数组克隆与重复建网
export function getSafeLegalMovesForPiece(
  piece: Piece,
  pieces: Piece[],
  prebuiltGrid?: (Piece | null)[]
): Position[] {
  const grid = prebuiltGrid || buildBoardGrid(pieces);
  const candidates = getLegalMovesForPiece(piece, pieces, grid);
  if (candidates.length === 0) return [];

  const myGeneral =
    piece.type === 'general'
      ? piece
      : pieces.find((p) => p.type === 'general' && p.camp === piece.camp);
  if (!myGeneral) return candidates;

  const safeMoves: Position[] = [];
  const fromIdx = piece.row * 9 + piece.col;
  const isMovingGeneral = piece.type === 'general';

  for (let i = 0; i < candidates.length; i++) {
    const to = candidates[i];
    const toIdx = to.row * 9 + to.col;
    const displaced = grid[toIdx];

    // 原位试走
    grid[fromIdx] = null;
    grid[toIdx] = piece;

    const gr = isMovingGeneral ? to.row : myGeneral.row;
    const gc = isMovingGeneral ? to.col : myGeneral.col;
    const stillInCheck = isGeneralInCheckOnGrid(grid, piece.camp, gr, gc);

    // 立即原位回溯恢复
    grid[fromIdx] = piece;
    grid[toIdx] = displaced;

    if (!stillInCheck) {
      safeMoves.push(to);
    }
  }
  return safeMoves;
}

// 精准提取所有正在照将（将军）的敌方棋子坐标，支持双将多线攻击雷达
export function getCheckingAttackers(
  pieces: Piece[],
  targetCamp: Camp,
  prebuiltGrid?: (Piece | null)[]
): { from: Position; to: Position }[] {
  const general = pieces.find((p) => p.type === 'general' && p.camp === targetCamp);
  if (!general) return [];
  const grid = prebuiltGrid || buildBoardGrid(pieces);
  const enemyCamp: Camp = targetCamp === 'red' ? 'black' : 'red';
  const attackers: { from: Position; to: Position }[] = [];
  const gr = general.row;
  const gc = general.col;

  // 1. 车、炮与将帅照面
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = ORTHO_DIRS[d];
    let nr = gr + dr;
    let nc = gc + dc;
    let screenFound = false;
    while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
      const p = grid[nr * 9 + nc];
      if (p) {
        if (!screenFound) {
          if (p.camp === enemyCamp && (p.type === 'chariot' || p.type === 'general')) {
            attackers.push({ from: { row: p.row, col: p.col }, to: { row: gr, col: gc } });
          }
          screenFound = true;
        } else {
          if (p.camp === enemyCamp && p.type === 'cannon') {
            attackers.push({ from: { row: p.row, col: p.col }, to: { row: gr, col: gc } });
          }
          break;
        }
      }
      nr += dr;
      nc += dc;
    }
  }

  // 2. 敌方马照将
  for (let i = 0; i < 8; i++) {
    const hc = HORSE_CHECK_OFFSETS[i];
    const r = gr + hc.hr;
    const c = gc + hc.hc;
    if (r < 0 || r > 9 || c < 0 || c > 8) continue;
    const p = grid[r * 9 + c];
    if (p && p.camp === enemyCamp && p.type === 'horse') {
      const lr = gr + hc.legR;
      const lc = gc + hc.legC;
      if (lr >= 0 && lr <= 9 && lc >= 0 && lc <= 8 && !grid[lr * 9 + lc]) {
        attackers.push({ from: { row: p.row, col: p.col }, to: { row: gr, col: gc } });
      }
    }
  }

  // 3. 敌方兵/卒照将
  const soldierFromRow = targetCamp === 'red' ? gr - 1 : gr + 1;
  const soldierSpots: [number, number][] = [
    [soldierFromRow, gc],
    [gr, gc - 1],
    [gr, gc + 1],
  ];
  for (const [sr, sc] of soldierSpots) {
    if (sr < 0 || sr > 9 || sc < 0 || sc > 8) continue;
    const p = grid[sr * 9 + sc];
    if (p && p.camp === enemyCamp && p.type === 'soldier') {
      attackers.push({ from: { row: p.row, col: p.col }, to: { row: gr, col: gc } });
    }
  }

  return attackers;
}

// 校验指定行棋方是否仍存在至少一步不致己方被将的合法着法（找到第一步安全着法即刻短路返回）
export function hasAnyLegalMoves(
  pieces: Piece[],
  camp: Camp,
  prebuiltGrid?: (Piece | null)[]
): boolean {
  const grid = prebuiltGrid || buildBoardGrid(pieces);
  const myGeneral = pieces.find((p) => p.type === 'general' && p.camp === camp);
  if (!myGeneral) return false;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.camp !== camp) continue;
    const candidates = getLegalMovesForPiece(p, pieces, grid);
    if (candidates.length === 0) continue;

    const fromIdx = p.row * 9 + p.col;
    const isMovingGeneral = p.type === 'general';
    for (let j = 0; j < candidates.length; j++) {
      const to = candidates[j];
      const toIdx = to.row * 9 + to.col;
      const displaced = grid[toIdx];

      grid[fromIdx] = null;
      grid[toIdx] = p;
      const gr = isMovingGeneral ? to.row : myGeneral.row;
      const gc = isMovingGeneral ? to.col : myGeneral.col;
      const stillInCheck = isGeneralInCheckOnGrid(grid, camp, gr, gc);
      grid[fromIdx] = p;
      grid[toIdx] = displaced;

      if (!stillInCheck) {
        return true;
      }
    }
  }
  return false;
}

// 标准现代简体象棋记谱法（如：炮二平五、马8进7、车一平二）
export function formatChineseMoveNotation(piece: Piece, from: Position, to: Position): string {
  const isRed = piece.camp === 'red';
  const char = PIECE_LABELS[piece.camp][piece.type].simplified;
  const fromRoad = isRed ? RED_ROAD_NUMERALS[from.col] : String(from.col + 1);
  const toRoad = isRed ? RED_ROAD_NUMERALS[to.col] : String(to.col + 1);

  if (from.row === to.row) {
    return `${char}${fromRoad}平${toRoad}`;
  }

  const isForward = isRed ? to.row < from.row : to.row > from.row;
  const action = isForward ? '进' : '退';

  if (piece.type === 'horse' || piece.type === 'elephant' || piece.type === 'advisor') {
    return `${char}${fromRoad}${action}${toRoad}`;
  }

  const stepDiff = Math.abs(to.row - from.row);
  const stepStr = isRed
    ? ['一', '二', '三', '四', '五', '六', '七', '八', '九'][stepDiff - 1] || String(stepDiff)
    : String(stepDiff);
  return `${char}${fromRoad}${action}${stepStr}`;
}

export function evaluateBoardScore(pieces: Piece[]): number {
  const weights: Record<PieceType, number> = {
    general: 100,
    chariot: 9.2,
    cannon: 4.6,
    horse: 4.2,
    elephant: 2.0,
    advisor: 2.0,
    soldier: 1.2,
  };
  let score = 0.25;
  for (const p of pieces) {
    let val = weights[p.type];
    if (p.type === 'soldier') {
      const crossed = p.camp === 'red' ? p.row <= 4 : p.row >= 5;
      if (crossed) val += 1.1;
    }
    score += p.camp === 'red' ? val : -val;
  }
  return Number(score.toFixed(2));
}

export function piecesToFen(pieces: Piece[], turn: Camp = 'red'): string {
  const charMap: Record<Camp, Record<PieceType, string>> = {
    red: {
      general: 'K',
      advisor: 'A',
      elephant: 'B',
      horse: 'N',
      chariot: 'R',
      cannon: 'C',
      soldier: 'P',
    },
    black: {
      general: 'k',
      advisor: 'a',
      elephant: 'b',
      horse: 'n',
      chariot: 'r',
      cannon: 'c',
      soldier: 'p',
    },
  };

  const grid = buildBoardGrid(pieces);
  const rows: string[] = [];
  for (let r = 0; r < 10; r++) {
    let empty = 0;
    let rowStr = '';
    for (let c = 0; c < 9; c++) {
      const p = grid[r * 9 + c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += String(empty);
          empty = 0;
        }
        rowStr += charMap[p.camp][p.type];
      }
    }
    if (empty > 0) rowStr += String(empty);
    rows.push(rowStr);
  }
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'} - - 0 1`;
}

export function getPositionKeyFromPieces(pieces: Piece[], turn: Camp = 'red'): string {
  const fullFen = piecesToFen(pieces, turn);
  const parts = fullFen.split(' ');
  return `${parts[0]} ${parts[1] || 'w'}`;
}

export function replayCompactMoves(
  basePieces: Piece[],
  compactMoves: CompactLibraryMove[],
  baseTurn: Camp = 'red'
): { moves: MoveRecord[]; finalPieces: Piece[]; finalTurn: Camp } {
  let current = basePieces.map((p) => ({ ...p }));
  let currentTurn: Camp = baseTurn;
  const records: MoveRecord[] = [];

  for (let i = 0; i < compactMoves.length; i++) {
    const step = compactMoves[i];
    const moving = getPieceAt(current, step.from.row, step.from.col);
    if (!moving) break;
    const captured = getPieceAt(current, step.to.row, step.to.col);
    const notation = formatChineseMoveNotation(moving, step.from, step.to);

    current = current
      .filter((p) => !(p.row === step.to.row && p.col === step.to.col))
      .map((p) =>
        p.id === moving.id ? { ...p, row: step.to.row, col: step.to.col } : p
      );

    const evalScore =
      typeof step.evalScore === 'number' ? step.evalScore : evaluateBoardScore(current);
    const quality: MoveQuality = step.quality || (evalScore > 1.2 ? '优' : '良');

    records.push({
      ply: i + 1,
      piece: { ...moving },
      from: { ...step.from },
      to: { ...step.to },
      captured: captured ? { ...captured } : undefined,
      notation,
      evalScore,
      quality,
      piecesSnapshot: current.map((p) => ({ ...p })),
    });
    currentTurn = moving.camp === 'red' ? 'black' : 'red';
  }

  return { moves: records, finalPieces: current, finalTurn: currentTurn };
}

export function parseFenToPieces(fen: string): { pieces: Piece[]; turn: Camp } | null {
  try {
    const trimmed = fen.trim();
    const parts = trimmed.split(/\s+/);
    const boardPart = parts[0];
    const turnPart = parts[1] || 'w';
    const rowStrings = boardPart.split('/');
    if (rowStrings.length !== 10) return null;

    const typeMap: Record<string, { camp: Camp; type: PieceType }> = {
      K: { camp: 'red', type: 'general' },
      A: { camp: 'red', type: 'advisor' },
      B: { camp: 'red', type: 'elephant' },
      E: { camp: 'red', type: 'elephant' },
      N: { camp: 'red', type: 'horse' },
      H: { camp: 'red', type: 'horse' },
      R: { camp: 'red', type: 'chariot' },
      C: { camp: 'red', type: 'cannon' },
      P: { camp: 'red', type: 'soldier' },
      k: { camp: 'black', type: 'general' },
      a: { camp: 'black', type: 'advisor' },
      b: { camp: 'black', type: 'elephant' },
      e: { camp: 'black', type: 'elephant' },
      n: { camp: 'black', type: 'horse' },
      h: { camp: 'black', type: 'horse' },
      r: { camp: 'black', type: 'chariot' },
      c: { camp: 'black', type: 'cannon' },
      p: { camp: 'black', type: 'soldier' },
    };

    const pieces: Piece[] = [];
    let idCounter = 1;
    for (let r = 0; r < 10; r++) {
      let c = 0;
      for (const ch of rowStrings[r]) {
        if (/[1-9]/.test(ch)) {
          c += parseInt(ch, 10);
        } else if (typeMap[ch]) {
          const info = typeMap[ch];
          pieces.push({
            id: `${info.camp[0]}-${info.type}-${idCounter++}`,
            camp: info.camp,
            type: info.type,
            row: r,
            col: c,
          });
          c++;
        } else {
          return null;
        }
      }
      if (c !== 9) return null;
    }

    return {
      pieces,
      turn: turnPart.toLowerCase() === 'b' ? 'black' : 'red',
    };
  } catch {
    return null;
  }
}

export function formatGameToPgn(
  meta: {
    redPlayer: string;
    blackPlayer: string;
    event: string;
    date: string;
    result: string;
    opening: string;
  },
  moves: MoveRecord[],
  baseFen: string,
  includeAnnotations = false
): string {
  const headers = [
    `[Game "Chinese Chess"]`,
    `[Event "${meta.event}"]`,
    `[Date "${meta.date}"]`,
    `[Red "${meta.redPlayer}"]`,
    `[Black "${meta.blackPlayer}"]`,
    `[Result "${meta.result}"]`,
    `[Opening "${meta.opening}"]`,
    `[FEN "${baseFen}"]`,
  ];

  const formatSingleMove = (m?: MoveRecord) => {
    if (!m) return '';
    if (!includeAnnotations) return m.notation;
    const scoreStr = `${m.evalScore >= 0 ? '+' : ''}${m.evalScore.toFixed(2)}`;
    const tagParts = [m.quality ? `评:${m.quality}` : '', scoreStr].filter(Boolean).join(' ');
    const noteBody = m.comment ? `${tagParts} | ${m.comment}` : tagParts;
    return `${m.notation} {${noteBody}}`;
  };

  const moveLines: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const roundNo = Math.floor(i / 2) + 1;
    const rMove = formatSingleMove(moves[i]);
    const bMove = formatSingleMove(moves[i + 1]);
    moveLines.push(`${roundNo}. ${rMove}${bMove ? ` ${bMove}` : ''}`);
  }

  return moveLines.length > 0
    ? `${headers.join('\n')}\n\n${moveLines.join(' ')}`
    : headers.join('\n');
}

export function formatGameToWechatText(
  meta: {
    redPlayer: string;
    blackPlayer: string;
    event: string;
    date: string;
    result: string;
    opening: string;
  },
  moves: MoveRecord[],
  baseFen: string,
  includeAnnotations = false
): string {
  const titleLine = `【${meta.redPlayer} vs ${meta.blackPlayer}】`;
  const subParts = [meta.opening, meta.event, meta.result, meta.date].filter(Boolean);
  const subLine = subParts.join(' · ');

  const lines: string[] = [titleLine];
  if (subLine) lines.push(subLine);

  if (moves.length === 0) {
    lines.push(`当前局面 FEN：${baseFen}`);
    return lines.join('\n');
  }

  lines.push('');
  for (let i = 0; i < moves.length; i += 2) {
    const roundNo = Math.floor(i / 2) + 1;
    const r = moves[i];
    const b = moves[i + 1];
    const rText = r ? r.notation : '';
    const bText = b ? b.notation : '';
    let row = `${roundNo}. ${rText}${bText ? `  ${bText}` : ''}`;
    if (includeAnnotations) {
      const notes: string[] = [];
      if (r && (r.quality || r.comment)) {
        const sc = `${r.evalScore >= 0 ? '+' : ''}${r.evalScore.toFixed(1)}`;
        notes.push(`红(${r.quality || '良'} ${sc}${r.comment ? `: ${r.comment}` : ''})`);
      }
      if (b && (b.quality || b.comment)) {
        const sc = `${b.evalScore >= 0 ? '+' : ''}${b.evalScore.toFixed(1)}`;
        notes.push(`黑(${b.quality || '良'} ${sc}${b.comment ? `: ${b.comment}` : ''})`);
      }
      if (notes.length > 0) {
        row += `  [${notes.join('；')}]`;
      }
    }
    lines.push(row);
  }
  return lines.join('\n');
}

export function sanitizeExportFilename(rawName: string): string {
  return rawName.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'xiangqi_game';
}

export function downloadTextFile(filename: string, content: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Ignore download restrictions
  }
}

export interface ParsedPgnSession {
  basePieces: Piece[];
  baseTurn: Camp;
  moves: MoveRecord[];
  finalPieces: Piece[];
  finalTurn: Camp;
  metadata: Partial<{
    redPlayer: string;
    blackPlayer: string;
    event: string;
    date: string;
    result: '红胜' | '黑胜' | '和棋' | '进行中';
    opening: string;
  }>;
  hasExplicitFen: boolean;
}

const TRAD_TO_SIMP_CHAR_MAP: Record<string, string> = {
  帥: '帅',
  將: '将',
  傌: '马',
  馬: '马',
  俥: '车',
  車: '车',
  砲: '炮',
  包: '炮',
  進: '进',
  平: '平',
  退: '退',
  前: '前',
  中: '中',
  後: '后',
  后: '后',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
};

function normalizePgnMoveToken(token: string): string {
  let out = '';
  for (const ch of token.trim()) {
    out += TRAD_TO_SIMP_CHAR_MAP[ch] || ch;
  }
  return out;
}

function matchPieceCandidatesForChineseToken(
  token: string,
  camp: Camp,
  pieces: Piece[],
  grid: (Piece | null)[]
): { piece: Piece; to: Position } | null {
  const norm = normalizePgnMoveToken(token);
  if (norm.length < 4) return null;

  const isRed = camp === 'red';
  const pieceTypeMap: Record<string, PieceType> = {
    帅: 'general',
    将: 'general',
    仕: 'advisor',
    士: 'advisor',
    相: 'elephant',
    象: 'elephant',
    马: 'horse',
    车: 'chariot',
    炮: 'cannon',
    兵: 'soldier',
    卒: 'soldier',
  };

  // Handle "前车进一" / "后马进三" or standard "炮二平五"
  let disambigPos: 'front' | 'back' | 'middle' | null = null;
  let typeChar = norm[0];
  let roadChar = norm[1];
  const actionChar = norm[2];
  const targetChar = norm[3];

  if (norm[0] === '前' || norm[0] === '后' || norm[0] === '中') {
    disambigPos = norm[0] === '前' ? 'front' : norm[0] === '后' ? 'back' : 'middle';
    typeChar = norm[1];
    roadChar = '';
  }

  const targetPieceType = pieceTypeMap[typeChar];
  if (!targetPieceType) return null;

  const roadIndex = roadChar
    ? isRed
      ? RED_ROAD_NUMERALS.indexOf(roadChar)
      : BLACK_ROAD_NUMERALS.indexOf(roadChar)
    : -1;
  if (!disambigPos && roadIndex < 0) return null;

  const sameCampType = pieces.filter((p) => p.camp === camp && p.type === targetPieceType);
  let candidatePieces = sameCampType;

  if (disambigPos) {
    // Group by column with >= 2 pieces
    const colCounts = new Map<number, Piece[]>();
    for (const p of sameCampType) {
      const arr = colCounts.get(p.col) || [];
      arr.push(p);
      colCounts.set(p.col, arr);
    }
    const multiColPieces: Piece[] = [];
    for (const arr of colCounts.values()) {
      if (arr.length >= 2) {
        arr.sort((a, b) => (isRed ? a.row - b.row : b.row - a.row));
        if (disambigPos === 'front') multiColPieces.push(arr[0]);
        else if (disambigPos === 'back') multiColPieces.push(arr[arr.length - 1]);
        else if (arr.length >= 3) multiColPieces.push(arr[1]);
      }
    }
    candidatePieces = multiColPieces;
  } else {
    candidatePieces = sameCampType.filter((p) => p.col === roadIndex);
  }

  for (const p of candidatePieces) {
    const legalTos = getLegalMovesForPiece(p, pieces, grid);
    for (const to of legalTos) {
      const stdNotation = formatChineseMoveNotation(p, { row: p.row, col: p.col }, to);
      if (disambigPos) {
        if (stdNotation.slice(2) === `${actionChar}${targetChar}`) {
          return { piece: p, to };
        }
      } else if (stdNotation === norm) {
        return { piece: p, to };
      }
    }
  }
  return null;
}

export function parsePgnTextToSession(
  pgnText: string,
  fallbackFen?: string
): ParsedPgnSession | null {
  const trimmed = pgnText.trim();
  if (!trimmed) return null;

  const headerMap: Record<string, string> = {};
  const headerRegex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(trimmed)) !== null) {
    headerMap[match[1].toLowerCase()] = match[2].trim();
  }

  const rawFen = headerMap.fen || fallbackFen || INITIAL_FEN;
  const parsedBase = parseFenToPieces(rawFen);
  if (!parsedBase) return null;

  // Strip header tags, comments {...}, parentheses (...), round markers, and result tokens
  const body = trimmed
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*\./g, ' ')
    .replace(/(?:1-0|0-1|1\/2-1\/2|\*|红胜|黑胜|和棋)/g, ' ');

  const rawTokens = body
    .split(/[\s,，;；]+/)
    .map((t) => normalizePgnMoveToken(t))
    .filter((t) => /^[前中后帅将仕士相象马车炮兵卒][^\s]{2,3}$/.test(t));

  let current = parsedBase.pieces.map((p) => ({ ...p }));
  let currentTurn: Camp = parsedBase.turn;
  const moves: MoveRecord[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const grid = buildBoardGrid(current);
    const matched = matchPieceCandidatesForChineseToken(token, currentTurn, current, grid);
    if (!matched) break;

    const { piece: moving, to } = matched;
    const from = { row: moving.row, col: moving.col };
    const captured = getPieceAt(current, to.row, to.col);
    const notation = formatChineseMoveNotation(moving, from, to);

    current = current
      .filter((p) => !(p.row === to.row && p.col === to.col))
      .map((p) => (p.id === moving.id ? { ...p, row: to.row, col: to.col } : p));

    const evalScore = evaluateBoardScore(current);
    moves.push({
      ply: i + 1,
      piece: { ...moving },
      from,
      to,
      captured: captured ? { ...captured } : undefined,
      notation,
      evalScore,
      quality: '良',
      piecesSnapshot: current.map((p) => ({ ...p })),
    });
    currentTurn = currentTurn === 'red' ? 'black' : 'red';
  }

  const rawResult = headerMap.result || '';
  const mappedResult: '红胜' | '黑胜' | '和棋' | '进行中' | undefined =
    rawResult === '1-0' || rawResult === '红胜'
      ? '红胜'
      : rawResult === '0-1' || rawResult === '黑胜'
      ? '黑胜'
      : rawResult === '1/2-1/2' || rawResult === '和棋'
      ? '和棋'
      : rawResult === '进行中'
      ? '进行中'
      : undefined;

  return {
    basePieces: parsedBase.pieces,
    baseTurn: parsedBase.turn,
    moves,
    finalPieces: current,
    finalTurn: currentTurn,
    metadata: {
      ...(headerMap.red ? { redPlayer: headerMap.red } : {}),
      ...(headerMap.black ? { blackPlayer: headerMap.black } : {}),
      ...(headerMap.event ? { event: headerMap.event } : {}),
      ...(headerMap.date ? { date: headerMap.date } : {}),
      ...(headerMap.opening ? { opening: headerMap.opening } : {}),
      ...(mappedResult ? { result: mappedResult } : {}),
    },
    hasExplicitFen: Boolean(headerMap.fen),
  };
}

export function generateSimulatedMultiPV(
  pieces: Piece[],
  turn: Camp,
  depth = 24,
  maxLines = 3,
  styleBias: 'balanced' | 'aggressive' | 'positional' = 'balanced',
  threads = 8,
  hashMb = 512
): { lines: MultiPVLine[]; arrows: MultiPVArrow[] } {
  const grid = buildBoardGrid(pieces);
  const baseEval = evaluateBoardScore(pieces);
  const candidates: { piece: Piece; from: Position; to: Position; notation: string; delta: number }[] =
    [];

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.camp !== turn) continue;
    const legal = getSafeLegalMovesForPiece(p, pieces, grid);
    for (const to of legal) {
      const target = grid[to.row * 9 + to.col];
      let priority = 0;
      if (target) {
        const capVal =
          target.type === 'chariot'
            ? 8
            : target.type === 'cannon' || target.type === 'horse'
            ? 5
            : 2.5;
        priority += capVal;
        if (styleBias === 'aggressive') priority += 1.4;
      }
      if (p.type === 'cannon' && to.col === 4) {
        priority += styleBias === 'aggressive' ? 2.8 : 2.2;
      }
      if (p.type === 'horse' && (to.col === 2 || to.col === 6)) {
        priority += styleBias === 'positional' ? 2.7 : 1.9;
      }
      if (p.type === 'chariot' && (to.col === 1 || to.col === 7 || to.row === 4 || to.row === 5)) {
        priority += styleBias === 'aggressive' ? 2.4 : 1.7;
      }
      if (p.type === 'soldier' && (to.col === 2 || to.col === 6)) {
        priority += styleBias === 'positional' ? 2.1 : 1.1;
      }
      if (styleBias === 'positional' && (p.type === 'advisor' || p.type === 'elephant')) {
        priority += 1.45;
      }

      candidates.push({
        piece: p,
        from: { row: p.row, col: p.col },
        to,
        notation: formatChineseMoveNotation(p, { row: p.row, col: p.col }, to),
        delta: priority,
      });
    }
  }

  candidates.sort((a, b) => b.delta - a.delta);
  const topCandidates = candidates.slice(0, Math.max(1, Math.min(3, maxLines)));

  const followUps = [
    ['马8进7', '马二进三', '车9平8', '车一平二'],
    ['卒7进1', '车一平二', '马2进3', '兵七进一'],
    ['炮8平5', '马八进七', '车1平2', '炮八平六'],
  ];

  const styleEvalShift =
    styleBias === 'aggressive' ? 0.14 : styleBias === 'positional' ? -0.09 : 0;
  const threadMultiplier = threads === 16 ? 1.75 : threads === 4 ? 0.62 : 1.0;
  const rawBaseNps =
    styleBias === 'aggressive' ? 5680 : styleBias === 'positional' ? 4460 : 5120;
  const baseNps = Math.round(rawBaseNps * threadMultiplier);
  const simulatedHashfull = Math.min(
    960,
    Math.round((depth / 24) * (512 / hashMb) * (styleBias === 'aggressive' ? 412 : 368))
  );

  const lines: MultiPVLine[] = topCandidates.map((cand, idx) => {
    const scoreOffset = idx === 0 ? 0.35 : idx === 1 ? 0.1 : -0.18;
    const rawScore =
      turn === 'red'
        ? baseEval + scoreOffset + styleEvalShift
        : baseEval - scoreOffset - styleEvalShift;
    const scoreCp = Number(rawScore.toFixed(2));
    const summaryText =
      scoreCp > 1.2
        ? '红方子力活跃 · 中路攻势明显'
        : scoreCp < -1.2
        ? '黑方反先占优 · 侧翼车炮反击有力'
        : '双方均势相持 · 争夺中盘先手';

    return {
      multipv: idx + 1,
      depth: depth - idx,
      scoreCp,
      nps: baseNps - idx * 240,
      hashfull: simulatedHashfull,
      pvMoves: [cand.notation, ...followUps[idx % followUps.length]],
      firstMove: {
        from: cand.from,
        to: cand.to,
        notation: cand.notation,
      },
      summaryText,
    };
  });

  const arrows: MultiPVArrow[] = lines.map((line) => ({
    rank: line.multipv,
    from: line.firstMove.from,
    to: line.firstMove.to,
    scoreText: `${line.scoreCp >= 0 ? '+' : ''}${line.scoreCp.toFixed(2)}`,
    notation: line.firstMove.notation,
  }));

  return { lines, arrows };
}

export function generateOpponentThreatArrow(
  pieces: Piece[],
  currentTurn: Camp
): MultiPVArrow | null {
  const opponentCamp: Camp = currentTurn === 'red' ? 'black' : 'red';
  const sim = generateSimulatedMultiPV(pieces, opponentCamp, 18);
  const topThreat = sim.lines[0];
  if (!topThreat) return null;
  return {
    rank: 99,
    from: topThreat.firstMove.from,
    to: topThreat.firstMove.to,
    scoreText: `威胁 ${topThreat.firstMove.notation}`,
    notation: topThreat.firstMove.notation,
    isThreat: true,
  };
}

export function createSampleSessionMoves(): {
  initialPieces: Piece[];
  moves: MoveRecord[];
} {
  const initialPieces = createInitialPieces();
  const script: {
    from: [number, number];
    to: [number, number];
    evalScore: number;
    quality: MoveQuality;
    bestAlternative?: string;
    bestFrom?: [number, number];
    bestTo?: [number, number];
    comment?: string;
  }[] = [
    { from: [7, 7], to: [7, 4], evalScore: 0.32, quality: '优', comment: '中炮开局，控制中路' },
    { from: [0, 7], to: [2, 6], evalScore: 0.28, quality: '优', comment: '屏风马稳健护中卒' },
    { from: [9, 7], to: [7, 6], evalScore: 0.36, quality: '优' },
    { from: [0, 8], to: [0, 7], evalScore: 0.31, quality: '良' },
    { from: [9, 8], to: [9, 7], evalScore: 0.42, quality: '优', comment: '直车抢占肋道要道' },
    { from: [0, 1], to: [2, 2], evalScore: 0.38, quality: '优' },
    { from: [6, 6], to: [5, 6], evalScore: 0.48, quality: '优', comment: '挺七兵活通马路' },
    { from: [3, 6], to: [4, 6], evalScore: 0.44, quality: '良' },
    { from: [9, 1], to: [7, 2], evalScore: 0.55, quality: '优' },
    {
      from: [2, 7],
      to: [2, 5],
      evalScore: 1.48,
      quality: '缓',
      bestAlternative: '象3进5',
      bestFrom: [0, 2],
      bestTo: [2, 4],
      comment: '士角炮步调偏缓，后防空虚，宜先飞象固防',
    },
    {
      from: [9, 7],
      to: [3, 7],
      evalScore: 1.72,
      quality: '妙',
      comment: '过河车深插卒林，压制黑方右翼子力',
    },
    {
      from: [2, 5],
      to: [6, 5],
      evalScore: 2.95,
      quality: '败',
      bestAlternative: '车1平2',
      bestFrom: [0, 0],
      bestTo: [0, 1],
      comment: '孤炮贪进险地，导致左翼车马受困，红方大优',
    },
  ];

  let current = initialPieces.map((p) => ({ ...p }));
  const records: MoveRecord[] = [];

  script.forEach((step, idx) => {
    const moving = getPieceAt(current, step.from[0], step.from[1]);
    if (!moving) return;
    const captured = getPieceAt(current, step.to[0], step.to[1]);
    const notation = formatChineseMoveNotation(
      moving,
      { row: step.from[0], col: step.from[1] },
      { row: step.to[0], col: step.to[1] }
    );

    current = current
      .filter((p) => !(p.row === step.to[0] && p.col === step.to[1]))
      .map((p) =>
        p.id === moving.id ? { ...p, row: step.to[0], col: step.to[1] } : p
      );

    records.push({
      ply: idx + 1,
      piece: { ...moving },
      from: { row: step.from[0], col: step.from[1] },
      to: { row: step.to[0], col: step.to[1] },
      captured: captured ? { ...captured } : undefined,
      notation,
      evalScore: step.evalScore,
      quality: step.quality,
      bestAlternative: step.bestAlternative,
      bestFrom: step.bestFrom ? { row: step.bestFrom[0], col: step.bestFrom[1] } : undefined,
      bestTo: step.bestTo ? { row: step.bestTo[0], col: step.bestTo[1] } : undefined,
      comment: step.comment,
      piecesSnapshot: current.map((p) => ({ ...p })),
    });
  });

  return { initialPieces, moves: records };
}
