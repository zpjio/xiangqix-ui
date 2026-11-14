import {
  BatchReviewMoveDiag,
  BatchReviewPreset,
  BatchReviewProgressEvent,
  BatchReviewRequest,
  Camp,
  EngineSearchRequest,
  EngineSearchStreamEvent,
  EngineStyleBias,
  MoveQuality,
  MoveRecord,
  MultiPVArrow,
  MultiPVLine,
  Piece,
} from '../types/xiangqi';
import {
  buildBoardGrid,
  evaluateBoardScore,
  formatChineseMoveNotation,
  generateOpponentThreatArrow,
  generateSimulatedMultiPV,
  getPieceAt,
  getSafeLegalMovesForPiece,
  isCampInCheck,
  parseFenToPieces,
  piecesToFen,
} from './xiangqiRules';

// ==================== 1. 按 FEN 会话 LRU 缓存 (上限 128 局面) ====================
const MAX_ENGINE_CACHE_SIZE = 128;
const engineStreamCache = new Map<string, EngineSearchStreamEvent>();

function buildSearchCacheKey(req: EngineSearchRequest): string {
  const modeTarget =
    req.mode === 'depth'
      ? `d${req.targetDepth}`
      : req.mode === 'movetime'
      ? `t${req.moveTimeMs}`
      : 'inf';
  return `${req.fen}|${req.engineId}|${req.mode}|${modeTarget}|pv${req.multiPvCount}|th${req.threads}|h${req.hashMb}`;
}

function getCachedSearchResult(key: string): EngineSearchStreamEvent | null {
  const hit = engineStreamCache.get(key);
  if (!hit) return null;
  // 刷新 LRU 顺序
  engineStreamCache.delete(key);
  engineStreamCache.set(key, hit);
  return hit;
}

function setCachedSearchResult(key: string, event: EngineSearchStreamEvent): void {
  if (engineStreamCache.has(key)) {
    engineStreamCache.delete(key);
  } else if (engineStreamCache.size >= MAX_ENGINE_CACHE_SIZE) {
    const oldestKey = engineStreamCache.keys().next().value;
    if (oldestKey !== undefined) {
      engineStreamCache.delete(oldestKey);
    }
  }
  engineStreamCache.set(key, event);
}

export function clearEngineSessionCache(): void {
  engineStreamCache.clear();
}

