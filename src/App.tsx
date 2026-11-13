/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightCircle,
  Award,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Swords,
} from 'lucide-react';
import { Board } from './components/Board';
import { BoardNav } from './components/BoardNav';
import { ChallengeWorkbench } from './components/ChallengeWorkbench';
import { DialogsModalSuite } from './components/DialogsModalSuite';
import { EnginePanel } from './components/EnginePanel';
import { EvalBar } from './components/EvalBar';
import { GameReviewPanel } from './components/GameReviewPanel';
import { MoveList } from './components/MoveList';
import { OpeningBookPanel } from './components/OpeningBookPanel';
import { PlayerSeatBar } from './components/PlayerSeatBar';
import { SetupWorkbench } from './components/SetupWorkbench';
import { StatusBar } from './components/StatusBar';
import { Titlebar } from './components/Titlebar';
import { CLASSICAL_CHALLENGES, INITIAL_LIBRARY_GAMES } from './data/catalogRegistry';
import { lookupOpeningBookNode } from './data/openingBook';
import {
  ActiveModalId,
  AppTheme,
  BoardTheme,
  Camp,
  CompactLibraryMove,
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
  MoveQuality,
  MoveRecord,
  MultiPVArrow,
  OpeningPresetLine,
  Piece,
  PieceCraftStyle,
  PieceType,
  Position,
  WorkspaceMode,
} from './types/xiangqi';
import {
  buildBoardGrid,
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
  getPieceAtGrid,
  INITIAL_FEN,
  isCampInCheck,
  parseFenToPieces,
  piecesToFen,
  playWoodClackSound,
  replayCompactMoves,
} from './utils/xiangqiRules';

const STUDY_SESSION_STORAGE_KEY = 'xiangqix_study_session_v1';
const PREFS_STORAGE_KEY = 'xiangqix_prefs_v1';
const LIBRARY_STORAGE_KEY = 'xiangqix_library_v1';
const SOLVED_CHALLENGES_STORAGE_KEY = 'xiangqix_challenges_solved_v1';

const DEFAULT_STUDY_METADATA: GameMetadata = {
  redPlayer: '红方（先手）',
  blackPlayer: '黑方（后手）',
  event: '自由拆棋 · 复盘分析',
  date: '2026-11-12',
  result: '进行中',
  site: '象棋X 分析工作台',
  opening: '标准开局（待定式）',
  isFavorite: false,
};

const SAMPLE_MASTER_METADATA: GameMetadata = {
  redPlayer: '王天一',
  blackPlayer: '郑惟桐',
  event: '全国象棋个人锦标赛冠亚军决战',
  date: '2026-11-11',
  result: '红胜',
  site: '杭州棋院',
  opening: '中炮过河车对屏风马',
  isFavorite: true,
};

interface StoredStudySession {
  pieces: Piece[];
  basePieces?: Piece[];
  baseTurn?: Camp;
  mainMoves: MoveRecord[];
  variationMoves: MoveRecord[] | null;
  branchOriginPly: number | null;
  currentPly: number;
  turn: Camp;
  metadata: GameMetadata;
  flipped?: boolean;
}

interface StoredPrefs {
  appTheme?: AppTheme;
  fontScale?: FontScale;
  soundEnabled?: boolean;
  boardTheme?: BoardTheme;
  craftStyle?: PieceCraftStyle;
  useTraditionalChar?: boolean;
  primaryEngineId?: string;
  secondaryEngineId?: string;
  compareMode?: boolean;
  multiPvCount?: 1 | 2 | 3;
  engineDepth?: 18 | 24 | 30;
  engineThreads?: 4 | 8 | 16;
  engineHashMb?: 256 | 512 | 1024;
}

function readStoredStudySession(): StoredStudySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STUDY_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredStudySession>;
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length === 0) return null;
    if (!Array.isArray(parsed.mainMoves)) return null;
    return {
      pieces: parsed.pieces,
      basePieces: Array.isArray(parsed.basePieces) && parsed.basePieces.length > 0 ? parsed.basePieces : undefined,
      baseTurn: parsed.baseTurn === 'black' ? 'black' : 'red',
      mainMoves: parsed.mainMoves,
      variationMoves: Array.isArray(parsed.variationMoves) ? parsed.variationMoves : null,
      branchOriginPly: typeof parsed.branchOriginPly === 'number' ? parsed.branchOriginPly : null,
      currentPly: typeof parsed.currentPly === 'number' ? parsed.currentPly : 0,
      turn: parsed.turn === 'black' ? 'black' : 'red',
      metadata: parsed.metadata?.redPlayer ? parsed.metadata : DEFAULT_STUDY_METADATA,
      flipped: !!parsed.flipped,
    };
  } catch {
    return null;
  }
}

function readStoredPrefs(): StoredPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPrefs) : {};
  } catch {
    return {};
  }
}

function readStoredLibraryGames(): LibraryGameItem[] {
  if (typeof window === 'undefined') return INITIAL_LIBRARY_GAMES;
  try {
    const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return INITIAL_LIBRARY_GAMES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as LibraryGameItem[]) : INITIAL_LIBRARY_GAMES;
  } catch {
    return INITIAL_LIBRARY_GAMES;
  }
}

