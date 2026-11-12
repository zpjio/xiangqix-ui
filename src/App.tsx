/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Lightbulb,
  RotateCcw,
  Swords,
} from 'lucide-react';
import { Board } from './components/Board';
import { BoardNav } from './components/BoardNav';
import { DialogsModalSuite } from './components/DialogsModalSuite';
import { EnginePanel } from './components/EnginePanel';
import { EvalBar } from './components/EvalBar';
import { GameReviewPanel } from './components/GameReviewPanel';
import { MoveList } from './components/MoveList';
import { PlayerSeatBar } from './components/PlayerSeatBar';
import { StatusBar } from './components/StatusBar';
import { Titlebar } from './components/Titlebar';
import { CLASSICAL_CHALLENGES, INITIAL_LIBRARY_GAMES } from './data/catalogRegistry';
import {
  ActiveModalId,
  AppTheme,
  BoardTheme,
  Camp,
  EngineProfile,
  EngineProtocol,
  EngineSkillTier,
  ExternalConnectState,
  FontScale,
  FontScheme,
  GameMetadata,
  HandicapType,
  ImpactEffect,
  LibraryGameItem,
  MoveRecord,
  MultiPVArrow,
  Piece,
  PieceCraftStyle,
  PieceType,
  Position,
  WorkspaceMode,
} from './types/xiangqi';
import {
  calculateMaterialAndCaptures,
  createInitialPieces,
  createKingsOnlyPieces,
  createSampleSessionMoves,
  evaluateBoardScore,
  formatChineseMoveNotation,
  formatGameToPgn,
  generateOpponentThreatArrow,
  generateSimulatedMultiPV,
  getLegalMovesForPiece,
  getPieceAt,
  isCampInCheck,
  parseFenToPieces,
  piecesToFen,
  playWoodClackSound,
} from './utils/xiangqiRules';

