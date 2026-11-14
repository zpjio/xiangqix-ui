import { lookupOpeningBookNode } from '../data/openingBook';
import {
  Camp,
  EngineSkillTier,
  MoveRecord,
  Piece,
  PieceType,
  Position,
} from '../types/xiangqi';
import {
  buildBoardGrid,
  evaluateBoardScore,
  formatChineseMoveNotation,
  generateSimulatedMultiPV,
  getLegalMovesForPiece,
  getPositionKeyFromPieces,
  getSafeLegalMovesForPiece,
  hasAnyLegalMoves,
  isCampInCheck,
} from './xiangqiRules';

export interface BotMoveCandidate {
  from: Position;
  to: Position;
  notation: string;
  source: 'book' | 'search';
}

const PIECE_TACTICAL_VALUES: Record<PieceType, number> = {
  general: 100,
  chariot: 9.2,
  cannon: 4.6,
  horse: 4.2,
  elephant: 2.0,
  advisor: 2.0,
  soldier: 1.2,
};

function pickWeightedIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let threshold = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    threshold -= Math.max(0, weights[i]);
    if (threshold <= 0) return i;
  }
  return 0;
}

function getPieceValue(p: Piece): number {
  let val = PIECE_TACTICAL_VALUES[p.type];
  if (p.type === 'soldier') {
    const crossed = p.camp === 'red' ? p.row <= 4 : p.row >= 5;
    if (crossed) val += 1.0;
  }
  return val;
}

/**
 * 估算对手在当前局面下最强即时反击净收益（用于过滤白送车/马/炮等明显悬空漏着）
 */
function estimateOpponentBestCounterGain(piecesAfterMove: Piece[], aiCamp: Camp): number {
  const oppCamp: Camp = aiCamp === 'red' ? 'black' : 'red';
  const oppGrid = buildBoardGrid(piecesAfterMove);

  if (!hasAnyLegalMoves(piecesAfterMove, oppCamp, oppGrid)) {
    // 对手无子可走（绝杀或困毙）
    return -999;
  }

  let bestGain = 0;
  for (let i = 0; i < piecesAfterMove.length; i++) {
    const oppPiece = piecesAfterMove[i];
    if (oppPiece.camp !== oppCamp) continue;
    const oppMoves = getSafeLegalMovesForPiece(oppPiece, piecesAfterMove, oppGrid);
    const attackerVal = getPieceValue(oppPiece);

    for (let j = 0; j < oppMoves.length; j++) {
      const targetPos = oppMoves[j];
      const victim = oppGrid[targetPos.row * 9 + targetPos.col];
      if (!victim || victim.camp !== aiCamp) continue;

      const victimVal = getPieceValue(victim);
      // 检查吃子后该落点是否被 AI 方保护（简单反吃估算）
      const afterCapPieces = piecesAfterMove
        .filter((x) => x.id !== victim.id)
        .map((x) => (x.id === oppPiece.id ? { ...x, row: targetPos.row, col: targetPos.col } : x));
      const afterCapGrid = buildBoardGrid(afterCapPieces);

      let isProtected = false;
      for (let k = 0; k < afterCapPieces.length; k++) {
        const aiDefender = afterCapPieces[k];
        if (aiDefender.camp !== aiCamp) continue;
        const aiReplies = getSafeLegalMovesForPiece(aiDefender, afterCapPieces, afterCapGrid);
        if (aiReplies.some((r) => r.row === targetPos.row && r.col === targetPos.col)) {
          isProtected = true;
          break;
        }
      }

      // 若被保护，净收益约为 victimVal - min(attackerVal, victimVal) * 0.85；若未受保护则是白吃 victimVal
      const netGain = isProtected
        ? Math.max(0, victimVal - attackerVal * 0.9)
        : victimVal;
      if (netGain > bestGain) {
        bestGain = netGain;
      }
    }
  }

  return bestGain;
}

/**
 * 实战 AI 选招引擎（结合内置定式库概率变例 + 1.5 层战术静态/反吃搜索 + 防长将判负）
 * 注：接入真实 Pikafish / Cyclone 后端引擎后，由服务端开局库 book.bin 与 Skill Level 接管。
 */