// ==================== 2. 胜率换算与客观棋评定级 ====================
export function evaluateScoreToWinPctRed(scoreCp: number): number {
  const clamped = Math.max(-12, Math.min(12, scoreCp));
  const pct = 100 / (1 + Math.exp(-0.55 * clamped));
  return Number(pct.toFixed(1));
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function applyShallowIterativePerturbation(
  baseResult: { lines: MultiPVLine[]; arrows: MultiPVArrow[] },
  currentDepth: number,
  targetDepth: number,
  fen: string
): { lines: MultiPVLine[]; arrows: MultiPVArrow[] } {
  if (currentDepth >= targetDepth || baseResult.lines.length === 0) {
    return baseResult;
  }
  const progress = Math.min(1, currentDepth / Math.max(1, targetDepth));
  const jitterAmp = (1 - progress) * 0.28;
  const seed = deterministicHash(`${fen}@${currentDepth}`);

  const lines = baseResult.lines.map((line, idx) => {
    const signedNoise = ((((seed >> (idx * 5)) & 0x1f) / 31) * 2 - 1) * jitterAmp;
    const scoreCp = Number((line.scoreCp + signedNoise).toFixed(2));
    return {
      ...line,
      depth: Math.max(4, currentDepth - idx),
      scoreCp,
      nps: Math.round(line.nps * (0.76 + progress * 0.24)),
      hashfull: Math.max(25, Math.round(line.hashfull * progress)),
    };
  });

  const arrows = lines.map((line) => ({
    rank: line.multipv,
    from: line.firstMove.from,
    to: line.firstMove.to,
    scoreText: `${line.scoreCp >= 0 ? '+' : ''}${line.scoreCp.toFixed(2)}`,
    notation: line.firstMove.notation,
  }));

  return { lines, arrows };
}

// ==================== 3. 流式渐进思考引擎模拟器 (无真实网络请求) ====================
export interface StreamEngineHandle {
  stop: () => void;
}

export function startSimulatedEngineStream(
  request: EngineSearchRequest,
  styleBias: EngineStyleBias,
  includeThreatRadar: boolean,
  onEvent: (ev: EngineSearchStreamEvent) => void
): StreamEngineHandle {
  let stopped = false;
  let timerId: number | null = null;

  const parsed = parseFenToPieces(request.fen);
  if (!parsed) {
    onEvent({
      sessionId: request.sessionId,
      phase: 'stopped',
      currentDepth: 0,
      selDepth: 0,
      nodes: 0,
      nps: 0,
      elapsedMs: 0,
      lines: [],
      arrows: [],
      threatArrow: undefined,
    } as EngineSearchStreamEvent & { threatArrow?: MultiPVArrow });
    return { stop: () => {} };
  }

  const cacheKey = buildSearchCacheKey(request);
  const cached = request.mode !== 'infinite' ? getCachedSearchResult(cacheKey) : null;
  if (cached) {
    const threatArrow = includeThreatRadar
      ? generateOpponentThreatArrow(parsed.pieces, parsed.turn) || undefined
      : undefined;
    onEvent({
      ...cached,
      sessionId: request.sessionId,
      cacheHit: true,
      ...(threatArrow ? { threatArrow } : {}),
    } as EngineSearchStreamEvent & { threatArrow?: MultiPVArrow });
    return { stop: () => {} };
  }

  const startTime = Date.now();
  const baseTargetDepth =
    request.mode === 'depth'
      ? request.targetDepth
      : request.mode === 'movetime'
      ? request.moveTimeMs >= 5000
        ? 26
        : 22
      : 32;

  // 预先生成稳定收敛的目标深度推演结论，流式阶段平滑向其收敛
  const finalResult = generateSimulatedMultiPV(
    parsed.pieces,
    parsed.turn,
    baseTargetDepth,
    request.multiPvCount,
    styleBias,
    request.threads,
    request.hashMb
  );
  const threatArrow = includeThreatRadar
    ? generateOpponentThreatArrow(parsed.pieces, parsed.turn) || undefined
    : undefined;

  const depthSchedule =
    request.mode === 'depth'
      ? [8, 12, 16, 20, 24, 28, 30]
          .filter((d) => d < request.targetDepth)
          .concat([request.targetDepth])
      : request.mode === 'movetime'
      ? [8, 11, 14, 16, 18, 20, 22, 24, 26].filter((d) => d <= baseTargetDepth)
      : [8, 11, 14, 17, 20, 22, 24, 26, 28, 30, 32, 34, 36];

  let stepIdx = 0;
  let accumulatedNodes = 0;

  const emitStep = () => {
    if (stopped) return;
    const elapsedMs = Date.now() - startTime;
    const reachedTimeLimit =
      request.mode === 'movetime' && elapsedMs >= request.moveTimeMs;
    const isLastDepthStep =
      request.mode === 'depth' && stepIdx >= depthSchedule.length - 1;

    const currentDepth =
      depthSchedule[Math.min(stepIdx, depthSchedule.length - 1)] || baseTargetDepth;
    const stepResult = applyShallowIterativePerturbation(
      finalResult,
      currentDepth,
      baseTargetDepth,
      request.fen
    );

    const topNps = stepResult.lines[0]?.nps || 3200;
    const tickInterval = request.mode === 'infinite' ? 260 : 165;
    accumulatedNodes += Math.round(topNps * 1000 * (tickInterval / 1000));

    const isDone =
      (request.mode === 'depth' && isLastDepthStep) ||
      (request.mode === 'movetime' && (reachedTimeLimit || stepIdx >= depthSchedule.length - 1));

    const eventPayload: EngineSearchStreamEvent & { threatArrow?: MultiPVArrow } = {
      sessionId: request.sessionId,
      phase: isDone ? 'completed' : 'searching',
      currentDepth,
      selDepth: currentDepth + 4,
      nodes: accumulatedNodes,
      nps: topNps,
      elapsedMs,
      cacheHit: false,
      lines: stepResult.lines,
      arrows: stepResult.arrows,
      ...(threatArrow ? { threatArrow } : {}),
    };

    if (isDone && request.mode !== 'infinite') {
      setCachedSearchResult(cacheKey, eventPayload);
    }

    onEvent(eventPayload);

    if (isDone) {
      return;
    }

    if (request.mode === 'infinite' && stepIdx >= depthSchedule.length - 1) {
      // 无限分析模式下达到最高展示层数后继续平稳累加节点计数
      timerId = window.setTimeout(emitStep, 450);
      return;
    }

    stepIdx++;
    const nextDelay =
      request.mode === 'movetime'
        ? Math.max(140, Math.min(340, Math.round(request.moveTimeMs / depthSchedule.length)))
        : request.mode === 'infinite'
        ? 240
        : 135;

    timerId = window.setTimeout(emitStep, nextDelay);
  };

  // 先快速给出第一帧浅层思考，避免空白等待
  timerId = window.setTimeout(emitStep, 35);

  return {
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}

// ==================== 4. 一键整局自动复盘模拟器 (快析 d=12 / 精析 d=18) ====================
function findStrongestReplyForPosition(
  pieces: Piece[],
  turn: Camp
): {
  from: { row: number; col: number };
  to: { row: number; col: number };
  notation: string;
  postEval: number;
} | null {
  const grid = buildBoardGrid(pieces);
  let best: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    notation: string;
    postEval: number;
  } | null = null;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.camp !== turn) continue;
    const legal = getSafeLegalMovesForPiece(p, pieces, grid);
    for (let j = 0; j < legal.length; j++) {
      const to = legal[j];
      const nextPieces = pieces
        .filter((item) => !(item.row === to.row && item.col === to.col))
        .map((item) => (item.id === p.id ? { ...item, row: to.row, col: to.col } : item));
      const score = evaluateBoardScore(nextPieces);
      const isBetter =
        !best || (turn === 'red' ? score > best.postEval : score < best.postEval);
      if (isBetter) {
        best = {
          from: { row: p.row, col: p.col },
          to,
          notation: formatChineseMoveNotation(p, { row: p.row, col: p.col }, to),
          postEval: score,
        };
      }
    }
  }
  return best;
}