function readStoredSolvedChallenges(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SOLVED_CHALLENGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export default function App() {
  const initialPrefs = useMemo(() => readStoredPrefs(), []);
  const initialStudy = useMemo(() => readStoredStudySession(), []);

  // ==================== 1. 全局外观与主题状态 ====================
  const [appTheme, setAppTheme] = useState<AppTheme>(initialPrefs.appTheme || 'dark');
  const [fontScale, setFontScale] = useState<FontScale>(initialPrefs.fontScale || 'standard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    initialPrefs.soundEnabled ?? true
  );
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(
    initialPrefs.boardTheme || 'xuan-rosewood'
  );
  const [craftStyle, setCraftStyle] = useState<PieceCraftStyle>(
    initialPrefs.craftStyle || 'boxwood-ebony'
  );
  const [fontScheme] = useState<FontScheme>('kaiti-serif');
  const [useTraditionalChar, setUseTraditionalChar] = useState<boolean>(
    initialPrefs.useTraditionalChar ?? false
  );

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
  const sampleSessionRef = useRef<ReturnType<typeof createSampleSessionMoves> | null>(null);
  const getSampleSession = useCallback(() => {
    if (!sampleSessionRef.current) {
      sampleSessionRef.current = createSampleSessionMoves();
    }
    return sampleSessionRef.current;
  }, []);
  const [workspace, setWorkspace] = useState<WorkspaceMode>('study');
  const [rightTab, setRightTab] = useState<'moves' | 'review' | 'opening'>('moves');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [studyBasePieces, setStudyBasePieces] = useState<Piece[]>(
    () => initialStudy?.basePieces || createInitialPieces('even')
  );
  const [studyBaseTurn, setStudyBaseTurn] = useState<Camp>(
    () => initialStudy?.baseTurn || 'red'
  );
  const [mainMoves, setMainMoves] = useState<MoveRecord[]>(
    () => initialStudy?.mainMoves || []
  );
  const [variationMoves, setVariationMoves] = useState<MoveRecord[] | null>(
    () => initialStudy?.variationMoves || null
  );
  const [branchOriginPly, setBranchOriginPly] = useState<number | null>(
    () => initialStudy?.branchOriginPly ?? null
  );
  const [currentPly, setCurrentPly] = useState<number>(
    () => initialStudy?.currentPly ?? 0
  );
  const [pieces, setPieces] = useState<Piece[]>(
    () => initialStudy?.pieces || createInitialPieces('even')
  );
  const [turn, setTurn] = useState<Camp>(() => initialStudy?.turn || 'red');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [impactEffect, setImpactEffect] = useState<ImpactEffect | null>(null);
  const [flipped, setFlipped] = useState<boolean>(() => initialStudy?.flipped ?? false);

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
  const [primaryEngineId, setPrimaryEngineId] = useState<string>(
    initialPrefs.primaryEngineId || 'pikafish'
  );
  const [secondaryEngineId, setSecondaryEngineId] = useState<string>(
    initialPrefs.secondaryEngineId || 'cyclone'
  );
  const [compareMode, setCompareMode] = useState<boolean>(
    initialPrefs.compareMode ?? false
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [multiPvCount, setMultiPvCount] = useState<1 | 2 | 3>(
    initialPrefs.multiPvCount || 3
  );
  const [engineDepth, setEngineDepth] = useState<18 | 24 | 30>(
    initialPrefs.engineDepth || 24
  );
  const [engineThreads, setEngineThreads] = useState<4 | 8 | 16>(
    initialPrefs.engineThreads || 8
  );
  const [engineHashMb, setEngineHashMb] = useState<256 | 512 | 1024>(
    initialPrefs.engineHashMb || 512
  );
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
      if (nextPrimaryId === secondaryEngineId) {
        setSecondaryEngineId(primaryEngineId);
      }
      setPrimaryEngineId(nextPrimaryId);
    },
    [primaryEngineId, secondaryEngineId]
  );

  const handleChangeSecondaryEngine = useCallback(
    (nextSecondaryId: string) => {
      if (nextSecondaryId === primaryEngineId) {
        setPrimaryEngineId(secondaryEngineId);
      }
      setSecondaryEngineId(nextSecondaryId);
    },
    [primaryEngineId, secondaryEngineId]
  );

  const handleSwapEngines = useCallback(() => {
    setPrimaryEngineId(secondaryEngineId);
    setSecondaryEngineId(primaryEngineId);
  }, [primaryEngineId, secondaryEngineId]);

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
  const [solvedChallengeIds, setSolvedChallengeIds] = useState<string[]>(() =>
    readStoredSolvedChallenges()
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
  const [metadata, setMetadata] = useState<GameMetadata>(
    () => initialStudy?.metadata || DEFAULT_STUDY_METADATA
  );
  const [libraryGames, setLibraryGames] = useState<LibraryGameItem[]>(() =>
    readStoredLibraryGames()
  );
  const [activeModal, setActiveModal] = useState<ActiveModalId>(null);

  // 自动防抖持久化「复盘分析」当前会话，并在页面隐藏/卸载前立即落盘
  const latestStudyPayloadRef = useRef<StoredStudySession | null>(null);
  const studyPersistTimerRef = useRef<number | null>(null);

  const flushStudyPersistence = useCallback(() => {
    if (studyPersistTimerRef.current !== null) {
      window.clearTimeout(studyPersistTimerRef.current);
      studyPersistTimerRef.current = null;
    }
    if (!latestStudyPayloadRef.current) return;
    try {
      window.localStorage.setItem(
        STUDY_SESSION_STORAGE_KEY,
        JSON.stringify(latestStudyPayloadRef.current)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  useEffect(() => {
    if (workspace !== 'study') return;
    latestStudyPayloadRef.current = {
      pieces,
      basePieces: studyBasePieces,
      baseTurn: studyBaseTurn,
      mainMoves,
      variationMoves,
      branchOriginPly,
      currentPly,
      turn,
      metadata,
      flipped,
    };
    if (studyPersistTimerRef.current !== null) {
      window.clearTimeout(studyPersistTimerRef.current);
    }
    studyPersistTimerRef.current = window.setTimeout(() => {
      studyPersistTimerRef.current = null;
      if (!latestStudyPayloadRef.current) return;
      try {
        window.localStorage.setItem(
          STUDY_SESSION_STORAGE_KEY,
          JSON.stringify(latestStudyPayloadRef.current)
        );
      } catch {
        // Ignore storage quota errors
      }
    }, 350);
  }, [
    workspace,
    pieces,
    studyBasePieces,
    studyBaseTurn,
    mainMoves,
    variationMoves,
    branchOriginPly,
    currentPly,
    turn,
    metadata,
    flipped,
  ]);

  useEffect(() => {
    window.addEventListener('pagehide', flushStudyPersistence);
    window.addEventListener('beforeunload', flushStudyPersistence);
    return () => {
      window.removeEventListener('pagehide', flushStudyPersistence);
      window.removeEventListener('beforeunload', flushStudyPersistence);
      flushStudyPersistence();
    };
  }, [flushStudyPersistence]);

  useEffect(() => {
    try {
      const prefs: StoredPrefs = {
        appTheme,
        fontScale,
        soundEnabled,
        boardTheme,
        craftStyle,
        useTraditionalChar,
        primaryEngineId,
        secondaryEngineId,
        compareMode,
        multiPvCount,
        engineDepth,
        engineThreads,
        engineHashMb,
      };
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    appTheme,
    fontScale,
    soundEnabled,
    boardTheme,
    craftStyle,
    useTraditionalChar,
    primaryEngineId,
    secondaryEngineId,
    compareMode,
    multiPvCount,
    engineDepth,
    engineThreads,
    engineHashMb,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraryGames));
      } catch {
        // Ignore storage quota errors
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [libraryGames]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SOLVED_CHALLENGES_STORAGE_KEY,
        JSON.stringify(solvedChallengeIds)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [solvedChallengeIds]);

  // ==================== 3. 派生计算：O(1) 棋盘索引、防抖异步引擎分析与单次将军校验 ====================
  const activeMovesList = variationMoves || mainMoves;
  const lastMove = useMemo(() => {
    if (currentPly <= 0) return null;
    return activeMovesList[currentPly - 1] || null;
  }, [activeMovesList, currentPly]);

  const boardGrid = useMemo(() => buildBoardGrid(pieces), [pieces]);

  const selectedPiece = useMemo(
    () => (selectedPieceId ? pieces.find((p) => p.id === selectedPieceId) || null : null),
    [pieces, selectedPieceId]
  );

  const legalMoves = useMemo(() => {
    if (!selectedPiece || workspace === 'setup' || isBotThinking) return [];
    return getLegalMovesForPiece(selectedPiece, pieces, boardGrid);
  }, [selectedPiece, pieces, boardGrid, workspace, isBotThinking]);

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

  // 快速跳步或自动播放期间对引擎分析防抖（120ms）并交由低优先级过渡队列，确保棋盘响应 60fps
  const [debouncedAnalysisTarget, setDebouncedAnalysisTarget] = useState<{
    pieces: Piece[];
    turn: Camp;
  }>(() => ({ pieces, turn }));

  useEffect(() => {
    if (workspace !== 'study' || !isAnalyzing) return;
    if (debouncedAnalysisTarget.pieces === pieces && debouncedAnalysisTarget.turn === turn) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedAnalysisTarget({ pieces, turn });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [workspace, isAnalyzing, pieces, turn, debouncedAnalysisTarget]);

  const deferredAnalysisTarget = useDeferredValue(debouncedAnalysisTarget);
  const analysisMatchesCurrent =
    deferredAnalysisTarget.pieces === pieces && deferredAnalysisTarget.turn === turn;

  const multiPvData = useMemo(() => {
    if (primaryEngine.status !== 'ready' || !isAnalyzing || workspace !== 'study') {
      return { lines: [], arrows: [] };
    }
    return generateSimulatedMultiPV(
      deferredAnalysisTarget.pieces,
      deferredAnalysisTarget.turn,
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
    deferredAnalysisTarget,
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
      workspace !== 'study'
    ) {
      return { lines: [], arrows: [] };
    }
    return generateSimulatedMultiPV(
      deferredAnalysisTarget.pieces,
      deferredAnalysisTarget.turn,
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
    deferredAnalysisTarget,
    engineDepth,
    engineThreads,
    engineHashMb,
  ]);

  // 棋盘箭头合成：仅当引擎分析结果与当前盘面一致时才在棋盘绘制推荐箭头，避免快速跳步时闪现旧手箭头
  const boardArrows = useMemo(() => {
    if (!analysisMatchesCurrent) {
      return {
        primaryArrows: [] as MultiPVArrow[],
        secondaryArrow: null as MultiPVArrow | null,
      };
    }
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
    analysisMatchesCurrent,
    compareMode,
    multiPvData,
    secondaryMultiPvData,
    primaryEngine.shortName,
    secondaryEngine.shortName,
  ]);

  const threatArrow = useMemo(() => {
    if (
      primaryEngine.status !== 'ready' ||
      !threatRadarEnabled ||
      workspace !== 'study' ||
      !analysisMatchesCurrent
    ) {
      return null;
    }
    return generateOpponentThreatArrow(
      deferredAnalysisTarget.pieces,
      deferredAnalysisTarget.turn
    );
  }, [
    primaryEngine.status,
    threatRadarEnabled,
    workspace,
    analysisMatchesCurrent,
    deferredAnalysisTarget,
  ]);

  const currentEvalScore = useMemo(() => {
    if (analysisMatchesCurrent && multiPvData.lines[0]) return multiPvData.lines[0].scoreCp;
    if (lastMove) return lastMove.evalScore;
    return evaluateBoardScore(pieces);
  }, [analysisMatchesCurrent, multiPvData, lastMove, pieces]);

  const materialStats = useMemo(() => calculateMaterialAndCaptures(pieces), [pieces]);

  const checkPositions = useMemo(() => {
    const redPos = isCampInCheck(pieces, 'red', boardGrid);
    const blackPos = isCampInCheck(pieces, 'black', boardGrid);
    return {
      redCheckPos: redPos,
      blackCheckPos: blackPos,
      inCheckCamp: (redPos ? 'red' : blackPos ? 'black' : null) as Camp | null,
    };
  }, [pieces, boardGrid]);

  const currentChallenge = useMemo(
    () =>
      CLASSICAL_CHALLENGES.find((c) => c.id === selectedChallengeId) ||
      CLASSICAL_CHALLENGES[0],
    [selectedChallengeId]
  );

  // 开局库盘面指纹 O(1) 实时匹配与回溯最近定式节点
  const matchedOpeningNode = useMemo(
    () => (workspace === 'study' ? lookupOpeningBookNode(pieces, turn) : null),
    [workspace, pieces, turn]
  );

  const lastMatchedOpeningInfo = useMemo(() => {
    if (workspace !== 'study' || matchedOpeningNode || currentPly <= 0) return null;
    for (let ply = currentPly - 1; ply >= 0; ply--) {
      const snapPieces =
        ply === 0 ? studyBasePieces : activeMovesList[ply - 1]?.piecesSnapshot;
      if (!snapPieces) continue;
      const snapTurn: Camp =
        ply === 0
          ? studyBaseTurn
          : activeMovesList[ply - 1].piece.camp === 'red'
          ? 'black'
          : 'red';
      const node = lookupOpeningBookNode(snapPieces, snapTurn);
      if (node) {
        return {
          ply,
          openingName: node.openingName,
          category: node.category,
        };
      }
    }
    return null;
  }, [workspace, matchedOpeningNode, currentPly, studyBasePieces, studyBaseTurn, activeMovesList]);

  // ==================== 4. 切换工作空间、新局重置与载入古谱/示范名局 ====================
  const handleNewStudyGame = useCallback(() => {
    const freshPieces = createInitialPieces('even');
    setWorkspace('study');
    setIsReplaying(false);
    setSelectedPieceId(null);
    setHintArrow(null);
    setHoveredArrow(null);
    setRetryMistakePly(null);
    setRetryFeedback(null);
    setStudyBasePieces(freshPieces);
    setStudyBaseTurn('red');
    setPieces(freshPieces);
    setMainMoves([]);
    setVariationMoves(null);
    setBranchOriginPly(null);
    setCurrentPly(0);
    setTurn('red');
    setMetadata(DEFAULT_STUDY_METADATA);
    setIsAnalyzing(true);
  }, []);

  const handleLoadSampleMasterGame = useCallback(() => {
    const sampleSession = getSampleSession();
    setWorkspace('study');
    setIsReplaying(false);
    setSelectedPieceId(null);
    setHintArrow(null);
    setHoveredArrow(null);
    setRetryMistakePly(null);
    setRetryFeedback(null);
    setStudyBasePieces(sampleSession.initialPieces);
    setStudyBaseTurn('red');
    setPieces(sampleSession.moves[11]?.piecesSnapshot || sampleSession.initialPieces);
    setMainMoves(sampleSession.moves);
    setVariationMoves(null);
    setBranchOriginPly(null);
    setCurrentPly(12);
    setTurn('red');
    setMetadata(SAMPLE_MASTER_METADATA);
    setIsAnalyzing(true);
  }, [getSampleSession]);

  const handleTransferToStudy = useCallback(
    (payload: {
      basePieces: Piece[];
      baseTurn: Camp;
      currentPieces: Piece[];
      currentTurn: Camp;
      moves: MoveRecord[];
      ply: number;
      nextMetadata: Partial<GameMetadata>;
      targetRightTab?: 'moves' | 'review' | 'opening';
    }) => {
      setWorkspace('study');
      setRightTab(payload.targetRightTab || 'moves');
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setRetryMistakePly(null);
      setRetryFeedback(null);
      setStudyBasePieces(payload.basePieces.map((p) => ({ ...p })));
      setStudyBaseTurn(payload.baseTurn);
      setPieces(payload.currentPieces.map((p) => ({ ...p })));
      setTurn(payload.currentTurn);
      setMainMoves(
        payload.moves.map((m) => ({
          ...m,
          piecesSnapshot: m.piecesSnapshot.map((p) => ({ ...p })),
        }))
      );
      setVariationMoves(null);
      setBranchOriginPly(null);
      setCurrentPly(payload.ply);
      setMetadata((prev) => ({
        ...prev,
        ...payload.nextMetadata,
      }));
      setIsAnalyzing(true);
    },
    []
  );

  const handleSwitchWorkspace = useCallback(
    (nextWs: WorkspaceMode) => {
      if (workspace === 'study' && nextWs !== 'study') {
        flushStudyPersistence();
      }
      setWorkspace(nextWs);
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setRetryMistakePly(null);
      setRetryFeedback(null);

      if (nextWs === 'study') {
        const stored = readStoredStudySession();
        if (stored) {
          setStudyBasePieces(stored.basePieces || createInitialPieces('even'));
          setStudyBaseTurn(stored.baseTurn || 'red');
          setPieces(stored.pieces);
          setMainMoves(stored.mainMoves);
          setVariationMoves(stored.variationMoves);
          setBranchOriginPly(stored.branchOriginPly);
          setCurrentPly(stored.currentPly);
          setTurn(stored.turn);
          setMetadata(stored.metadata);
        } else {
          const freshPieces = createInitialPieces('even');
          setStudyBasePieces(freshPieces);
          setStudyBaseTurn('red');
          setPieces(freshPieces);
          setMainMoves([]);
          setVariationMoves(null);
          setBranchOriginPly(null);
          setCurrentPly(0);
          setTurn('red');
          setMetadata(DEFAULT_STUDY_METADATA);
        }
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
        setTurn(handicap === 'move-first' ? 'black' : 'red');
        setIsAnalyzing(false);
      } else if (nextWs === 'setup') {
        setSetupTurn(turn);
        setSidebarCollapsed(false);
        setIsAnalyzing(false);
      }
    },
    [workspace, flushStudyPersistence, handicap, turn]
  );

  const handleSelectChallenge = useCallback((chId: string) => {
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
  }, []);

  const handleStartHandicapGame = useCallback(
    (newHandicap: HandicapType, newTier: EngineSkillTier) => {
      setHandicap(newHandicap);
      setSkillTier(newTier);
      const initP = createInitialPieces(newHandicap);
      setPieces(initP);
      setMainMoves([]);
      setVariationMoves(null);
      setCurrentPly(0);
      setTurn(newHandicap === 'move-first' ? 'black' : 'red');
      setHintArrow(null);
    },
    []
  );

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
            : workspace === 'play'
            ? createInitialPieces(handicap)
            : studyBasePieces.map((p) => ({ ...p }));
        setPieces(baseInit);
        setTurn(
          workspace === 'challenge'
            ? currentChallenge.initialTurn
            : workspace === 'play'
            ? handicap === 'move-first'
              ? 'black'
              : 'red'
            : studyBaseTurn
        );
      } else {
        const rec = list[clamped - 1];
        if (rec) {
          setPieces(rec.piecesSnapshot.map((p) => ({ ...p })));
          setTurn(rec.piece.camp === 'red' ? 'black' : 'red');
        }
      }
    },
    [variationMoves, mainMoves, workspace, currentChallenge, handicap, studyBasePieces, studyBaseTurn]
  );

  const executeMoveOnBoard = useCallback(
    (from: Position, to: Position) => {
      const moving = getPieceAtGrid(boardGrid, from.row, from.col);
      if (!moving) return;
      const captured = getPieceAtGrid(boardGrid, to.row, to.col);
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
            setSolvedChallengeIds((prev) =>
              prev.includes(currentChallenge.id) ? prev : [...prev, currentChallenge.id]
            );
            setChallengeStatusBanner(`好棋！走出《${currentChallenge.sourceBook}》正着「${notation}」，已记录破关！`);
          } else {
            setChallengeStatusBanner(`已走出「${notation}」，黑方应对中（可点「支招」查看正着）`);
          }
        } else if (workspace === 'challenge' && nextPly >= 3 && nextEval >= 5.0) {
          setSolvedChallengeIds((prev) =>
            prev.includes(currentChallenge.id) ? prev : [...prev, currentChallenge.id]
          );
          setChallengeStatusBanner(`红方已取得胜势（${nextEval >= 0 ? '+' : ''}${nextEval.toFixed(2)}），自动标记为已破关！`);
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
      boardGrid,
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

  const handleSelectIntersection = useCallback(
    (row: number, col: number) => {
      if (isBotThinking) return;

      if (workspace === 'setup') {
        const existing = getPieceAtGrid(boardGrid, row, col);
        if (existing) {
          if (existing.type === 'general') return;
          setPieces((prev) => prev.filter((p) => p.id !== existing.id));
        } else if (setupSelectedTemplate) {
          const maxCountByType: Record<PieceType, number> = {
            chariot: 2,
            horse: 2,
            cannon: 2,
            advisor: 2,
            elephant: 2,
            soldier: 5,
            general: 1,
          };
          const currentCount = pieces.filter(
            (p) =>
              p.camp === setupSelectedTemplate.camp &&
              p.type === setupSelectedTemplate.type
          ).length;
          if (currentCount >= maxCountByType[setupSelectedTemplate.type]) {
            return;
          }
          const newPiece: Piece = {
            id: `setup-${setupSelectedTemplate.camp}-${setupSelectedTemplate.type}-${Date.now()}`,
            camp: setupSelectedTemplate.camp,
            type: setupSelectedTemplate.type,
            row,
            col,
          };
          playWoodClackSound(false, row, col, soundEnabled);
          setPieces((prev) => [...prev, newPiece]);
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

      const clickedPiece = getPieceAtGrid(boardGrid, row, col);
      if (clickedPiece && clickedPiece.camp === turn) {
        setSelectedPieceId(clickedPiece.id === selectedPieceId ? null : clickedPiece.id);
      } else {
        setSelectedPieceId(null);
      }
    },
    [
      isBotThinking,
      workspace,
      boardGrid,
      setupSelectedTemplate,
      pieces,
      soundEnabled,
      selectedPiece,
      legalMoves,
      executeMoveOnBoard,
      turn,
      selectedPieceId,
    ]
  );

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
    const list = variationMoves || mainMoves;
    if (currentPly >= list.length) {
      setIsReplaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const nextPly = currentPly + 1;
      const rec = list[nextPly - 1];
      if (rec) {
        playWoodClackSound(!!rec.captured, rec.to.row, rec.to.col, soundEnabled);
      }
      handleJumpPly(nextPly, !!variationMoves);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [isReplaying, currentPly, variationMoves, mainMoves, soundEnabled, handleJumpPly]);

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
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'c' && workspace === 'study') {
        e.preventDefault();
        setCompareMode((prev) => !prev);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (e.key === ' ' && workspace === 'study') {
        e.preventDefault();
        const best = analysisMatchesCurrent
          ? multiPvData.lines[0]?.firstMove
          : generateSimulatedMultiPV(
              pieces,
              turn,
              engineDepth,
              1,
              primaryEngine.styleBias,
              engineThreads,
              engineHashMb
            ).lines[0]?.firstMove;
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
    analysisMatchesCurrent,
    multiPvData,
    pieces,
    turn,
    engineDepth,
    primaryEngine.styleBias,
    engineThreads,
    engineHashMb,
    executeMoveOnBoard,
  ]);

  // 收藏当前棋局并与棋谱库「我的收藏」实时联动
  const handleToggleCurrentFavorite = useCallback(() => {
    const nextFav = !metadata.isFavorite;
    setMetadata((prev) => ({ ...prev, isFavorite: nextFav }));
    setLibraryGames((prev) => {
      const existingIdx = prev.findIndex(
        (g) =>
          g.redPlayer === metadata.redPlayer &&
          g.blackPlayer === metadata.blackPlayer &&
          g.event === metadata.event
      );
      if (existingIdx >= 0) {
        return prev.map((g, idx) => (idx === existingIdx ? { ...g, isFavorite: nextFav } : g));
      }
      if (nextFav) {
        const compactMoves: CompactLibraryMove[] = activeMovesList.map((m) => ({
          from: { ...m.from },
          to: { ...m.to },
          evalScore: m.evalScore,
          quality: m.quality,
        }));
        const newLibItem: LibraryGameItem = {
          id: `fav-${Date.now()}`,
          redPlayer: metadata.redPlayer,
          blackPlayer: metadata.blackPlayer,
          event: metadata.event,
          date: metadata.date,
          result: metadata.result,
          opening: metadata.opening,
          pliesCount: activeMovesList.length,
          accuracyRed: 93.5,
          accuracyBlack: 86.2,
          isFavorite: true,
          category: 'user',
          baseFen:
            workspace === 'study'
              ? piecesToFen(studyBasePieces, studyBaseTurn)
              : piecesToFen(pieces, turn),
          fen: piecesToFen(pieces, turn),
          movesData: compactMoves,
        };
        return [newLibItem, ...prev];
      }
      return prev;
    });
  }, [metadata, activeMovesList, workspace, studyBasePieces, studyBaseTurn, pieces, turn]);

  // 一键将当前对局/拆棋全着法存入「自存对局」棋谱库
  const handleSaveCurrentGameToLibrary = useCallback(() => {
    const compactMoves: CompactLibraryMove[] = activeMovesList.map((m) => ({
      from: { ...m.from },
      to: { ...m.to },
      evalScore: m.evalScore,
      quality: m.quality,
    }));
    const qualityScore = (q?: MoveQuality) =>
      q === '妙' ? 99 : q === '优' ? 95 : q === '良' ? 88 : q === '缓' ? 74 : q === '败' ? 48 : 90;
    const redMoves = activeMovesList.filter((m) => m.piece.camp === 'red');
    const blackMoves = activeMovesList.filter((m) => m.piece.camp === 'black');
    const accuracyRed =
      redMoves.length > 0
        ? Number((redMoves.reduce((s, m) => s + qualityScore(m.quality), 0) / redMoves.length).toFixed(1))
        : 92.0;
    const accuracyBlack =
      blackMoves.length > 0
        ? Number((blackMoves.reduce((s, m) => s + qualityScore(m.quality), 0) / blackMoves.length).toFixed(1))
        : 90.0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const baseFenStr =
      workspace === 'study'
        ? piecesToFen(studyBasePieces, studyBaseTurn)
        : piecesToFen(pieces, turn);
    const currentFenStr = piecesToFen(pieces, turn);
    const inferredOpening =
      matchedOpeningNode?.openingName ||
      lastMatchedOpeningInfo?.openingName ||
      metadata.opening ||
      '自定义对局';

    setLibraryGames((prev) => {
      const existingIdx = prev.findIndex(
        (g) =>
          g.category === 'user' &&
          g.redPlayer === metadata.redPlayer &&
          g.blackPlayer === metadata.blackPlayer &&
          g.opening === inferredOpening
      );
      if (existingIdx >= 0) {
        return prev.map((g, idx) =>
          idx === existingIdx
            ? {
                ...g,
                date: todayStr,
                result: metadata.result,
                pliesCount: compactMoves.length,
                accuracyRed,
                accuracyBlack,
                baseFen: baseFenStr,
                fen: currentFenStr,
                movesData: compactMoves,
              }
            : g
        );
      }
      const newEntry: LibraryGameItem = {
        id: `user-${Date.now()}`,
        redPlayer: metadata.redPlayer,
        blackPlayer: metadata.blackPlayer,
        event: metadata.event || '本地存局 · 复盘研习',
        date: metadata.date || todayStr,
        result: metadata.result,
        opening: inferredOpening,
        pliesCount: compactMoves.length,
        accuracyRed,
        accuracyBlack,
        isFavorite: metadata.isFavorite,
        category: 'user',
        baseFen: baseFenStr,
        fen: currentFenStr,
        movesData: compactMoves,
      };
      return [newEntry, ...prev];
    });
  }, [
    activeMovesList,
    workspace,
    studyBasePieces,
    studyBaseTurn,
    pieces,
    turn,
    matchedOpeningNode,
    lastMatchedOpeningInfo,
    metadata,
  ]);

  // 连线模式下模拟同步外部棋盘的下一手
  const handleSyncNextExternalMove = useCallback(() => {
    const sim = generateSimulatedMultiPV(pieces, turn, engineDepth, 1);
    const nextMove = sim.lines[0]?.firstMove;
    if (nextMove) {
      executeMoveOnBoard(nextMove.from, nextMove.to);
    }
  }, [pieces, turn, engineDepth, executeMoveOnBoard]);

  // 稳定回调引用：配合 React.memo 子组件避免无效重渲染
  const handleToggleSound = useCallback(() => setSoundEnabled((prev) => !prev), []);
  const handleToggleTheme = useCallback(
    () => setAppTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  );
  const handleToggleCompareMode = useCallback(() => setCompareMode((prev) => !prev), []);
  const handleToggleAnalysis = useCallback(() => setIsAnalyzing((prev) => !prev), []);
  const handleToggleThreatRadar = useCallback(() => setThreatRadarEnabled((prev) => !prev), []);
  const handleFlipBoard = useCallback(() => setFlipped((prev) => !prev), []);
  const handleUndoMove = useCallback(
    () => handleJumpPly(Math.max(0, currentPly - 1)),
    [handleJumpPly, currentPly]
  );
  const handleToggleReplay = useCallback(() => {
    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    if (currentPly >= activeMovesList.length && activeMovesList.length > 0) {
      handleJumpPly(0, !!variationMoves);
    }
    setIsReplaying(true);
  }, [isReplaying, currentPly, activeMovesList.length, variationMoves, handleJumpPly]);
  const handleBoardNavNewGame = useCallback(() => {
    if (workspace === 'play') {
      handleStartHandicapGame(handicap, skillTier);
    } else if (workspace === 'challenge') {
      handleSelectChallenge(currentChallenge.id);
    } else {
      handleNewStudyGame();
    }
  }, [
    workspace,
    handicap,
    skillTier,
    currentChallenge.id,
    handleStartHandicapGame,
    handleSelectChallenge,
    handleNewStudyGame,
  ]);
  const handleOpenGameInfo = useCallback(() => setActiveModal('game-info'), []);
  const handleOpenEngineSettings = useCallback(() => setActiveModal('settings'), []);
  const handleOpenImportModal = useCallback(() => setActiveModal('fen-pgn'), []);
  const handleOpenLibraryModal = useCallback(() => setActiveModal('library'), []);
  const handleCloseModal = useCallback(() => setActiveModal(null), []);
  const handleOpenOpeningTab = useCallback(() => setRightTab('opening'), []);
  const handleJumpToOpeningPly = useCallback(
    (ply: number) => handleJumpPly(ply, !!variationMoves),
    [handleJumpPly, variationMoves]
  );

  const handleApplyOpeningPreset = useCallback(
    (preset: OpeningPresetLine) => {
      const base = createInitialPieces('even');
      const replayed = replayCompactMoves(
        base,
        preset.moves.map((m) => ({ from: m.from, to: m.to })),
        'red'
      );
      handleTransferToStudy({
        basePieces: base,
        baseTurn: 'red',
        currentPieces: replayed.finalPieces,
        currentTurn: replayed.finalTurn,
        moves: replayed.moves,
        ply: replayed.moves.length,
        targetRightTab: 'opening',
        nextMetadata: {
          redPlayer: '红方（定式研习）',
          blackPlayer: '黑方（定式应对）',
          event: `开局定式演练 · ${preset.category}`,
          opening: preset.title,
          result: '进行中',
          isFavorite: false,
        },
      });
    },
    [handleTransferToStudy]
  );

  const handleToggleChallengeSolved = useCallback((chId: string) => {
    setSolvedChallengeIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  }, []);

  const handleTransferChallengeToStudy = useCallback(() => {
    handleTransferToStudy({
      basePieces: currentChallenge.pieces(),
      baseTurn: currentChallenge.initialTurn,
      currentPieces: pieces,
      currentTurn: turn,
      moves: mainMoves,
      ply: currentPly,
      nextMetadata: {
        redPlayer: '挑战者（红方）',
        blackPlayer: currentChallenge.sourceBook,
        event: `残局研习 · ${currentChallenge.difficulty}`,
        opening: currentChallenge.title,
        result: '进行中',
        isFavorite: false,
      },
    });
  }, [handleTransferToStudy, currentChallenge, pieces, turn, mainMoves, currentPly]);

  const handlePromoteVariationToMain = useCallback(() => {
    if (variationMoves) {
      setMainMoves(variationMoves);
      setVariationMoves(null);
      setBranchOriginPly(null);
    }
  }, [variationMoves]);

  const handleDiscardVariation = useCallback(() => {
    const backPly = branchOriginPly ?? 0;
    setVariationMoves(null);
    setBranchOriginPly(null);
    handleJumpPly(backPly, false);
  }, [branchOriginPly, handleJumpPly]);

  const handleDisconnectExternal = useCallback(
    () => setConnectState((prev) => ({ ...prev, connected: false })),
    []
  );

  const handleClearSetupToKings = useCallback(() => setPieces(createKingsOnlyPieces()), []);
  const handleResetSetupInitial = useCallback(() => setPieces(createInitialPieces()), []);
  const handleFinishSetup = useCallback(() => {
    handleTransferToStudy({
      basePieces: pieces,
      baseTurn: setupTurn,
      currentPieces: pieces,
      currentTurn: setupTurn,
      moves: [],
      ply: 0,
      nextMetadata: {
        redPlayer: '红方',
        blackPlayer: '黑方',
        event: '摆子推演',
        opening: '自定义摆子局面',
        result: '进行中',
        isFavorite: false,
      },
    });
  }, [handleTransferToStudy, pieces, setupTurn]);

  const modalFen = useMemo(
    () => (activeModal === 'fen-pgn' ? piecesToFen(pieces, turn) : ''),
    [activeModal, pieces, turn]
  );
  const modalPgn = useMemo(
    () =>
      activeModal === 'fen-pgn'
        ? formatGameToPgn(metadata, activeMovesList, modalFen)
        : '',
    [activeModal, metadata, activeMovesList, modalFen]
  );

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
        libraryCount={libraryGames.length}
        onChangeWorkspace={handleSwitchWorkspace}
        onOpenModal={setActiveModal}
        onToggleSound={handleToggleSound}
        onToggleTheme={handleToggleTheme}
      />

      {/* ==================== 2. 主工作台：中央棋盘画布 + 右侧专业工作台 ==================== */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 左侧主画布区：统一舞台容器确保上席位条、评估条+棋盘、下步进控制条左右边缘严格对齐且一屏无滚动条 */}
        <div className="flex-1 min-w-0 h-full overflow-hidden px-5 py-1.5 flex flex-col items-center justify-center relative">
          <div className="w-fit max-h-full flex flex-col items-stretch justify-center gap-1">
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
                isInCheck={checkPositions.inCheckCamp === topCamp}
                materialDiff={
                  topCamp === 'black'
                    ? -materialStats.netAdvantageRed
                    : materialStats.netAdvantageRed
                }
                onEditGameInfo={handleOpenGameInfo}
              />
            )}

            {/* 棋盘与左侧评估条组合 */}
            <div className="flex items-stretch justify-center gap-2.5">
              {workspace === 'study' && (
                <div className="py-0.5 flex items-stretch">
                  <EvalBar
                    scoreCp={currentEvalScore}
                    secondaryScoreCp={
                      analysisMatchesCurrent ? secondaryMultiPvData.lines[0]?.scoreCp ?? null : null
                    }
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
                redCheckPos={checkPositions.redCheckPos}
                blackCheckPos={checkPositions.blackCheckPos}
                boardTheme={boardTheme}
                craftStyle={craftStyle}
                fontScheme={fontScheme}
                useTraditionalChar={useTraditionalChar}
                flipped={flipped}
                workspace={workspace}
                isVariationActive={!!variationMoves}
                onSelectIntersection={handleSelectIntersection}
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
                isInCheck={checkPositions.inCheckCamp === bottomCamp}
                materialDiff={
                  bottomCamp === 'red'
                    ? materialStats.netAdvantageRed
                    : -materialStats.netAdvantageRed
                }
                onEditGameInfo={handleOpenGameInfo}
              />
            )}

            {/* 棋盘下方极简步进与操控栏 */}
            <BoardNav
              workspace={workspace}
              currentPly={currentPly}
              totalPlies={activeMovesList.length}
              isReplaying={isReplaying}
              disabled={workspace === 'setup'}
              onJumpPly={handleJumpPly}
              onToggleReplay={handleToggleReplay}
              onNewGame={handleBoardNavNewGame}
              onFlipBoard={handleFlipBoard}
              onUndoMove={handleUndoMove}
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

            {/* 上半区：仅「复盘分析」模式挂载多引擎分析与双擎对比舱 (EnginePanel) */}
            {workspace === 'study' && (
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
                onChangeSecondaryEngine={handleChangeSecondaryEngine}
                onSwapEngines={handleSwapEngines}
                onToggleCompareMode={handleToggleCompareMode}
                onInstallEngine={handleInstallEngine}
                onOpenEngineSettings={handleOpenEngineSettings}
                onToggleAnalysis={handleToggleAnalysis}
                onToggleThreatRadar={handleToggleThreatRadar}
                onSelectMultiPVMove={executeMoveOnBoard}
                onHoverMultiPVMove={setHoveredArrow}
              />
            )}

            {/* 主工作区：根据当前工作空间自适应呈现 */}
            {workspace === 'challenge' ? (
              /* 残局题库工作台（支持检索、典籍与难度筛选、破关进度统计） */
              <ChallengeWorkbench
                challenges={CLASSICAL_CHALLENGES}
                selectedChallengeId={currentChallenge.id}
                solvedChallengeIds={solvedChallengeIds}
                challengeStatusBanner={challengeStatusBanner}
                movesCount={mainMoves.length}
                onSelectChallenge={handleSelectChallenge}
                onToggleChallengeSolved={handleToggleChallengeSolved}
                onTransferChallengeToStudy={handleTransferChallengeToStudy}
              />
            ) : workspace === 'play' ? (
              /* 人机对弈工作台 */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
                <div className="px-3.5 py-2.5 border-b xq-border flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                    <span className="font-semibold text-sm">人机对弈设置</span>
                  </div>
                  <span className="text-xs xq-text-muted">支持悔棋与支招</span>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3">
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
                          className={`p-2 rounded-lg text-left cursor-pointer ${
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
                          className={`py-1.5 rounded-md text-center cursor-pointer ${
                            skillTier === t.id ? 'xq-btn-option-active' : 'xq-btn-option'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 当前人机实战着法记录 */}
                  <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
                    <div className="flex items-center justify-between text-xs xq-text-secondary">
                      <span>已走手数：{mainMoves.length} 手</span>
                      {isBotThinking && (
                        <span className="text-[var(--xq-accent-gold)] font-medium">
                          电脑思考中…
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto no-scrollbar">
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

                {/* 底部主行动区：随时携带实战局面与着法转入复盘分析 */}
                <div className="p-3.5 border-t xq-border shrink-0 bg-[var(--xq-bg-surface)]">
                  <button
                    type="button"
                    onClick={() => {
                      const handicapLabel =
                        handicap === 'even'
                          ? '分先'
                          : handicap === 'move-first'
                          ? '让先'
                          : handicap === 'left-horse'
                          ? '让左马'
                          : '让双马';
                      const tierLabel =
                        skillTier === 'scholar'
                          ? '初级'
                          : skillTier === 'strategist'
                          ? '中级'
                          : skillTier === 'grandmaster'
                          ? '高级'
                          : '大师';
                      handleTransferToStudy({
                        basePieces: createInitialPieces(handicap),
                        baseTurn: handicap === 'move-first' ? 'black' : 'red',
                        currentPieces: pieces,
                        currentTurn: turn,
                        moves: mainMoves,
                        ply: currentPly,
                        nextMetadata: {
                          redPlayer: '玩家（红方）',
                          blackPlayer: `电脑引擎（${tierLabel}）`,
                          event: `人机对弈 · ${handicapLabel}`,
                          opening: `人机实战 (${handicapLabel})`,
                          result: '进行中',
                          isFavorite: false,
                        },
                      });
                    }}
                    className="w-full py-2.5 px-4 rounded-lg xq-btn-primary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ArrowRightCircle className="w-4 h-4" />
                    <span>
                      {mainMoves.length > 0
                        ? `携带 ${mainMoves.length} 手实战转入复盘分析`
                        : '转入复盘分析'}
                    </span>
                  </button>
                </div>
              </div>
            ) : workspace === 'setup' ? (
              /* 摆子编辑工作台 */
              <SetupWorkbench
                pieces={pieces}
                useTraditionalChar={useTraditionalChar}
                setupSelectedTemplate={setupSelectedTemplate}
                setupTurn={setupTurn}
                onSelectSetupTemplate={setSetupSelectedTemplate}
                onChangeSetupTurn={setSetupTurn}
                onClearSetupToKings={handleClearSetupToKings}
                onResetSetupInitial={handleResetSetupInitial}
                onFinishSetup={handleFinishSetup}
              />
            ) : (
              /* 默认「复盘分析」三页签：回合棋谱 ↔ 复盘报告 ↔ 开局库 */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 三页签切换栏 */}
                <div className="px-3.5 pt-1.5 border-b xq-border flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setRightTab('moves')}
                      className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        rightTab === 'moves'
                          ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>回合棋谱</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRightTab('review')}
                      className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        rightTab === 'review'
                          ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>复盘报告</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRightTab('opening')}
                      className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        rightTab === 'opening'
                          ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <BookMarked className="w-3.5 h-3.5" />
                      <span>开局库</span>
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
                    onSelectPly={handleJumpPly}
                    onPromoteVariationToMain={handlePromoteVariationToMain}
                    onDiscardVariation={handleDiscardVariation}
                    onOpenGameInfo={handleOpenGameInfo}
                    onToggleFavorite={handleToggleCurrentFavorite}
                    onSaveToLibrary={handleSaveCurrentGameToLibrary}
                    onOpenOpeningTab={handleOpenOpeningTab}
                    onLoadSampleGame={handleLoadSampleMasterGame}
                    onOpenImportModal={handleOpenImportModal}
                    onOpenLibraryModal={handleOpenLibraryModal}
                    onSyncNextExternalMove={handleSyncNextExternalMove}
                    onDisconnectExternal={handleDisconnectExternal}
                  />
                ) : rightTab === 'review' ? (
                  <GameReviewPanel
                    moves={mainMoves}
                    currentPly={currentPly}
                    retryMistakePly={retryMistakePly}
                    retryFeedback={retryFeedback}
                    onJumpPly={handleJumpPly}
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
                    onPlayBestAlternative={executeMoveOnBoard}
                    onLoadSampleGame={handleLoadSampleMasterGame}
                    onOpenImportModal={handleOpenImportModal}
                  />
                ) : (
                  <OpeningBookPanel
                    turn={turn}
                    currentPly={currentPly}
                    matchedNode={matchedOpeningNode}
                    lastMatchedInfo={lastMatchedOpeningInfo}
                    onSelectOpeningMove={executeMoveOnBoard}
                    onHoverOpeningMove={setHoveredArrow}
                    onJumpToPly={handleJumpToOpeningPly}
                    onApplyOpeningPreset={handleApplyOpeningPreset}
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
        inCheckCamp={checkPositions.inCheckCamp}
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
        currentFen={modalFen}
        currentPgn={modalPgn}
        metadata={metadata}
        libraryGames={libraryGames}
        onClose={handleCloseModal}
        onSwitchWorkspace={handleSwitchWorkspace}
        onApplyFen={(fenStr) => {
          const parsed = parseFenToPieces(fenStr);
          if (!parsed) return false;
          handleTransferToStudy({
            basePieces: parsed.pieces,
            baseTurn: parsed.turn,
            currentPieces: parsed.pieces,
            currentTurn: parsed.turn,
            moves: [],
            ply: 0,
            nextMetadata: {
              opening: '导入 FEN 局面',
            },
          });
          return true;
        }}
        onSaveMetadata={setMetadata}
        onSaveCurrentGameToLibrary={handleSaveCurrentGameToLibrary}
        onLoadLibraryGame={(game) => {
          const baseMeta: Partial<GameMetadata> = {
            redPlayer: game.redPlayer,
            blackPlayer: game.blackPlayer,
            event: game.event,
            date: game.date,
            result: game.result,
            opening: game.opening,
            isFavorite: game.isFavorite,
          };
          if (game.movesData && game.movesData.length > 0) {
            const parsedBase = parseFenToPieces(game.baseFen || INITIAL_FEN);
            const basePieces = parsedBase ? parsedBase.pieces : createInitialPieces('even');
            const baseTurn = parsedBase ? parsedBase.turn : 'red';
            const replayed = replayCompactMoves(basePieces, game.movesData, baseTurn);
            handleTransferToStudy({
              basePieces,
              baseTurn,
              currentPieces: replayed.finalPieces,
              currentTurn: replayed.finalTurn,
              moves: replayed.moves,
              ply: replayed.moves.length,
              nextMetadata: baseMeta,
            });
            return;
          }
          if (game.fen) {
            const parsed = parseFenToPieces(game.fen);
            if (parsed) {
              handleTransferToStudy({
                basePieces: parsed.pieces,
                baseTurn: parsed.turn,
                currentPieces: parsed.pieces,
                currentTurn: parsed.turn,
                moves: [],
                ply: 0,
                nextMetadata: baseMeta,
              });
              return;
            }
          }
          const sampleSession = getSampleSession();
          handleTransferToStudy({
            basePieces: sampleSession.initialPieces,
            baseTurn: 'red',
            currentPieces: sampleSession.moves[11]?.piecesSnapshot || createInitialPieces(),
            currentTurn: 'red',
            moves: sampleSession.moves,
            ply: 12,
            nextMetadata: baseMeta,
          });
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
        onChangeSecondaryEngine={handleChangeSecondaryEngine}
        onToggleCompareMode={handleToggleCompareMode}
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