export default function App() {
  // ==================== 1. 全局外观与主题状态 ====================
  const [appTheme, setAppTheme] = useState<AppTheme>('dark');
  const [fontScale, setFontScale] = useState<FontScale>('standard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('xuan-rosewood');
  const [craftStyle, setCraftStyle] = useState<PieceCraftStyle>('boxwood-ebony');
  const [fontScheme] = useState<FontScheme>('kaiti-serif');
  const [useTraditionalChar, setUseTraditionalChar] = useState<boolean>(false);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', appTheme);
    html.setAttribute('data-font-scale', fontScale);
    if (appTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [appTheme, fontScale]);

  // ==================== 2. 核心工作空间、棋谱主线与无感内联分支 ====================
  const sampleSession = useMemo(() => createSampleSessionMoves(), []);
  const [workspace, setWorkspace] = useState<WorkspaceMode>('study');
  const [rightTab, setRightTab] = useState<'moves' | 'review'>('moves');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [mainMoves, setMainMoves] = useState<MoveRecord[]>(sampleSession.moves);
  const [variationMoves, setVariationMoves] = useState<MoveRecord[] | null>(null);
  const [branchOriginPly, setBranchOriginPly] = useState<number | null>(null);
  const [currentPly, setCurrentPly] = useState<number>(12);
  const [pieces, setPieces] = useState<Piece[]>(
    sampleSession.moves[11]?.piecesSnapshot || sampleSession.initialPieces
  );
  const [turn, setTurn] = useState<Camp>('red');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [impactEffect, setImpactEffect] = useState<ImpactEffect | null>(null);
  const [flipped, setFlipped] = useState<boolean>(false);

  // 多引擎注册表与双擎并行对比状态（预置皮卡鱼 UCI、旋风 UCI、天机 UCCI 三大引擎）
  const [engines, setEngines] = useState<EngineProfile[]>([
    {
      id: 'pikafish',
      name: '皮卡鱼 Pikafish 2026',
      shortName: '皮卡鱼',
      version: '2026.11 AVX2',
      protocol: 'UCI',
      styleBias: 'balanced',
      styleLabel: '均衡全能',
      nnueFile: 'pikafish.nnue',
      sizeMb: 38,
      status: 'ready',
      installProgress: 100,
    },
    {
      id: 'cyclone',
      name: '旋风 Cyclone v12',
      shortName: '旋风',
      version: 'v12.4 Ultimate',
      protocol: 'UCI',
      styleBias: 'aggressive',
      styleLabel: '中路强攻',
      nnueFile: 'cyclone_v12.nnue',
      sizeMb: 42,
      status: 'ready',
      installProgress: 100,
    },
    {
      id: 'xqms',
      name: '天机 XQMS Pro 3.26',
      shortName: '天机',
      version: 'v3.26 UCCI',
      protocol: 'UCCI',
      styleBias: 'positional',
      styleLabel: '阵地绵密',
      nnueFile: 'xqms.nnue',
      sizeMb: 31,
      status: 'missing',
      installProgress: 0,
    },
  ]);
  const [primaryEngineId, setPrimaryEngineId] = useState<string>('pikafish');
  const [secondaryEngineId, setSecondaryEngineId] = useState<string>('cyclone');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [multiPvCount, setMultiPvCount] = useState<1 | 2 | 3>(3);
  const [engineDepth, setEngineDepth] = useState<18 | 24 | 30>(24);
  const [engineThreads, setEngineThreads] = useState<4 | 8 | 16>(8);
  const [engineHashMb, setEngineHashMb] = useState<256 | 512 | 1024>(512);
  const [threatRadarEnabled, setThreatRadarEnabled] = useState<boolean>(false);
  const [hoveredArrow, setHoveredArrow] = useState<MultiPVArrow | null>(null);
  const [hintArrow, setHintArrow] = useState<MultiPVArrow | null>(null);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const handleInstallEngine = useCallback((targetId: string) => {
    setEngines((prev) =>
      prev.map((eng) =>
        eng.id === targetId && eng.status !== 'installing'
          ? { ...eng, status: 'installing', installProgress: 14 }
          : eng
      )
    );
    const timer = window.setInterval(() => {
      setEngines((prev) => {
        const target = prev.find((e) => e.id === targetId);
        if (!target || target.status !== 'installing') {
          window.clearInterval(timer);
          return prev;
        }
        if (target.installProgress >= 92) {
          window.clearInterval(timer);
          setIsAnalyzing(true);
          return prev.map((e) =>
            e.id === targetId ? { ...e, status: 'ready', installProgress: 100 } : e
          );
        }
        return prev.map((e) =>
          e.id === targetId
            ? { ...e, installProgress: Math.min(99, e.installProgress + 22) }
            : e
        );
      });
    }, 180);
  }, []);

  const handleResetEngineMissing = useCallback((targetId: string) => {
    setEngines((prev) =>
      prev.map((e) =>
        e.id === targetId ? { ...e, status: 'missing', installProgress: 0 } : e
      )
    );
  }, []);

  const handleAddCustomEngine = useCallback((fileName: string, protocol: EngineProtocol) => {
    const cleanName = fileName.replace(/\.(exe|bin|uci|ucci)$/i, '');
    const newId = `custom-${Date.now()}`;
    const newEngine: EngineProfile = {
      id: newId,
      name: `${cleanName} (本地导入)`,
      shortName: cleanName.slice(0, 6) || '自定义',
      version: 'Local Custom',
      protocol,
      styleBias: protocol === 'UCCI' ? 'positional' : 'aggressive',
      styleLabel: protocol === 'UCCI' ? '阵地均衡' : '算力进取',
      nnueFile: `${cleanName.toLowerCase()}.nnue`,
      sizeMb: 36,
      status: 'ready',
      installProgress: 100,
    };
    setEngines((prev) => [...prev, newEngine]);
    setSecondaryEngineId(newId);
  }, []);

  const handleChangePrimaryEngine = useCallback(
    (nextPrimaryId: string) => {
      setPrimaryEngineId(nextPrimaryId);
      if (nextPrimaryId === secondaryEngineId) {
        const fallback = engines.find((e) => e.id !== nextPrimaryId);
        if (fallback) setSecondaryEngineId(fallback.id);
      }
    },
    [secondaryEngineId, engines]
  );

  // 外部平台连线状态（复用复盘分析）
  const [connectState, setConnectState] = useState<ExternalConnectState>({
    connected: false,
    platform: 'tiantian',
    platformLabel: '天天象棋桌面版',
    autoAnalyze: true,
  });

  // 败着重练状态 (Retry Mistake)
  const [retryMistakePly, setRetryMistakePly] = useState<number | null>(null);
  const [retryTargetMove, setRetryTargetMove] = useState<{
    from: Position;
    to: Position;
    notation: string;
  } | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  // 古谱残局闯关状态
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    CLASSICAL_CHALLENGES[0].id
  );
  const [challengeStatusBanner, setChallengeStatusBanner] = useState<string | null>(null);

  // 人机对弈（含传统让子）状态
  const [handicap, setHandicap] = useState<HandicapType>('even');
  const [skillTier, setSkillTier] = useState<EngineSkillTier>('grandmaster');
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);

  // 摆子工坊状态
  const [setupSelectedTemplate, setSetupSelectedTemplate] = useState<{
    camp: Camp;
    type: PieceType;
  } | null>({ camp: 'red', type: 'chariot' });
  const [setupTurn, setSetupTurn] = useState<Camp>('red');

  // 对局名录与弹窗状态
  const [metadata, setMetadata] = useState<GameMetadata>({
    redPlayer: '王天一',
    blackPlayer: '郑惟桐',
    event: '全国象棋个人锦标赛冠亚军决战',
    date: '2026-11-11',
    result: '红胜',
    site: '杭州棋院',
    opening: '中炮过河车对屏风马',
    isFavorite: true,
  });
  const [libraryGames, setLibraryGames] = useState<LibraryGameItem[]>(INITIAL_LIBRARY_GAMES);
  const [activeModal, setActiveModal] = useState<ActiveModalId>(null);

  // ==================== 3. 派生计算：当前谱系、子力战利品、合法落点与威胁雷达 ====================
  const activeMovesList = variationMoves || mainMoves;
  const lastMove = useMemo(() => {
    if (currentPly <= 0) return null;
    return activeMovesList[currentPly - 1] || null;
  }, [activeMovesList, currentPly]);

  const selectedPiece = useMemo(
    () => pieces.find((p) => p.id === selectedPieceId) || null,
    [pieces, selectedPieceId]
  );

  const legalMoves = useMemo(() => {
    if (!selectedPiece || workspace === 'setup' || isBotThinking) return [];
    return getLegalMovesForPiece(selectedPiece, pieces);
  }, [selectedPiece, pieces, workspace, isBotThinking]);

  const primaryEngine = useMemo(
    () => engines.find((e) => e.id === primaryEngineId) || engines[0],
    [engines, primaryEngineId]
  );
  const secondaryEngine = useMemo(
    () =>
      engines.find((e) => e.id === secondaryEngineId) ||
      engines.find((e) => e.id !== primaryEngine.id) ||
      engines[0],
    [engines, secondaryEngineId, primaryEngine.id]
  );

  const multiPvData = useMemo(() => {
    if (primaryEngine.status !== 'ready' || !isAnalyzing || workspace === 'setup') {
      return { lines: [], arrows: [] };
    }
    return generateSimulatedMultiPV(
      pieces,
      turn,
      engineDepth,
      multiPvCount,
      primaryEngine.styleBias,
      engineThreads,
      engineHashMb
    );
  }, [
    primaryEngine.status,
    primaryEngine.styleBias,
    isAnalyzing,
    workspace,
    pieces,
    turn,
    engineDepth,
    multiPvCount,
    engineThreads,
    engineHashMb,
  ]);

  const secondaryMultiPvData = useMemo(() => {
    if (
      !compareMode ||
      secondaryEngine.status !== 'ready' ||
      !isAnalyzing ||
      workspace === 'setup'
    ) {
      return { lines: [], arrows: [] };
    }
    return generateSimulatedMultiPV(
      pieces,
      turn,
      engineDepth,
      2,
      secondaryEngine.styleBias,
      engineThreads,
      engineHashMb
    );
  }, [
    compareMode,
    secondaryEngine.status,
    secondaryEngine.styleBias,
    isAnalyzing,
    workspace,
    pieces,
    turn,
    engineDepth,
    engineThreads,
    engineHashMb,
  ]);

  // 棋盘箭头合成：单引擎显示主/次变；双擎对比下显示主擎首推(绿) + 副擎首推(蓝)，若一致则自动合并为 [双擎共识]
  const boardArrows = useMemo(() => {
    if (!compareMode) {
      return {
        primaryArrows: multiPvData.arrows,
        secondaryArrow: null as MultiPVArrow | null,
      };
    }
    const priTop = multiPvData.lines[0];
    const secTop = secondaryMultiPvData.lines[0];
    if (!priTop) {
      return { primaryArrows: [], secondaryArrow: null };
    }
    const fmt = (cp: number) => `${cp >= 0 ? '+' : ''}${cp.toFixed(2)}`;
    if (
      secTop &&
      priTop.firstMove.from.row === secTop.firstMove.from.row &&
      priTop.firstMove.from.col === secTop.firstMove.from.col &&
      priTop.firstMove.to.row === secTop.firstMove.to.row &&
      priTop.firstMove.to.col === secTop.firstMove.to.col
    ) {
      const avgCp = Number(((priTop.scoreCp + secTop.scoreCp) / 2).toFixed(2));
      return {
        primaryArrows: [
          {
            rank: 1,
            from: priTop.firstMove.from,
            to: priTop.firstMove.to,
            scoreText: `[双擎共识] ${fmt(avgCp)}`,
            notation: priTop.firstMove.notation,
            isConsensus: true,
          },
        ],
        secondaryArrow: null,
      };
    }

    return {
      primaryArrows: [
        {
          rank: 1,
          from: priTop.firstMove.from,
          to: priTop.firstMove.to,
          scoreText: `[${primaryEngine.shortName}] ${fmt(priTop.scoreCp)}`,
          notation: priTop.firstMove.notation,
        },
      ],
      secondaryArrow: secTop
        ? {
            rank: 1,
            from: secTop.firstMove.from,
            to: secTop.firstMove.to,
            scoreText: `[${secondaryEngine.shortName}] ${fmt(secTop.scoreCp)}`,
            notation: secTop.firstMove.notation,
            isSecondaryEngine: true,
          }
        : null,
    };
  }, [
    compareMode,
    multiPvData,
    secondaryMultiPvData,
    primaryEngine.shortName,
    secondaryEngine.shortName,
  ]);

  const threatArrow = useMemo(() => {
    if (primaryEngine.status !== 'ready' || !threatRadarEnabled || workspace === 'setup')
      return null;
    return generateOpponentThreatArrow(pieces, turn);
  }, [primaryEngine.status, threatRadarEnabled, workspace, pieces, turn]);

  const currentEvalScore = useMemo(() => {
    if (multiPvData.lines[0]) return multiPvData.lines[0].scoreCp;
    if (lastMove) return lastMove.evalScore;
    return evaluateBoardScore(pieces);
  }, [multiPvData, lastMove, pieces]);

  const materialStats = useMemo(() => calculateMaterialAndCaptures(pieces), [pieces]);

  const inCheckCamp = useMemo((): Camp | null => {
    if (isCampInCheck(pieces, 'red')) return 'red';
    if (isCampInCheck(pieces, 'black')) return 'black';
    return null;
  }, [pieces]);

  const currentChallenge = useMemo(
    () =>
      CLASSICAL_CHALLENGES.find((c) => c.id === selectedChallengeId) ||
      CLASSICAL_CHALLENGES[0],
    [selectedChallengeId]
  );

  // ==================== 4. 切换工作空间与载入古谱/让子对局 ====================
  const handleSwitchWorkspace = useCallback(
    (nextWs: WorkspaceMode) => {
      setWorkspace(nextWs);
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setRetryMistakePly(null);
      setRetryFeedback(null);

      if (nextWs === 'study') {
        setPieces(sampleSession.moves[11]?.piecesSnapshot || sampleSession.initialPieces);
        setMainMoves(sampleSession.moves);
        setVariationMoves(null);
        setBranchOriginPly(null);
        setCurrentPly(12);
        setTurn('red');
        setIsAnalyzing(true);
      } else if (nextWs === 'challenge') {
        const ch = CLASSICAL_CHALLENGES[0];
        setSelectedChallengeId(ch.id);
        setPieces(ch.pieces());
        setMainMoves([]);
        setVariationMoves(null);
        setCurrentPly(0);
        setTurn(ch.initialTurn);
        setChallengeStatusBanner(`破局目标：${ch.objective}`);
        setIsAnalyzing(false);
      } else if (nextWs === 'play') {
        const initP = createInitialPieces(handicap);
        setPieces(initP);
        setMainMoves([]);
        setVariationMoves(null);
        setCurrentPly(0);
        setTurn('red');
        setIsAnalyzing(false);
      } else if (nextWs === 'setup') {
        setIsAnalyzing(false);
      }
    },
    [sampleSession, handicap]
  );

  const handleSelectChallenge = (chId: string) => {
    const ch = CLASSICAL_CHALLENGES.find((c) => c.id === chId);
    if (!ch) return;
    setSelectedChallengeId(ch.id);
    setPieces(ch.pieces());
    setMainMoves([]);
    setVariationMoves(null);
    setCurrentPly(0);
    setTurn(ch.initialTurn);
    setHintArrow(null);
    setChallengeStatusBanner(`破局目标：${ch.objective}`);
  };

  const handleStartHandicapGame = (newHandicap: HandicapType, newTier: EngineSkillTier) => {
    setHandicap(newHandicap);
    setSkillTier(newTier);
    const initP = createInitialPieces(newHandicap);
    setPieces(initP);
    setMainMoves([]);
    setVariationMoves(null);
    setCurrentPly(0);
    setTurn(newHandicap === 'move-first' ? 'black' : 'red');
    setHintArrow(null);
  };

  // ==================== 5. 跳手、无感内联分支走子与人机/古谱自动应手 ====================
  const handleJumpPly = useCallback(
    (targetPly: number, useVariation = false) => {
      const list = useVariation && variationMoves ? variationMoves : mainMoves;
      if (!useVariation && variationMoves) {
        // 点击主谱任意手时，若低于分叉点则保留或切回主谱视图
      }
      const clamped = Math.max(0, Math.min(list.length, targetPly));
      setCurrentPly(clamped);
      setSelectedPieceId(null);
      setHintArrow(null);

      if (clamped === 0) {
        const baseInit =
          workspace === 'challenge'
            ? currentChallenge.pieces()
            : createInitialPieces(workspace === 'play' ? handicap : 'even');
        setPieces(baseInit);
        setTurn('red');
      } else {
        const rec = list[clamped - 1];
        if (rec) {
          setPieces(rec.piecesSnapshot.map((p) => ({ ...p })));
          setTurn(rec.piece.camp === 'red' ? 'black' : 'red');
        }
      }
    },
    [variationMoves, mainMoves, workspace, currentChallenge, handicap]
  );

  const executeMoveOnBoard = useCallback(
    (from: Position, to: Position) => {
      const moving = getPieceAt(pieces, from.row, from.col);
      if (!moving) return;
      const captured = getPieceAt(pieces, to.row, to.col);
      const notation = formatChineseMoveNotation(moving, from, to);

      const nextPieces = pieces
        .filter((p) => !(p.row === to.row && p.col === to.col))
        .map((p) => (p.id === moving.id ? { ...p, row: to.row, col: to.col } : p));

      const nextEval = evaluateBoardScore(nextPieces);
      const nextPly = currentPly + 1;
      const newRecord: MoveRecord = {
        ply: nextPly,
        piece: { ...moving },
        from,
        to,
        captured: captured ? { ...captured } : undefined,
        notation,
        evalScore: nextEval,
        quality: nextEval > 1.2 ? '优' : '良',
        piecesSnapshot: nextPieces.map((p) => ({ ...p })),
      };

      playWoodClackSound(!!captured, to.row, to.col, soundEnabled);
      setImpactEffect({
        id: Date.now(),
        row: to.row,
        col: to.col,
        camp: moving.camp,
        isCapture: !!captured,
      });

      setPieces(nextPieces);
      setSelectedPieceId(null);
      setHintArrow(null);
      const nextTurn: Camp = moving.camp === 'red' ? 'black' : 'red';
      setTurn(nextTurn);
      setCurrentPly(nextPly);

      // 检查是否处于「败着重练 (Retry Mistake)」考核中
      if (retryMistakePly !== null && retryTargetMove) {
        if (
          from.row === retryTargetMove.from.row &&
          from.col === retryTargetMove.from.col &&
          to.row === retryTargetMove.to.row &&
          to.col === retryTargetMove.to.col
        ) {
          setRetryFeedback(
            `正解！走出「${notation}」成功化解危机，局势重回均势稳固！`
          );
          setRetryMistakePly(null);
          setRetryTargetMove(null);
        } else {
          setRetryFeedback(
            `您尝试了「${notation}」，但皮卡鱼最佳正着为「${retryTargetMove.notation}」，可点击「在此手重练」再试一次。`
          );
        }
      }

      // 在「研习复盘」模式下：若在中途历史手走了不同于主谱的棋，自动生成无感内联推演支线！
      if (workspace === 'study') {
        const existingMainMove = mainMoves[currentPly];
        const isSameAsMain =
          existingMainMove &&
          existingMainMove.from.row === from.row &&
          existingMainMove.from.col === from.col &&
          existingMainMove.to.row === to.row &&
          existingMainMove.to.col === to.col;

        if (isSameAsMain && !variationMoves) {
          // 沿主线继续前进
        } else if (currentPly < mainMoves.length || variationMoves) {
          const baseList = variationMoves || mainMoves;
          const origin = branchOriginPly ?? currentPly;
          setBranchOriginPly(origin);
          setVariationMoves([...baseList.slice(0, currentPly), newRecord]);
        } else {
          setMainMoves([...mainMoves, newRecord]);
        }
      } else {
        setMainMoves((prev) => [...prev.slice(0, currentPly), newRecord]);
      }

      // 若在「古谱闯关」或「人机对弈」模式下且轮到黑方（引擎），延迟 600ms 自动应手
      if ((workspace === 'challenge' || workspace === 'play') && nextTurn === 'black') {
        if (workspace === 'challenge' && nextPly === 1) {
          const hm = currentChallenge.hintMove;
          if (from.row === hm.from.row && from.col === hm.from.col && to.row === hm.to.row && to.col === hm.to.col) {
            setChallengeStatusBanner(`好棋！走出《${currentChallenge.sourceBook}》正着「${notation}」！`);
          } else {
            setChallengeStatusBanner(`已走出「${notation}」，黑方应对中（可点「支招」查看正着）`);
          }
        }

        setIsBotThinking(true);
        setTimeout(() => {
          const sim = generateSimulatedMultiPV(nextPieces, 'black', 18);
          const reply = sim.lines[0]?.firstMove;
          if (reply) {
            const botPiece = getPieceAt(nextPieces, reply.from.row, reply.from.col);
            if (botPiece) {
              const botCap = getPieceAt(nextPieces, reply.to.row, reply.to.col);
              const afterBot = nextPieces
                .filter((p) => !(p.row === reply.to.row && p.col === reply.to.col))
                .map((p) =>
                  p.id === botPiece.id ? { ...p, row: reply.to.row, col: reply.to.col } : p
                );
              const botRec: MoveRecord = {
                ply: nextPly + 1,
                piece: { ...botPiece },
                from: reply.from,
                to: reply.to,
                captured: botCap ? { ...botCap } : undefined,
                notation: reply.notation,
                evalScore: evaluateBoardScore(afterBot),
                quality: '优',
                piecesSnapshot: afterBot,
              };
              playWoodClackSound(!!botCap, reply.to.row, reply.to.col, soundEnabled);
              setPieces(afterBot);
              setMainMoves((prev) => [...prev.slice(0, nextPly), botRec]);
              setCurrentPly(nextPly + 1);
              setTurn('red');
            }
          }
          setIsBotThinking(false);
        }, 620);
      }
    },
    [
      pieces,
      currentPly,
      soundEnabled,
      retryMistakePly,
      retryTargetMove,
      workspace,
      mainMoves,
      variationMoves,
      branchOriginPly,
      currentChallenge,
    ]
  );

  const handleSelectIntersection = (row: number, col: number) => {
    if (isBotThinking) return;

    if (workspace === 'setup') {
      const existing = getPieceAt(pieces, row, col);
      if (existing) {
        if (existing.type === 'general') return;
        setPieces(pieces.filter((p) => p.id !== existing.id));
      } else if (setupSelectedTemplate) {
        const newPiece: Piece = {
          id: `setup-${setupSelectedTemplate.camp}-${setupSelectedTemplate.type}-${Date.now()}`,
          camp: setupSelectedTemplate.camp,
          type: setupSelectedTemplate.type,
          row,
          col,
        };
        playWoodClackSound(false, row, col, soundEnabled);
        setPieces([...pieces, newPiece]);
      }
      return;
    }

    if (selectedPiece && legalMoves.some((m) => m.row === row && m.col === col)) {
      executeMoveOnBoard(
        { row: selectedPiece.row, col: selectedPiece.col },
        { row, col }
      );
      return;
    }

    const clickedPiece = getPieceAt(pieces, row, col);
    if (clickedPiece && clickedPiece.camp === turn) {
      setSelectedPieceId(clickedPiece.id === selectedPieceId ? null : clickedPiece.id);
    } else {
      setSelectedPieceId(null);
    }
  };

  // ==================== 6. 锦囊支招 (Hint) 与 自动回放 ====================
  const handleTriggerHint = useCallback(() => {
    if (workspace === 'challenge' && currentPly === 0) {
      const hm = currentChallenge.hintMove;
      setHintArrow({
        rank: 1,
        from: hm.from,
        to: hm.to,
        scoreText: `正着 ${hm.notation}`,
        notation: hm.notation,
      });
      setChallengeStatusBanner(`正着提示：${hm.notation} —— ${hm.explanation}`);
      return;
    }

    const sim = generateSimulatedMultiPV(pieces, turn, 22);
    const best = sim.lines[0]?.firstMove;
    if (best) {
      setHintArrow({
        rank: 1,
        from: best.from,
        to: best.to,
        scoreText: `支招 ${best.notation}`,
        notation: best.notation,
      });
    }
  }, [workspace, currentPly, currentChallenge, pieces, turn]);

  useEffect(() => {
    if (!isReplaying) return;
    const timer = setInterval(() => {
      setCurrentPly((prev) => {
        const list = variationMoves || mainMoves;
        if (prev >= list.length) {
          setIsReplaying(false);
          return prev;
        }
        const next = prev + 1;
        const rec = list[next - 1];
        if (rec) {
          setPieces(rec.piecesSnapshot.map((p) => ({ ...p })));
          setTurn(rec.piece.camp === 'red' ? 'black' : 'red');
          playWoodClackSound(!!rec.captured, rec.to.row, rec.to.col, soundEnabled);
        }
        return next;
      });
    }, 850);
    return () => clearInterval(timer);
  }, [isReplaying, variationMoves, mainMoves, soundEnabled]);

  // 全局快捷键支持 (⌘K 呼出命令面板，←/→ 前后跳手，Space 走出引擎最佳推荐着进入推演)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'command-palette' ? null : 'command-palette'));
        return;
      }
      if (activeModal) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleJumpPly(currentPly - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleJumpPly(currentPly + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleJumpPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        handleJumpPly(activeMovesList.length);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCompareMode((prev) => !prev);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (e.key === ' ' && workspace === 'study') {
        e.preventDefault();
        const best = multiPvData.lines[0]?.firstMove;
        if (best) {
          executeMoveOnBoard(best.from, best.to);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeModal,
    handleJumpPly,
    currentPly,
    activeMovesList.length,
    workspace,
    multiPvData,
    executeMoveOnBoard,
  ]);

  // 收藏当前棋局并与棋谱库「我的收藏」实时联动
  const handleToggleCurrentFavorite = useCallback(() => {
    const nextFav = !metadata.isFavorite;
    setMetadata((prev) => ({ ...prev, isFavorite: nextFav }));
    setLibraryGames((prev) => {
      const existingIdx = prev.findIndex(
        (g) => g.redPlayer === metadata.redPlayer && g.blackPlayer === metadata.blackPlayer && g.event === metadata.event
      );
      if (existingIdx >= 0) {
        return prev.map((g, idx) => (idx === existingIdx ? { ...g, isFavorite: nextFav } : g));
      }
      if (nextFav) {
        const newLibItem: LibraryGameItem = {
          id: `fav-${Date.now()}`,
          redPlayer: metadata.redPlayer,
          blackPlayer: metadata.blackPlayer,
          event: metadata.event,
          date: metadata.date,
          result: metadata.result === '进行中' ? '红胜' : metadata.result,
          opening: metadata.opening,
          pliesCount: activeMovesList.length,
          accuracyRed: 93.5,
          accuracyBlack: 86.2,
          isFavorite: true,
          category: 'master',
          fen: piecesToFen(pieces, turn),
        };
        return [newLibItem, ...prev];
      }
      return prev;
    });
  }, [metadata, activeMovesList.length, pieces, turn]);

  // 连线模式下模拟同步外部棋盘的下一手
  const handleSyncNextExternalMove = useCallback(() => {
    const sim = generateSimulatedMultiPV(pieces, turn, engineDepth, 1);
    const nextMove = sim.lines[0]?.firstMove;
    if (nextMove) {
      executeMoveOnBoard(nextMove.from, nextMove.to);
    }
  }, [pieces, turn, engineDepth, executeMoveOnBoard]);

  const topCamp: Camp = flipped ? 'red' : 'black';
  const bottomCamp: Camp = flipped ? 'black' : 'red';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col xq-canvas select-none">
      {/* ==================== 1. 顶栏 Topbar (3-Zone Contract) ==================== */}
      <Titlebar
        workspace={workspace}
        appTheme={appTheme}
        soundEnabled={soundEnabled}
        isConnected={connectState.connected}
        onChangeWorkspace={handleSwitchWorkspace}
        onOpenModal={setActiveModal}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onToggleTheme={() => setAppTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      {/* ==================== 2. 主工作台：中央棋盘画布 + 右侧专业工作台 ==================== */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 左侧主画布区：统一舞台容器确保上席位条、评估条+棋盘、下步进控制条左右边缘严格对齐 */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto px-6 py-2 flex flex-col items-center justify-center relative">
          <div className="w-fit flex flex-col items-stretch gap-1.5">
            {/* 上方棋手信息栏 */}
            {workspace !== 'setup' && (
              <PlayerSeatBar
                camp={topCamp}
                playerName={
                  workspace === 'challenge'
                    ? currentChallenge.sourceBook
                    : workspace === 'play'
                    ? '电脑引擎'
                    : topCamp === 'black'
                    ? metadata.blackPlayer
                    : metadata.redPlayer
                }
                subtitle={
                  workspace === 'challenge'
                    ? currentChallenge.difficulty
                    : workspace === 'play'
                    ? handicap === 'even'
                      ? '分先'
                      : handicap === 'left-horse'
                      ? '让左马'
                      : handicap === 'two-horses'
                      ? '让双马'
                      : '让先'
                    : metadata.event
                }
                isTurn={turn === topCamp}
                isInCheck={inCheckCamp === topCamp}
                materialDiff={
                  topCamp === 'black'
                    ? -materialStats.netAdvantageRed
                    : materialStats.netAdvantageRed
                }
                onEditGameInfo={() => setActiveModal('game-info')}
              />
            )}

            {/* 棋盘与左侧评估条组合 */}
            <div className="flex items-stretch justify-center gap-2.5">
              {workspace !== 'setup' && (
                <div className="py-0.5 flex items-stretch">
                  <EvalBar
                    scoreCp={currentEvalScore}
                    secondaryScoreCp={secondaryMultiPvData.lines[0]?.scoreCp ?? null}
                    compareMode={compareMode && isAnalyzing && secondaryEngine.status === 'ready'}
                    flipped={flipped}
                    heightClass="h-full"
                  />
                </div>
              )}

              <Board
                pieces={pieces}
                selectedPieceId={selectedPieceId}
                legalMoves={legalMoves}
                lastMove={lastMove}
                multiPvArrows={boardArrows.primaryArrows}
                secondaryPvArrow={boardArrows.secondaryArrow}
                threatArrow={threatArrow}
                hoveredArrow={hoveredArrow}
                hintArrow={hintArrow}
                impactEffect={impactEffect}
                boardTheme={boardTheme}
                craftStyle={craftStyle}
                fontScheme={fontScheme}
                useTraditionalChar={useTraditionalChar}
                flipped={flipped}
                workspace={workspace}
                isVariationActive={!!variationMoves}
                onSelectIntersection={handleSelectIntersection}
                setupSelectedTemplate={setupSelectedTemplate}
                onSelectSetupTemplate={setSetupSelectedTemplate}
                setupTurn={setupTurn}
                onChangeSetupTurn={setSetupTurn}
                onClearSetupToKings={() => setPieces(createKingsOnlyPieces())}
                onResetSetupInitial={() => setPieces(createInitialPieces())}
                onFinishSetup={() => {
                  setTurn(setupTurn);
                  setWorkspace('study');
                  setIsAnalyzing(true);
                }}
              />
            </div>

            {/* 下方棋手信息栏 */}
            {workspace !== 'setup' && (
              <PlayerSeatBar
                camp={bottomCamp}
                playerName={
                  workspace === 'challenge'
                    ? '挑战者（红方）'
                    : workspace === 'play'
                    ? '玩家（红方）'
                    : bottomCamp === 'red'
                    ? metadata.redPlayer
                    : metadata.blackPlayer
                }
                subtitle={workspace === 'challenge' ? currentChallenge.title : undefined}
                isTurn={turn === bottomCamp}
                isInCheck={inCheckCamp === bottomCamp}
                materialDiff={
                  bottomCamp === 'red'
                    ? materialStats.netAdvantageRed
                    : -materialStats.netAdvantageRed
                }
                onEditGameInfo={() => setActiveModal('game-info')}
              />
            )}

            {/* 棋盘下方极简步进与操控栏 */}
            <BoardNav
              currentPly={currentPly}
              totalPlies={activeMovesList.length}
              isReplaying={isReplaying}
              disabled={workspace === 'setup'}
              onJumpPly={handleJumpPly}
              onToggleReplay={() => setIsReplaying((prev) => !prev)}
              onFlipBoard={() => setFlipped((prev) => !prev)}
              onUndoMove={() => handleJumpPly(Math.max(0, currentPly - 1))}
              onTriggerHint={handleTriggerHint}
            />
          </div>

          {/* 侧栏收起时的画布右缘展开把手 */}
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="展开右侧面板"
              className="absolute right-0 top-1/2 -translate-y-1/2 px-1.5 py-5 rounded-l-lg border border-r-0 xq-elevated hover:bg-[var(--xq-bg-hover)] shadow-lg flex flex-col items-center gap-1 cursor-pointer z-30"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--xq-accent-gold)]" />
              <span className="text-xs [writing-mode:vertical-rl] tracking-widest xq-text-secondary">
                展开面板
              </span>
            </button>
          )}
        </div>

        {/* ==================== 3. 右侧专业工作台 (加宽至 410px~450px 保证详细棋谱宽敞易读) ==================== */}
        {!sidebarCollapsed && (
          <aside className="w-[410px] xl:w-[450px] h-full border-l xq-surface flex flex-col shrink-0 relative">
            {/* 侧栏折叠按钮 */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="收起右侧栏（全屏专注盘面）"
              className="absolute -left-3 top-3 w-6 h-6 rounded-full border xq-elevated hover:bg-[var(--xq-bg-hover)] flex items-center justify-center shadow cursor-pointer z-20"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* 上半区：常驻多引擎分析与双擎对比舱 (EnginePanel) */}
            <EnginePanel
              engines={engines}
              primaryEngineId={primaryEngine.id}
              secondaryEngineId={secondaryEngine.id}
              compareMode={compareMode}
              isAnalyzing={isAnalyzing}
              threatRadarEnabled={threatRadarEnabled}
              primaryLines={multiPvData.lines}
              secondaryLines={secondaryMultiPvData.lines}
              onChangePrimaryEngine={handleChangePrimaryEngine}
              onChangeSecondaryEngine={setSecondaryEngineId}
              onToggleCompareMode={() => setCompareMode((prev) => !prev)}
              onInstallEngine={handleInstallEngine}
              onOpenEngineSettings={() => setActiveModal('settings')}
              onToggleAnalysis={() => setIsAnalyzing((prev) => !prev)}
              onToggleThreatRadar={() => setThreatRadarEnabled((prev) => !prev)}
              onSelectMultiPVMove={(from, to) => executeMoveOnBoard(from, to)}
              onHoverMultiPVMove={setHoveredArrow}
            />

            {/* 下半区：根据当前工作空间自适应呈现 */}
            {workspace === 'challenge' ? (
              /* 残局题库工作台 */
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
                <div className="flex items-center justify-between border-b xq-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                    <span className="font-semibold text-sm">经典残局题库</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectChallenge(currentChallenge.id)}
                    className="px-2.5 py-1 rounded-md xq-btn-secondary flex items-center gap-1 text-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>重摆</span>
                  </button>
                </div>

                {/* 关卡选择列表 */}
                <div className="space-y-2">
                  {CLASSICAL_CHALLENGES.map((ch) => {
                    const isSelected = ch.id === currentChallenge.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectChallenge(ch.id)}
                        className={`w-full p-3 rounded-lg text-left cursor-pointer space-y-1 ${
                          isSelected ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif-sc font-bold text-sm">{ch.title}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded border xq-border xq-text-secondary font-normal">
                            {ch.difficulty}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--xq-accent-gold)] font-medium">
                          {ch.objective}
                        </div>
                        <p className="text-xs xq-text-muted leading-relaxed font-normal">{ch.lore}</p>
                      </button>
                    );
                  })}
                </div>

                {/* 破局实时反馈与提示卡 */}
                {challengeStatusBanner && (
                  <div className="p-3 rounded-lg border border-[var(--xq-accent-gold)]/50 bg-[var(--xq-accent-gold)]/10 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--xq-accent-gold)]">
                      <Award className="w-4 h-4" />
                      <span>破局提示</span>
                    </div>
                    <p className="text-xs leading-relaxed">{challengeStatusBanner}</p>
                    <button
                      type="button"
                      onClick={handleTriggerHint}
                      className="px-3 py-1.5 rounded-md xq-btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>查看正着提示</span>
                    </button>
                  </div>
                )}
              </div>
            ) : workspace === 'play' ? (
              /* 人机对弈工作台 */
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
                <div className="flex items-center justify-between border-b xq-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                    <span className="font-semibold text-sm">人机对弈设置</span>
                  </div>
                  <span className="text-xs xq-text-muted">支持悔棋与支招</span>
                </div>

                {/* 让子设置 */}
                <div className="space-y-1.5">
                  <label className="block xq-text-secondary font-medium">
                    1. 开局让子（点击立即重开）
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'even', title: '分先', desc: '双方满子，红方先行' },
                        { id: 'move-first', title: '让先', desc: '双方满子，黑方先行' },
                        {
                          id: 'left-horse',
                          title: '让左马',
                          desc: '黑方撤去左马',
                        },
                        {
                          id: 'two-horses',
                          title: '让双马',
                          desc: '黑方撤去双马',
                        },
                      ] as const
                    ).map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleStartHandicapGame(h.id, skillTier)}
                        className={`p-2.5 rounded-lg text-left cursor-pointer ${
                          handicap === h.id ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        <div className="font-semibold">{h.title}</div>
                        <div className="text-xs xq-text-muted mt-0.5 font-normal">{h.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 棋力档位选择 */}
                <div className="space-y-1.5">
                  <label className="block xq-text-secondary font-medium">2. 电脑棋力难度</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'scholar', label: '初级' },
                        { id: 'strategist', label: '中级' },
                        { id: 'grandmaster', label: '高级' },
                        { id: 'deity', label: '大师' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSkillTier(t.id)}
                        className={`py-2 rounded-md text-center cursor-pointer ${
                          skillTier === t.id ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 当前人机实战着法记录 */}
                <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
                  <div className="flex items-center justify-between text-xs xq-text-secondary">
                    <span>已走手数：{mainMoves.length} 手</span>
                    {isBotThinking && (
                      <span className="text-[var(--xq-accent-gold)] font-medium">
                        电脑思考中…
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {mainMoves.length === 0 ? (
                      <span className="text-xs xq-text-muted">
                        请在左侧棋盘点击红方棋子走棋
                      </span>
                    ) : (
                      mainMoves.map((m) => (
                        <span
                          key={m.ply}
                          className="px-2 py-0.5 rounded border xq-border font-serif-sc text-xs"
                        >
                          {m.ply}.{m.notation}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* 默认「复盘分析」双页签：回合棋谱 ↔ 复盘报告 */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 双页签切换栏 */}
                <div className="px-4 pt-2.5 border-b xq-border flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-5 text-[13px] font-medium">
                    <button
                      type="button"
                      onClick={() => setRightTab('moves')}
                      className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        rightTab === 'moves'
                          ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>回合棋谱</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRightTab('review')}
                      className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        rightTab === 'review'
                          ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>复盘报告</span>
                    </button>
                  </div>
                </div>

                {rightTab === 'moves' ? (
                  <MoveList
                    mainMoves={mainMoves}
                    variationMoves={variationMoves}
                    branchOriginPly={branchOriginPly}
                    currentPly={currentPly}
                    metadata={metadata}
                    connectState={connectState}
                    onSelectPly={(ply, useVar) => handleJumpPly(ply, useVar)}
                    onPromoteVariationToMain={() => {
                      if (variationMoves) {
                        setMainMoves(variationMoves);
                        setVariationMoves(null);
                        setBranchOriginPly(null);
                      }
                    }}
                    onDiscardVariation={() => {
                      const backPly = branchOriginPly ?? 0;
                      setVariationMoves(null);
                      setBranchOriginPly(null);
                      handleJumpPly(backPly, false);
                    }}
                    onOpenGameInfo={() => setActiveModal('game-info')}
                    onToggleFavorite={handleToggleCurrentFavorite}
                    onSyncNextExternalMove={handleSyncNextExternalMove}
                    onDisconnectExternal={() =>
                      setConnectState((prev) => ({ ...prev, connected: false }))
                    }
                  />
                ) : (
                  <GameReviewPanel
                    moves={mainMoves}
                    currentPly={currentPly}
                    retryMistakePly={retryMistakePly}
                    retryFeedback={retryFeedback}
                    onJumpPly={(ply) => handleJumpPly(ply, false)}
                    onStartRetryMistake={(mistakeMove) => {
                      const prevPly = Math.max(0, mistakeMove.ply - 1);
                      setVariationMoves(null);
                      setBranchOriginPly(null);
                      handleJumpPly(prevPly, false);
                      setRetryMistakePly(mistakeMove.ply);
                      if (
                        mistakeMove.bestFrom &&
                        mistakeMove.bestTo &&
                        mistakeMove.bestAlternative
                      ) {
                        setRetryTargetMove({
                          from: mistakeMove.bestFrom,
                          to: mistakeMove.bestTo,
                          notation: mistakeMove.bestAlternative,
                        });
                        setRetryFeedback(
                          `已回到第 ${mistakeMove.ply} 手失误前！请在左侧棋盘尝试走出正着（提示：${mistakeMove.bestAlternative}）`
                        );
                      }
                    }}
                    onPlayBestAlternative={(from, to) => executeMoveOnBoard(from, to)}
                  />
                )}
              </div>
            )}
          </aside>
        )}
      </main>

      {/* ==================== 4. 底栏 Status ==================== */}
      <StatusBar
        workspace={workspace}
        isAnalyzing={primaryEngine.status === 'ready' && isAnalyzing}
        compareMode={compareMode && secondaryEngine.status === 'ready'}
        primaryEngineName={primaryEngine.shortName}
        secondaryEngineName={secondaryEngine.shortName}
        engineThreads={engineThreads}
        engineHashMb={engineHashMb}
        turn={turn}
        currentPly={currentPly}
        totalPlies={activeMovesList.length}
        inCheckCamp={inCheckCamp}
        isVariationActive={!!variationMoves}
        advantageSummary={materialStats.advantageSummary}
      />

      {/* ==================== 5. 全局对话框套件 ==================== */}
      <DialogsModalSuite
        activeModal={activeModal}
        appTheme={appTheme}
        fontScale={fontScale}
        soundEnabled={soundEnabled}
        boardTheme={boardTheme}
        craftStyle={craftStyle}
        useTraditionalChar={useTraditionalChar}
        multiPvCount={multiPvCount}
        engineDepth={engineDepth}
        engineThreads={engineThreads}
        engineHashMb={engineHashMb}
        engines={engines}
        primaryEngineId={primaryEngine.id}
        secondaryEngineId={secondaryEngine.id}
        compareMode={compareMode}
        connectState={connectState}
        currentFen={piecesToFen(pieces, turn)}
        currentPgn={formatGameToPgn(metadata, activeMovesList, piecesToFen(pieces, turn))}
        metadata={metadata}
        libraryGames={libraryGames}
        onClose={() => setActiveModal(null)}
        onSwitchWorkspace={handleSwitchWorkspace}
        onApplyFen={(fenStr) => {
          const parsed = parseFenToPieces(fenStr);
          if (!parsed) return false;
          setPieces(parsed.pieces);
          setTurn(parsed.turn);
          setCurrentPly(0);
          setMainMoves([]);
          setVariationMoves(null);
          setBranchOriginPly(null);
          return true;
        }}
        onSaveMetadata={setMetadata}
        onLoadLibraryGame={(game) => {
          setMetadata((prev) => ({
            ...prev,
            redPlayer: game.redPlayer,
            blackPlayer: game.blackPlayer,
            event: game.event,
            date: game.date,
            result: game.result,
            opening: game.opening,
            isFavorite: game.isFavorite,
          }));
          setWorkspace('study');
          setVariationMoves(null);
          setBranchOriginPly(null);
          if (game.fen) {
            const parsed = parseFenToPieces(game.fen);
            if (parsed) {
              setPieces(parsed.pieces);
              setTurn(parsed.turn);
              setCurrentPly(0);
              setMainMoves([]);
              return;
            }
          }
          setPieces(sampleSession.moves[11]?.piecesSnapshot || createInitialPieces());
          setMainMoves(sampleSession.moves);
          setCurrentPly(12);
        }}
        onToggleLibraryFavorite={(id) =>
          setLibraryGames((prev) =>
            prev.map((g) => (g.id === id ? { ...g, isFavorite: !g.isFavorite } : g))
          )
        }
        onDeleteLibraryGame={(id) =>
          setLibraryGames((prev) => prev.filter((g) => g.id !== id))
        }
        onChangeAppTheme={setAppTheme}
        onChangeFontScale={setFontScale}
        onChangeSoundEnabled={setSoundEnabled}
        onChangeBoardTheme={setBoardTheme}
        onChangeCraftStyle={setCraftStyle}
        onChangeUseTraditionalChar={setUseTraditionalChar}
        onChangeMultiPvCount={setMultiPvCount}
        onChangeEngineDepth={setEngineDepth}
        onChangeEngineThreads={setEngineThreads}
        onChangeEngineHashMb={setEngineHashMb}
        onChangePrimaryEngine={handleChangePrimaryEngine}
        onChangeSecondaryEngine={setSecondaryEngineId}
        onToggleCompareMode={() => setCompareMode((prev) => !prev)}
        onInstallEngine={handleInstallEngine}
        onResetEngineMissing={handleResetEngineMissing}
        onAddCustomEngine={handleAddCustomEngine}
        onUpdateConnectState={(next) => {
          setConnectState(next);
          if (next.connected && next.autoAnalyze) {
            setIsAnalyzing(true);
          }
        }}
        onTriggerHint={handleTriggerHint}
      />
    </div>
  );
}