export interface BatchReviewHandle {
  cancel: () => void;
}

export function startSimulatedBatchReview(
  request: BatchReviewRequest,
  onProgress: (ev: BatchReviewProgressEvent) => void
): BatchReviewHandle {
  let cancelled = false;
  let timerId: number | null = null;

  const parsedBase = parseFenToPieces(request.baseFen);
  if (!parsedBase || request.moves.length === 0) {
    onProgress({
      reviewId: request.reviewId,
      status: 'completed',
      preset: request.preset,
      completedPlies: 0,
      totalPlies: request.moves.length,
      estimatedRemainingMs: 0,
      results: [],
    });
    return { cancel: () => {} };
  }

  const totalPlies = request.moves.length;
  const perPlyDelayMs = request.preset === 'deep' ? 95 : 42;
  const scanDepth = request.preset === 'deep' ? 18 : 12;

  let currentPieces = parsedBase.pieces.map((p) => ({ ...p }));
  let prevEvalRed = evaluateBoardScore(currentPieces);
  let prevWinRed = evaluateScoreToWinPctRed(prevEvalRed);
  const results: BatchReviewMoveDiag[] = [];
  let idx = 0;

  const processNextChunk = () => {
    if (cancelled) {
      onProgress({
        reviewId: request.reviewId,
        status: 'cancelled',
        preset: request.preset,
        completedPlies: idx,
        totalPlies,
        estimatedRemainingMs: 0,
        results: [...results],
      });
      return;
    }

    const chunkSize = request.preset === 'fast' ? 2 : 1;
    for (let c = 0; c < chunkSize && idx < totalPlies; c++) {
      const step = request.moves[idx];
      const moving = getPieceAt(currentPieces, step.from.row, step.from.col);
      if (!moving) {
        idx = totalPlies;
        break;
      }

      const moverCamp = moving.camp;
      const bestChoice = findStrongestReplyForPosition(currentPieces, moverCamp);

      // 走子后局面
      const nextPieces = currentPieces
        .filter((p) => !(p.row === step.to.row && p.col === step.to.col))
        .map((p) => (p.id === moving.id ? { ...p, row: step.to.row, col: step.to.col } : p));

      const nextTurn: Camp = moverCamp === 'red' ? 'black' : 'red';
      const oppReply = findStrongestReplyForPosition(nextPieces, nextTurn);

      // 精析档位融入一步反击折算，以捕捉送吃/漏杀
      const staticEval = evaluateBoardScore(nextPieces);
      const tacticalEval = oppReply
        ? Number((staticEval * 0.65 + oppReply.postEval * 0.35).toFixed(2))
        : staticEval;
      const evalScore =
        request.preset === 'deep'
          ? tacticalEval
          : Number((staticEval * 0.8 + tacticalEval * 0.2).toFixed(2));

      const winRateRed = evaluateScoreToWinPctRed(evalScore);
      const bestEvalRed = bestChoice ? bestChoice.postEval : prevEvalRed;
      const bestWinRed = evaluateScoreToWinPctRed(bestEvalRed);

      // 计算执方视角相对于最佳着法的胜率损失
      const winLossVsBest =
        moverCamp === 'red'
          ? Math.max(0, bestWinRed - winRateRed)
          : Math.max(0, (100 - bestWinRed) - (100 - winRateRed));
      const winGainFromPrev =
        moverCamp === 'red' ? winRateRed - prevWinRed : prevWinRed - winRateRed;

      const isSameAsBest =
        bestChoice &&
        bestChoice.from.row === step.from.row &&
        bestChoice.from.col === step.from.col &&
        bestChoice.to.row === step.to.row &&
        bestChoice.to.col === step.to.col;

      const deliveredCheck = isCampInCheck(nextPieces, nextTurn) !== null;

      let quality: MoveQuality = '良';
      let comment: string | undefined;
      let bestAlternative: string | undefined;
      let bestFrom: { row: number; col: number } | undefined;
      let bestTo: { row: number; col: number } | undefined;

      if (winLossVsBest >= 10.5) {
        quality = '败';
        if (bestChoice && !isSameAsBest) {
          bestAlternative = bestChoice.notation;
          bestFrom = bestChoice.from;
          bestTo = bestChoice.to;
          comment = `胜率骤降 ${winLossVsBest.toFixed(1)}%（d=${scanDepth}），宜改走「${bestChoice.notation}」稳住阵脚。`;
        } else {
          comment = `此着导致局势明显恶化（胜率下滑 ${winLossVsBest.toFixed(1)}%）。`;
        }
      } else if (winLossVsBest >= 4.2) {
        quality = '缓';
        if (bestChoice && !isSameAsBest) {
          bestAlternative = bestChoice.notation;
          bestFrom = bestChoice.from;
          bestTo = bestChoice.to;
          comment = `步调偏缓（损失胜率 ${winLossVsBest.toFixed(1)}%），推荐改走「${bestChoice.notation}」争先。`;
        }
      } else if (isSameAsBest && (deliveredCheck || winGainFromPrev >= 3.2)) {
        quality = '妙';
        comment = `敏锐抓住战机（d=${scanDepth} 首推妙手），扩大局面主动权。`;
      } else if (isSameAsBest || winLossVsBest <= 1.5) {
        quality = '优';
      } else {
        quality = '良';
      }

      results.push({
        ply: idx + 1,
        evalScore,
        winRateRed,
        quality,
        ...(bestAlternative ? { bestAlternative, bestFrom, bestTo } : {}),
        ...(comment ? { comment } : {}),
      });

      currentPieces = nextPieces;
      prevEvalRed = evalScore;
      prevWinRed = winRateRed;
      idx++;
    }

    const completed = idx >= totalPlies;
    const remainingPlies = Math.max(0, totalPlies - idx);
    onProgress({
      reviewId: request.reviewId,
      status: completed ? 'completed' : 'running',
      preset: request.preset,
      completedPlies: idx,
      totalPlies,
      estimatedRemainingMs: completed ? 0 : remainingPlies * perPlyDelayMs,
      results: [...results],
    });

    if (!completed && !cancelled) {
      timerId = window.setTimeout(processNextChunk, perPlyDelayMs);
    }
  };

  timerId = window.setTimeout(processNextChunk, 45);

  return {
    cancel: () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      onProgress({
        reviewId: request.reviewId,
        status: 'cancelled',
        preset: request.preset,
        completedPlies: idx,
        totalPlies,
        estimatedRemainingMs: 0,
        results: [...results],
      });
    },
  };
}

export function applyBatchReviewToMoves(
  moves: MoveRecord[],
  diags: BatchReviewMoveDiag[]
): MoveRecord[] {
  const diagMap = new Map<number, BatchReviewMoveDiag>();
  for (const d of diags) {
    diagMap.set(d.ply, d);
  }
  return moves.map((m) => {
    const d = diagMap.get(m.ply);
    if (!d) return m;
    return {
      ...m,
      evalScore: d.evalScore,
      quality: d.quality,
      bestAlternative: d.bestAlternative,
      bestFrom: d.bestFrom,
      bestTo: d.bestTo,
      comment: d.comment || m.comment,
    };
  });
}

export function buildFenForPosition(pieces: Piece[], turn: Camp): string {
  return piecesToFen(pieces, turn);
}