export function selectBotPlayMove(
  pieces: Piece[],
  aiCamp: Camp,
  skillTier: EngineSkillTier,
  currentPly: number,
  recentMoves: MoveRecord[] = []
): BotMoveCandidate | null {
  const grid = buildBoardGrid(pieces);
  const oppCamp: Camp = aiCamp === 'red' ? 'black' : 'red';

  // 统计近期对局中已出现过的盘面指纹，用于规避触发三次重复单方长将判负
  const seenPosCounts = new Map<string, number>();
  const recentWindow = recentMoves.slice(-16);
  for (let i = 0; i < recentWindow.length; i++) {
    const rec = recentWindow[i];
    const nextTurn: Camp = rec.piece.camp === 'red' ? 'black' : 'red';
    const sig = getPositionKeyFromPieces(rec.piecesSnapshot, nextTurn);
    seenPosCounts.set(sig, (seenPosCounts.get(sig) || 0) + 1);
  }

  // 1. 开局阶段（前 10 半步内）优先查询定式库并进行加权随机变例抽样
  if (currentPly < 10) {
    const bookNode = lookupOpeningBookNode(pieces, aiCamp);
    if (bookNode && bookNode.nextMoves.length > 0) {
      const legalPool = bookNode.nextMoves.filter((m) => {
        const p = grid[m.from.row * 9 + m.from.col];
        if (!p || p.camp !== aiCamp) return false;
        const safeMoves = getSafeLegalMovesForPiece(p, pieces, grid);
        if (!safeMoves.some((s) => s.row === m.to.row && s.col === m.to.col)) {
          return false;
        }
        // 高级/大师档位自动避开明显失先陷阱着
        if ((skillTier === 'grandmaster' || skillTier === 'deity') && m.badge === '陷阱') {
          return false;
        }
        return true;
      });

      if (legalPool.length > 0) {
        const sorted = [...legalPool].sort((a, b) => b.frequencyPct - a.frequencyPct);
        const capCount =
          skillTier === 'deity'
            ? Math.min(2, sorted.length)
            : skillTier === 'grandmaster'
            ? Math.min(3, sorted.length)
            : sorted.length;
        const slice = sorted.slice(0, capCount);
        const weights = slice.map((item, idx) => {
          const base = Math.max(6, item.frequencyPct);
          if (skillTier === 'deity') return idx === 0 ? base * 1.4 : base * 0.75;
          if (skillTier === 'grandmaster') return base;
          return Math.sqrt(base) * 10;
        });
        const chosen = slice[pickWeightedIndex(weights)];
        if (chosen) {
          return {
            from: chosen.from,
            to: chosen.to,
            notation: chosen.notation,
            source: 'book',
          };
        }
      }
    }
  }

  // 2. 脱离定式库或残局阶段：生成全部合法着法并按静默局面+位置启发预排序，再对高潜力候选执行 1.5 层战术复核
  const prevAiMove =
    recentMoves.length >= 2 && recentMoves[recentMoves.length - 2]?.piece.camp === aiCamp
      ? recentMoves[recentMoves.length - 2]
      : null;

  const sign = aiCamp === 'red' ? 1 : -1;
  const rawCandidates: {
    piece: Piece;
    from: Position;
    to: Position;
    notation: string;
    afterPieces: Piece[];
    preScore: number;
    givesCheck: boolean;
    isCapture: boolean;
    repeatCount: number;
  }[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.camp !== aiCamp) continue;
    const safeMoves = getSafeLegalMovesForPiece(p, pieces, grid);
    for (let j = 0; j < safeMoves.length; j++) {
      const to = safeMoves[j];
      const target = grid[to.row * 9 + to.col];
      const afterPieces = pieces
        .filter((x) => !(x.row === to.row && x.col === to.col))
        .map((x) => (x.id === p.id ? { ...x, row: to.row, col: to.col } : x));

      let posBonus = 0;
      if (p.type === 'cannon' && to.col === 4) posBonus += 0.32;
      if (p.type === 'horse' && (to.col === 2 || to.col === 6)) posBonus += 0.24;
      if (p.type === 'chariot' && (to.col === 1 || to.col === 7 || to.row === 4 || to.row === 5)) {
        posBonus += 0.26;
      }
      if (p.type === 'soldier' && (to.col === 2 || to.col === 6)) posBonus += 0.12;
      if (
        prevAiMove &&
        p.row === prevAiMove.to.row &&
        p.col === prevAiMove.to.col &&
        to.row === prevAiMove.from.row &&
        to.col === prevAiMove.from.col
      ) {
        posBonus -= 0.35;
      }

      const givesCheck = isCampInCheck(afterPieces, oppCamp) !== null;
      const sig = getPositionKeyFromPieces(afterPieces, oppCamp);
      const repeatCount = seenPosCounts.get(sig) || 0;
      const staticScore = evaluateBoardScore(afterPieces) * sign;

      rawCandidates.push({
        piece: p,
        from: { row: p.row, col: p.col },
        to,
        notation: formatChineseMoveNotation(p, { row: p.row, col: p.col }, to),
        afterPieces,
        preScore: staticScore + posBonus + (givesCheck ? 0.45 : 0),
        givesCheck,
        isCapture: !!target,
        repeatCount,
      });
    }
  }

  if (rawCandidates.length === 0) {
    // 最后保险：检查伪合法着法
    for (const p of pieces) {
      if (p.camp !== aiCamp) continue;
      const legal = getLegalMovesForPiece(p, pieces, grid);
      if (legal[0]) {
        return {
          from: { row: p.row, col: p.col },
          to: legal[0],
          notation: formatChineseMoveNotation(p, { row: p.row, col: p.col }, legal[0]),
          source: 'search',
        };
      }
    }
    return null;
  }

  // 合并静态高分候选 + 所有吃子/将军着法，去重后最多取 16 个做对手最优反击校验
  rawCandidates.sort((a, b) => b.preScore - a.preScore);
  const evalSet = new Set<typeof rawCandidates[number]>();
  for (let i = 0; i < rawCandidates.length; i++) {
    const cand = rawCandidates[i];
    if (i < 10 || cand.isCapture || cand.givesCheck) {
      evalSet.add(cand);
    }
    if (evalSet.size >= 16) break;
  }

  const tacticalCandidates = Array.from(evalSet).map((cand) => {
    const oppCounterGain = estimateOpponentBestCounterGain(cand.afterPieces, aiCamp);
    let tacticalScore = cand.preScore;

    if (oppCounterGain === -999) {
      // 直接将死或困毙对手
      tacticalScore = 999;
    } else {
      // 扣除对手最佳即刻反吃收益（初级档位略微钝化战术嗅觉，高级/大师全额防漏子）
      const threatWeight =
        skillTier === 'deity'
          ? 0.95
          : skillTier === 'grandmaster'
          ? 0.88
          : skillTier === 'strategist'
          ? 0.65
          : 0.3;
      tacticalScore -= oppCounterGain * threatWeight;
    }

    // 防长将违例判负：若重复将导致第 2/3 次同局面且正在将军，大幅降权避免 AI 自己长将送负
    if (cand.givesCheck && cand.repeatCount >= 1) {
      tacticalScore -= cand.repeatCount >= 2 ? 120 : 1.6;
    } else if (cand.repeatCount >= 2) {
      tacticalScore -= 1.2;
    }

    return {
      ...cand,
      tacticalScore,
    };
  });

  tacticalCandidates.sort((a, b) => b.tacticalScore - a.tacticalScore);
  const bestScore = tacticalCandidates[0].tacticalScore;

  // 若发现绝杀一步棋且非初级放水，立即走出
  if (bestScore >= 900 && skillTier !== 'scholar') {
    const killer = tacticalCandidates[0];
    return {
      from: killer.from,
      to: killer.to,
      notation: killer.notation,
      source: 'search',
    };
  }

  const maxDrop =
    skillTier === 'deity'
      ? 0.12
      : skillTier === 'grandmaster'
      ? 0.4
      : skillTier === 'strategist'
      ? 1.05
      : 2.25;
  const maxPoolSize =
    skillTier === 'deity' ? 2 : skillTier === 'grandmaster' ? 3 : skillTier === 'strategist' ? 4 : 5;

  const eligible = tacticalCandidates
    .filter((c) => bestScore - c.tacticalScore <= maxDrop)
    .slice(0, maxPoolSize);

  if (eligible.length > 1) {
    const weights = eligible.map((c, idx) => {
      const gap = Math.max(0, bestScore - c.tacticalScore);
      const decay = Math.exp(-gap * (skillTier === 'deity' ? 8 : skillTier === 'grandmaster' ? 3.2 : 1.4));
      const rankBoost = idx === 0 ? 1.35 : 1;
      return Math.max(0.05, decay * rankBoost);
    });
    const picked = eligible[pickWeightedIndex(weights)] || eligible[0];
    return {
      from: picked.from,
      to: picked.to,
      notation: picked.notation,
      source: 'search',
    };
  }

  if (tacticalCandidates[0]) {
    const top = tacticalCandidates[0];
    return {
      from: top.from,
      to: top.to,
      notation: top.notation,
      source: 'search',
    };
  }

  // 理论兜底（保留 generateSimulatedMultiPV 兼容）
  const sim = generateSimulatedMultiPV(pieces, aiCamp, 16, 1);
  if (sim.lines[0]) {
    return {
      from: sim.lines[0].firstMove.from,
      to: sim.lines[0].firstMove.to,
      notation: sim.lines[0].firstMove.notation,
      source: 'search',
    };
  }
  return null;
}
