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
import { countMatchingLibraryGames, lookupOpeningBookNode, OPENING_PRESETS } from './data/openingBook';
import {
  ActiveModalId,
  AppTheme,
  BoardTheme,
  Camp,
  CheckSealEffect,
  CompactLibraryMove,
  EngineProfile,
  EngineProtocol,
  EngineSkillTier,
  ExternalConnectState,
  FontScale,
  FontScheme,
  GameMetadata,
  GameTerminalState,
  HandicapType,
  ImpactEffect,
  LibraryGameItem,
  MoveQuality,
  MoveRecord,
  MultiPVArrow,
  OpeningDrillProgress,
  OpeningDrillRuntime,
  OpeningPanelSubMode,
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
  downloadTextFile,
  evaluateBoardScore,
  formatChineseMoveNotation,
  formatGameToPgn,
  generateOpponentThreatArrow,
  generateSimulatedMultiPV,
  getCheckingAttackers,
  getLegalMovesForPiece,
  getPieceAt,
  getPieceAtGrid,
  getSafeLegalMovesForPiece,
  hasAnyLegalMoves,
  INITIAL_FEN,
  isCampInCheck,
  parseFenToPieces,
  parsePgnTextToSession,
  piecesToFen,
  playCheckChimeSound,
  playCheckmateGongSound,
  playInvalidWarningSound,
  playWoodClackSound,
  replayCompactMoves,
  sanitizeExportFilename,
} from './utils/xiangqiRules';

const STUDY_SESSION_STORAGE_KEY = 'xiangqix_study_session_v1';
const PREFS_STORAGE_KEY = 'xiangqix_prefs_v1';
const LIBRARY_STORAGE_KEY = 'xiangqix_library_v1';
const SOLVED_CHALLENGES_STORAGE_KEY = 'xiangqix_challenges_solved_v1';
const OPENING_DRILLS_STORAGE_KEY = 'xiangqix_opening_drills_v1';

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
  activeLibraryGameId?: string | null;
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

function readStoredOpeningDrillProgress(): Record<string, OpeningDrillProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OPENING_DRILLS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, OpeningDrillProgress>)
      : {};
  } catch {
    return {};
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
  const [checkSealEffect, setCheckSealEffect] = useState<CheckSealEffect | null>(null);
  const [illegalCheckCamp, setIllegalCheckCamp] = useState<Camp | null>(null);
  const [illegalMoveWarning, setIllegalMoveWarning] = useState<string | null>(null);
  const [terminalDismissed, setTerminalDismissed] = useState<boolean>(false);
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
  const [activeLibraryGameId, setActiveLibraryGameId] = useState<string | null>(
    () => initialStudy?.activeLibraryGameId ?? null
  );
  const [activeModal, setActiveModal] = useState<ActiveModalId>(null);
  const [fenPgnInitialTab, setFenPgnInitialTab] = useState<'import' | 'export'>('import');
  const [initialLibrarySearch, setInitialLibrarySearch] = useState<string | null>(null);

  // 开局库双态工作台与变例对练引擎状态
  const [openingSubMode, setOpeningSubMode] = useState<OpeningPanelSubMode>('explorer');
  const [drillProgressMap, setDrillProgressMap] = useState<
    Record<string, OpeningDrillProgress>
  >(() => readStoredOpeningDrillProgress());
  const [drillState, setDrillState] = useState<OpeningDrillRuntime>({
    presetId: OPENING_PRESETS[0].id,
    playerCamp: 'red',
    stepIndex: 0,
    attempts: 0,
    mistakes: 0,
    status: 'idle',
    feedback: null,
    expectedMove: null,
  });
  const drillReplyTimerRef = useRef<number | null>(null);

  const clearDrillTimer = useCallback(() => {
    if (drillReplyTimerRef.current !== null) {
      window.clearTimeout(drillReplyTimerRef.current);
      drillReplyTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearDrillTimer, [clearDrillTimer]);

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
      activeLibraryGameId,
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
    activeLibraryGameId,
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        OPENING_DRILLS_STORAGE_KEY,
        JSON.stringify(drillProgressMap)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [drillProgressMap]);

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
    return getSafeLegalMovesForPiece(selectedPiece, pieces, boardGrid);
  }, [selectedPiece, pieces, boardGrid, workspace, isBotThinking]);

  useEffect(() => {
    if (!checkSealEffect) return;
    const timer = window.setTimeout(() => setCheckSealEffect(null), 1350);
    return () => window.clearTimeout(timer);
  }, [checkSealEffect]);

  useEffect(() => {
    if (!illegalCheckCamp) return;
    const timer = window.setTimeout(() => setIllegalCheckCamp(null), 420);
    return () => window.clearTimeout(timer);
  }, [illegalCheckCamp]);

  useEffect(() => {
    if (!illegalMoveWarning) return;
    const timer = window.setTimeout(() => setIllegalMoveWarning(null), 2200);
    return () => window.clearTimeout(timer);
  }, [illegalMoveWarning]);

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

  const checkAttackLines = useMemo(() => {
    if (workspace === 'setup') return [];
    const lines = [];
    if (checkPositions.redCheckPos) {
      lines.push(...getCheckingAttackers(pieces, 'red', boardGrid));
    }
    if (checkPositions.blackCheckPos) {
      lines.push(...getCheckingAttackers(pieces, 'black', boardGrid));
    }
    return lines;
  }, [workspace, checkPositions.redCheckPos, checkPositions.blackCheckPos, pieces, boardGrid]);

  const hasLegalMovesCurrentTurn = useMemo(
    () => (workspace === 'setup' ? false : hasAnyLegalMoves(pieces, turn, boardGrid)),
    [workspace, pieces, turn, boardGrid]
  );

  const terminalOutcome = useMemo<GameTerminalState | null>(() => {
    if (workspace === 'setup') return null;
    if (hasLegalMovesCurrentTurn) return null;
    const inCheckNow = checkPositions.inCheckCamp === turn;
    const winner: Camp = turn === 'red' ? 'black' : 'red';
    return {
      kind: inCheckNow ? 'checkmate' : 'stalemate',
      winner,
      loser: turn,
    };
  }, [workspace, hasLegalMovesCurrentTurn, checkPositions.inCheckCamp, turn]);

  const currentChallenge = useMemo(
    () =>
      CLASSICAL_CHALLENGES.find((c) => c.id === selectedChallengeId) ||
      CLASSICAL_CHALLENGES[0],
    [selectedChallengeId]
  );

  // 开局库盘面指纹 O(1) 实时匹配与回溯最近定式节点（同时服务于「复盘分析」与「开局研习」）
  const isOpeningContext = workspace === 'study' || workspace === 'opening';
  const matchedOpeningNode = useMemo(
    () => (isOpeningContext ? lookupOpeningBookNode(pieces, turn) : null),
    [isOpeningContext, pieces, turn]
  );

  const lastMatchedOpeningInfo = useMemo(() => {
    if (!isOpeningContext || matchedOpeningNode || currentPly <= 0) return null;
    const baseSnap = workspace === 'opening' ? createInitialPieces('even') : studyBasePieces;
    const baseTurnVal: Camp = workspace === 'opening' ? 'red' : studyBaseTurn;
    for (let ply = currentPly - 1; ply >= 0; ply--) {
      const snapPieces =
        ply === 0 ? baseSnap : activeMovesList[ply - 1]?.piecesSnapshot;
      if (!snapPieces) continue;
      const snapTurn: Camp =
        ply === 0
          ? baseTurnVal
          : activeMovesList[ply - 1].piece.camp === 'red'
          ? 'black'
          : 'red';
      const node = lookupOpeningBookNode(snapPieces, snapTurn);
      if (node) {
        return {
          ply,
          openingName: node.openingName,
          category: node.category,
          matchKeyword: node.matchKeyword,
        };
      }
    }
    return null;
  }, [
    isOpeningContext,
    workspace,
    matchedOpeningNode,
    currentPly,
    studyBasePieces,
    studyBaseTurn,
    activeMovesList,
  ]);

  const activeMatchKeyword =
    matchedOpeningNode?.matchKeyword ?? lastMatchedOpeningInfo?.matchKeyword ?? '';
  const matchedLibraryCount = useMemo(
    () => countMatchingLibraryGames(libraryGames, activeMatchKeyword),
    [libraryGames, activeMatchKeyword]
  );
  const isOpeningDrillSpoilerFree =
    workspace === 'opening' &&
    openingSubMode === 'drill' &&
    (drillState.status === 'drilling' || drillState.status === 'mistake');

  // ==================== 4. 切换工作空间、新局重置与载入古谱/示范名局 ====================
  const handleNewStudyGame = useCallback(() => {
    clearDrillTimer();
    setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
    const freshPieces = createInitialPieces('even');
    setWorkspace('study');
    setActiveLibraryGameId(null);
    setIsReplaying(false);
    setSelectedPieceId(null);
    setHintArrow(null);
    setHoveredArrow(null);
    setRetryMistakePly(null);
    setRetryFeedback(null);
    setCheckSealEffect(null);
    setIllegalMoveWarning(null);
    setTerminalDismissed(false);
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
  }, [clearDrillTimer]);

  const handleLoadSampleMasterGame = useCallback(() => {
    clearDrillTimer();
    setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
    const sampleSession = getSampleSession();
    setWorkspace('study');
    setActiveLibraryGameId(null);
    setIsReplaying(false);
    setSelectedPieceId(null);
    setHintArrow(null);
    setHoveredArrow(null);
    setRetryMistakePly(null);
    setRetryFeedback(null);
    setCheckSealEffect(null);
    setIllegalMoveWarning(null);
    setTerminalDismissed(false);
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
  }, [clearDrillTimer, getSampleSession]);

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
      libraryGameId?: string | null;
    }) => {
      clearDrillTimer();
      setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
      setWorkspace('study');
      setActiveLibraryGameId(payload.libraryGameId ?? null);
      setRightTab(payload.targetRightTab || 'moves');
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setRetryMistakePly(null);
      setRetryFeedback(null);
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);
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
    [clearDrillTimer]
  );

  const handleSwitchWorkspace = useCallback(
    (nextWs: WorkspaceMode) => {
      clearDrillTimer();
      setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
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
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);

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
          setActiveLibraryGameId(stored.activeLibraryGameId ?? null);
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
          setActiveLibraryGameId(null);
        }
        setIsAnalyzing(true);
      } else if (nextWs === 'opening') {
        const initP = createInitialPieces('even');
        setPieces(initP);
        setMainMoves([]);
        setVariationMoves(null);
        setBranchOriginPly(null);
        setCurrentPly(0);
        setTurn('red');
        setFlipped(false);
        setIsAnalyzing(false);
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
    [clearDrillTimer, workspace, flushStudyPersistence, handicap, turn]
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
    setCheckSealEffect(null);
    setIllegalMoveWarning(null);
    setTerminalDismissed(false);
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
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);
    },
    []
  );

  const recordDrillCompletion = useCallback(
    (presetId: string, attempts: number, mistakes: number) => {
      const total = attempts + mistakes;
      const accuracyPct =
        total > 0 ? Math.max(0, Math.round((attempts / total) * 100)) : 100;
      const todayStr = new Date().toISOString().slice(0, 10);
      setDrillProgressMap((prev) => {
        const existing = prev[presetId];
        return {
          ...prev,
          [presetId]: {
            completedCount: (existing?.completedCount || 0) + 1,
            bestAccuracyPct: Math.max(existing?.bestAccuracyPct || 0, accuracyPct),
            lastPracticedAt: todayStr,
          },
        };
      });
    },
    []
  );

  const triggerMoveSoundAndCheckEffects = useCallback(
    (
      nextPieces: Piece[],
      nextTurn: Camp,
      isCapture: boolean,
      row: number,
      col: number
    ): GameTerminalState | null => {
      const moverCamp: Camp = nextTurn === 'red' ? 'black' : 'red';
      playWoodClackSound(isCapture, row, col, soundEnabled);
      setImpactEffect({
        id: Date.now(),
        row,
        col,
        camp: moverCamp,
        isCapture,
      });
      setIllegalMoveWarning(null);

      const nextGrid = buildBoardGrid(nextPieces);
      const isNextInCheck = !!isCampInCheck(nextPieces, nextTurn, nextGrid);
      const nextHasMoves = hasAnyLegalMoves(nextPieces, nextTurn, nextGrid);

      if (!nextHasMoves) {
        const outcome: GameTerminalState = {
          kind: isNextInCheck ? 'checkmate' : 'stalemate',
          winner: moverCamp,
          loser: nextTurn,
        };
        playCheckmateGongSound(soundEnabled);
        setCheckSealEffect(null);
        setTerminalDismissed(false);
        return outcome;
      }

      if (isNextInCheck) {
        playCheckChimeSound(soundEnabled);
        setCheckSealEffect({ id: Date.now(), camp: nextTurn });
      } else {
        setCheckSealEffect(null);
      }
      return null;
    },
    [soundEnabled]
  );

  const scheduleDrillOpponentReply = useCallback(
    (
      boardBeforeReply: Piece[],
      recordsBeforeReply: MoveRecord[],
      nextStepIdx: number,
      preset: OpeningPresetLine,
      attemptsNow: number,
      mistakesNow: number
    ) => {
      clearDrillTimer();
      const step = preset.moves[nextStepIdx];
      if (!step) return;
      drillReplyTimerRef.current = window.setTimeout(() => {
        drillReplyTimerRef.current = null;
        const moving = getPieceAt(boardBeforeReply, step.from.row, step.from.col);
        if (!moving) return;
        const captured = getPieceAt(boardBeforeReply, step.to.row, step.to.col);
        const notation = formatChineseMoveNotation(moving, step.from, step.to);
        const afterPieces = boardBeforeReply
          .filter((p) => !(p.row === step.to.row && p.col === step.to.col))
          .map((p) =>
            p.id === moving.id ? { ...p, row: step.to.row, col: step.to.col } : p
          );
        const oppRecord: MoveRecord = {
          ply: nextStepIdx + 1,
          piece: { ...moving },
          from: step.from,
          to: step.to,
          captured: captured ? { ...captured } : undefined,
          notation,
          evalScore: evaluateBoardScore(afterPieces),
          quality: '优',
          piecesSnapshot: afterPieces.map((p) => ({ ...p })),
        };
        const updatedRecords = [...recordsBeforeReply, oppRecord];
        const nextTurnAfterReply: Camp = moving.camp === 'red' ? 'black' : 'red';
        triggerMoveSoundAndCheckEffects(
          afterPieces,
          nextTurnAfterReply,
          !!captured,
          step.to.row,
          step.to.col
        );
        setPieces(afterPieces);
        setMainMoves(updatedRecords);
        setCurrentPly(nextStepIdx + 1);
        setTurn(nextTurnAfterReply);

        const afterIdx = nextStepIdx + 1;
        if (afterIdx >= preset.moves.length) {
          recordDrillCompletion(preset.id, attemptsNow, mistakesNow);
          setDrillState((prev) => ({
            ...prev,
            stepIndex: afterIdx,
            status: 'completed',
            expectedMove: null,
            feedback: `对方已走出末手应招「${notation}」，本线定式完整通关！`,
          }));
        } else {
          setDrillState((prev) => ({
            ...prev,
            stepIndex: afterIdx,
            status: 'drilling',
            expectedMove: null,
            feedback: `对手已走「${notation}」，请继续走出下一手定式！`,
          }));
        }
      }, 450);
    },
    [clearDrillTimer, triggerMoveSoundAndCheckEffects, recordDrillCompletion]
  );

  // ==================== 5. 跳手、无感内联分支走子与人机/古谱自动应手 ====================
  const handleJumpPly = useCallback(
    (targetPly: number, useVariation = false) => {
      if (isOpeningDrillSpoilerFree) {
        clearDrillTimer();
        setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
      }
      const list = useVariation && variationMoves ? variationMoves : mainMoves;
      if (!useVariation && variationMoves) {
        // 点击主谱任意手时，若低于分叉点则保留或切回主谱视图
      }
      const clamped = Math.max(0, Math.min(list.length, targetPly));
      setCurrentPly(clamped);
      setSelectedPieceId(null);
      setHintArrow(null);
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);

      if (clamped === 0) {
        const baseInit =
          workspace === 'opening'
            ? createInitialPieces('even')
            : workspace === 'challenge'
            ? currentChallenge.pieces()
            : workspace === 'play'
            ? createInitialPieces(handicap)
            : studyBasePieces.map((p) => ({ ...p }));
        setPieces(baseInit);
        setTurn(
          workspace === 'opening'
            ? 'red'
            : workspace === 'challenge'
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
    [
      isOpeningDrillSpoilerFree,
      clearDrillTimer,
      variationMoves,
      mainMoves,
      workspace,
      currentChallenge,
      handicap,
      studyBasePieces,
      studyBaseTurn,
    ]
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

      // 开局变例对练实时校验拦截：仅校验玩家执方步序，错着停留在决策手不破坏棋盘
      if (isOpeningDrillSpoilerFree) {
        const activePreset =
          OPENING_PRESETS.find((p) => p.id === drillState.presetId) || OPENING_PRESETS[0];
        const expectedStep = activePreset.moves[drillState.stepIndex];
        if (!expectedStep || moving.camp !== drillState.playerCamp || turn !== drillState.playerCamp) {
          setSelectedPieceId(null);
          return;
        }
        const isMatched =
          from.row === expectedStep.from.row &&
          from.col === expectedStep.from.col &&
          to.row === expectedStep.to.row &&
          to.col === expectedStep.to.col;

        if (!isMatched) {
          const expPiece = getPieceAtGrid(boardGrid, expectedStep.from.row, expectedStep.from.col);
          const expNotation = expPiece
            ? formatChineseMoveNotation(expPiece, expectedStep.from, expectedStep.to)
            : '定式正着';
          playInvalidWarningSound(soundEnabled);
          setSelectedPieceId(null);
          setDrillState((prev) => ({
            ...prev,
            status: 'mistake',
            mistakes: prev.mistakes + 1,
            expectedMove: {
              from: expectedStep.from,
              to: expectedStep.to,
              notation: expNotation,
            },
            feedback: `您试走了「${notation}」，偏离「${activePreset.title}」定式主线。请再试一次，或点击「在棋盘提示正着」。`,
          }));
          return;
        }

        const nextTurnAfterPlayer: Camp = moving.camp === 'red' ? 'black' : 'red';
        triggerMoveSoundAndCheckEffects(
          nextPieces,
          nextTurnAfterPlayer,
          !!captured,
          to.row,
          to.col
        );
        const nextRecords = [...mainMoves.slice(0, currentPly), newRecord];
        setPieces(nextPieces);
        setMainMoves(nextRecords);
        setSelectedPieceId(null);
        setHintArrow(null);
        setTurn(nextTurnAfterPlayer);
        setCurrentPly(nextPly);

        const nextStepIdx = drillState.stepIndex + 1;
        const nextAttempts = drillState.attempts + 1;
        if (nextStepIdx >= activePreset.moves.length) {
          recordDrillCompletion(activePreset.id, nextAttempts, drillState.mistakes);
          setDrillState((prev) => ({
            ...prev,
            stepIndex: nextStepIdx,
            attempts: nextAttempts,
            status: 'completed',
            expectedMove: null,
            feedback: `正着「${notation}」！本线定式完整通关！`,
          }));
        } else {
          setDrillState((prev) => ({
            ...prev,
            stepIndex: nextStepIdx,
            attempts: nextAttempts,
            status: 'drilling',
            expectedMove: null,
            feedback: `走对了「${notation}」！正在等待对方定式应手…`,
          }));
          scheduleDrillOpponentReply(
            nextPieces,
            nextRecords,
            nextStepIdx,
            activePreset,
            nextAttempts,
            drillState.mistakes
          );
        }
        return;
      }

      const nextTurn: Camp = moving.camp === 'red' ? 'black' : 'red';
      const terminalAfterPlayer = triggerMoveSoundAndCheckEffects(
        nextPieces,
        nextTurn,
        !!captured,
        to.row,
        to.col
      );

      setPieces(nextPieces);
      setSelectedPieceId(null);
      setHintArrow(null);
      setTurn(nextTurn);
      setCurrentPly(nextPly);

      if (terminalAfterPlayer && workspace === 'study' && metadata.result === '进行中') {
        setMetadata((prev) => ({
          ...prev,
          result: terminalAfterPlayer.winner === 'red' ? '红胜' : '黑胜',
        }));
      }

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

      // 在「复盘分析」或「开局研习（定式树）」模式下：若在中途历史手走了不同于主谱的棋，自动生成无感内联推演支线
      if (workspace === 'study' || workspace === 'opening') {
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

      // 若在「古谱闯关」或「人机对弈」模式下且轮到黑方（引擎），先判定是否已绝杀/困毙，未终局则延迟 620ms 自动应手
      if ((workspace === 'challenge' || workspace === 'play') && nextTurn === 'black') {
        if (terminalAfterPlayer) {
          if (workspace === 'challenge' && terminalAfterPlayer.winner === 'red') {
            setSolvedChallengeIds((prev) =>
              prev.includes(currentChallenge.id) ? prev : [...prev, currentChallenge.id]
            );
            setChallengeStatusBanner(
              terminalAfterPlayer.kind === 'checkmate'
                ? `绝杀取胜！成功攻破《${currentChallenge.sourceBook} · ${currentChallenge.title}》！`
                : `困毙取胜！黑方无子可走，成功破关！`
            );
          }
          return;
        }

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
              const botTerminal = triggerMoveSoundAndCheckEffects(
                afterBot,
                'red',
                !!botCap,
                reply.to.row,
                reply.to.col
              );
              setPieces(afterBot);
              setMainMoves((prev) => [...prev.slice(0, nextPly), botRec]);
              setCurrentPly(nextPly + 1);
              setTurn('red');
              if (botTerminal && workspace === 'challenge') {
                setChallengeStatusBanner(
                  botTerminal.kind === 'checkmate'
                    ? '黑方反杀将死，可点击「重摆」再试一次或步进复盘！'
                    : '红方无合法着法，黑方取胜，可点击「重摆」再战！'
                );
              }
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
      isOpeningDrillSpoilerFree,
      drillState.presetId,
      drillState.stepIndex,
      drillState.playerCamp,
      drillState.attempts,
      drillState.mistakes,
      turn,
      soundEnabled,
      retryMistakePly,
      retryTargetMove,
      workspace,
      metadata.result,
      mainMoves,
      variationMoves,
      branchOriginPly,
      currentChallenge,
      recordDrillCompletion,
      scheduleDrillOpponentReply,
      triggerMoveSoundAndCheckEffects,
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

      if (terminalOutcome) {
        setSelectedPieceId(null);
        return;
      }

      if (selectedPiece && legalMoves.some((m) => m.row === row && m.col === col)) {
        executeMoveOnBoard(
          { row: selectedPiece.row, col: selectedPiece.col },
          { row, col }
        );
        return;
      }

      // 若点击位置属于机械走法但会导致送将/将帅照面/未应将，给出克制提示并摇晃受将帅位
      if (selectedPiece) {
        const pseudoLegal = getLegalMovesForPiece(selectedPiece, pieces, boardGrid);
        if (pseudoLegal.some((m) => m.row === row && m.col === col)) {
          const currentlyInCheck = checkPositions.inCheckCamp === turn;
          playInvalidWarningSound(soundEnabled);
          setIllegalCheckCamp(turn);
          setIllegalMoveWarning(
            currentlyInCheck
              ? '当前受将 · 此着未能解除将军危机'
              : '此着会造成送将或将帅照面，不可落子'
          );
          return;
        }
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
      terminalOutcome,
      boardGrid,
      setupSelectedTemplate,
      pieces,
      soundEnabled,
      selectedPiece,
      legalMoves,
      checkPositions.inCheckCamp,
      executeMoveOnBoard,
      turn,
      selectedPieceId,
    ]
  );

  const handleShowDrillHint = useCallback(() => {
    const preset =
      OPENING_PRESETS.find((p) => p.id === drillState.presetId) || OPENING_PRESETS[0];
    const step = preset.moves[drillState.stepIndex];
    if (!step) return;
    const moving = getPieceAt(pieces, step.from.row, step.from.col);
    const notation = moving
      ? formatChineseMoveNotation(moving, step.from, step.to)
      : '定式正着';
    setHintArrow({
      rank: 1,
      from: step.from,
      to: step.to,
      notation,
      scoreText: `正着 ${notation}`,
    });
  }, [drillState.presetId, drillState.stepIndex, pieces]);

  // ==================== 6. 锦囊支招 (Hint) 与 自动回放 ====================
  const handleTriggerHint = useCallback(() => {
    if (workspace === 'setup' || isBotThinking) return;
    if (!hasAnyLegalMoves(pieces, turn, boardGrid)) return;
    if (workspace === 'study' && primaryEngine.status !== 'ready') return;
    if (
      workspace === 'opening' &&
      openingSubMode === 'drill' &&
      drillState.status === 'completed'
    ) {
      return;
    }
    if (workspace === 'opening' && isOpeningDrillSpoilerFree) {
      handleShowDrillHint();
      return;
    }
    if (workspace === 'opening' && matchedOpeningNode && matchedOpeningNode.nextMoves[0]) {
      const topBook = matchedOpeningNode.nextMoves[0];
      setHintArrow({
        rank: 1,
        from: topBook.from,
        to: topBook.to,
        scoreText: `主流 ${topBook.frequencyPct}%`,
        notation: topBook.notation,
      });
      return;
    }
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
  }, [
    workspace,
    isBotThinking,
    pieces,
    turn,
    boardGrid,
    primaryEngine.status,
    openingSubMode,
    drillState.status,
    isOpeningDrillSpoilerFree,
    handleShowDrillHint,
    matchedOpeningNode,
    currentPly,
    currentChallenge,
  ]);

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
      handleJumpPly(nextPly, !!variationMoves);
      if (rec) {
        const nextTurnAfterRec: Camp = rec.piece.camp === 'red' ? 'black' : 'red';
        triggerMoveSoundAndCheckEffects(
          rec.piecesSnapshot,
          nextTurnAfterRec,
          !!rec.captured,
          rec.to.row,
          rec.to.col
        );
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [isReplaying, currentPly, variationMoves, mainMoves, handleJumpPly, triggerMoveSoundAndCheckEffects]);

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
      } else if (e.key === ' ' && workspace === 'study' && !isOpeningDrillSpoilerFree) {
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
    isOpeningDrillSpoilerFree,
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

  const canSaveCurrentGame = useMemo(
    () =>
      activeMovesList.length > 0 ||
      (workspace === 'study' && piecesToFen(studyBasePieces, studyBaseTurn) !== INITIAL_FEN),
    [activeMovesList.length, workspace, studyBasePieces, studyBaseTurn]
  );

  const activeLibraryGame = useMemo(
    () => (activeLibraryGameId ? libraryGames.find((g) => g.id === activeLibraryGameId) || null : null),
    [activeLibraryGameId, libraryGames]
  );

  const isExistingUserSave = activeLibraryGame?.category === 'user';

  const buildUserLibraryEntry = useCallback(
    (entryId: string, favoriteFlag: boolean): LibraryGameItem => {
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
          ? Number(
              (redMoves.reduce((s, m) => s + qualityScore(m.quality), 0) / redMoves.length).toFixed(1)
            )
          : 92.0;
      const accuracyBlack =
        blackMoves.length > 0
          ? Number(
              (blackMoves.reduce((s, m) => s + qualityScore(m.quality), 0) / blackMoves.length).toFixed(1)
            )
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

      return {
        id: entryId,
        redPlayer: metadata.redPlayer,
        blackPlayer: metadata.blackPlayer,
        event: metadata.event || '本地存局 · 复盘研习',
        date: todayStr,
        result: metadata.result,
        opening: inferredOpening,
        pliesCount: compactMoves.length,
        accuracyRed,
        accuracyBlack,
        isFavorite: favoriteFlag,
        category: 'user',
        baseFen: baseFenStr,
        fen: currentFenStr,
        movesData: compactMoves,
      };
    },
    [
      activeMovesList,
      workspace,
      studyBasePieces,
      studyBaseTurn,
      pieces,
      turn,
      matchedOpeningNode,
      lastMatchedOpeningInfo,
      metadata,
    ]
  );

  // 独立星标收藏开关：仅对已入库或载入棋谱库的名局生效，不再隐式充当第二个「存局」入口
  const handleToggleCurrentFavorite = useCallback(() => {
    if (!activeLibraryGame) return;
    const nextFav = !metadata.isFavorite;
    setMetadata((prev) => ({ ...prev, isFavorite: nextFav }));
    setLibraryGames((prev) =>
      prev.map((g) => (g.id === activeLibraryGame.id ? { ...g, isFavorite: nextFav } : g))
    );
  }, [activeLibraryGame, metadata.isFavorite]);

  // 保存或原地更新「自存对局」（与星标共享 activeLibraryGameId 主键，杜绝重复存局）
  const handleSaveCurrentGameToLibrary = useCallback(() => {
    if (!canSaveCurrentGame) return;

    if (activeLibraryGame && activeLibraryGame.category === 'user') {
      const updated = buildUserLibraryEntry(activeLibraryGame.id, metadata.isFavorite);
      setLibraryGames((prev) =>
        prev.map((g) => (g.id === activeLibraryGame.id ? updated : g))
      );
      return;
    }

    const newId = `user-${Date.now()}`;
    const newEntry = buildUserLibraryEntry(newId, metadata.isFavorite);
    setActiveLibraryGameId(newId);
    setLibraryGames((prev) => [newEntry, ...prev]);
  }, [canSaveCurrentGame, activeLibraryGame, metadata.isFavorite, buildUserLibraryEntry]);

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
  const handleOpenGameInfo = useCallback(() => setActiveModal('game-info'), []);
  const handleOpenEngineSettings = useCallback(() => setActiveModal('settings'), []);
  const handleOpenImportModal = useCallback(() => {
    setFenPgnInitialTab('import');
    setActiveModal('fen-pgn');
  }, []);
  const handleOpenExportModal = useCallback(() => {
    setFenPgnInitialTab('export');
    setActiveModal('fen-pgn');
  }, []);
  const handleOpenLibraryModal = useCallback(() => {
    setInitialLibrarySearch(null);
    setActiveModal('library');
  }, []);
  const handleOpenMatchingLibrary = useCallback((keyword: string) => {
    setInitialLibrarySearch(keyword.trim() || null);
    setActiveModal('library');
  }, []);
  const handleTitlebarOpenModal = useCallback((modal: ActiveModalId) => {
    if (modal === 'library') {
      setInitialLibrarySearch(null);
    } else if (modal === 'fen-pgn') {
      setFenPgnInitialTab('import');
    }
    setActiveModal(modal);
  }, []);
  const handleExportLibraryGame = useCallback(
    (game: LibraryGameItem) => {
      let baseFenStr = game.baseFen || game.fen || INITIAL_FEN;
      let exportMovesList: MoveRecord[] = [];
      if (game.movesData && game.movesData.length > 0) {
        const parsedBase = parseFenToPieces(game.baseFen || INITIAL_FEN);
        const basePieces = parsedBase ? parsedBase.pieces : createInitialPieces('even');
        const baseTurn = parsedBase ? parsedBase.turn : 'red';
        baseFenStr = piecesToFen(basePieces, baseTurn);
        exportMovesList = replayCompactMoves(basePieces, game.movesData, baseTurn).moves;
      } else if (!game.fen) {
        const sampleSession = getSampleSession();
        baseFenStr = piecesToFen(sampleSession.initialPieces, 'red');
        exportMovesList = sampleSession.moves;
      }
      const pgnContent = formatGameToPgn(game, exportMovesList, baseFenStr, false);
      const fileName = sanitizeExportFilename(
        `${game.redPlayer}_vs_${game.blackPlayer}_${game.opening || 'xiangqi'}`
      );
      downloadTextFile(`${fileName}.pgn`, pgnContent);
    },
    [getSampleSession]
  );
  const handleCloseModal = useCallback(() => setActiveModal(null), []);
  const handleOpenOpeningTab = useCallback(() => setRightTab('opening'), []);

  // 从「复盘分析」或「棋谱库」一键切入独立「开局研习」工作台（若由标准开局起步，平滑携带当前开局序列）
  const handleGoToOpeningWorkspace = useCallback(() => {
    clearDrillTimer();
    if (workspace === 'study') {
      flushStudyPersistence();
    }
    setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
    setOpeningSubMode('explorer');
    setWorkspace('opening');
    setSidebarCollapsed(false);
    setIsReplaying(false);
    setSelectedPieceId(null);
    setHintArrow(null);
    setHoveredArrow(null);
    setRetryMistakePly(null);
    setRetryFeedback(null);
    setIsAnalyzing(false);

    const isFromStandardStart =
      workspace === 'study' &&
      piecesToFen(studyBasePieces, studyBaseTurn) === INITIAL_FEN;
    if (isFromStandardStart && activeMovesList.length > 0 && currentPly > 0) {
      const carryMoves = activeMovesList
        .slice(0, currentPly)
        .map((m) => ({ ...m, piecesSnapshot: m.piecesSnapshot.map((p) => ({ ...p })) }));
      const lastCarried = carryMoves[carryMoves.length - 1];
      setMainMoves(carryMoves);
      setVariationMoves(null);
      setBranchOriginPly(null);
      setCurrentPly(carryMoves.length);
      setPieces(
        lastCarried
          ? lastCarried.piecesSnapshot.map((p) => ({ ...p }))
          : createInitialPieces('even')
      );
      setTurn(
        lastCarried ? (lastCarried.piece.camp === 'red' ? 'black' : 'red') : 'red'
      );
      setFlipped(false);
    } else {
      const initP = createInitialPieces('even');
      setPieces(initP);
      setMainMoves([]);
      setVariationMoves(null);
      setBranchOriginPly(null);
      setCurrentPly(0);
      setTurn('red');
      setFlipped(false);
    }
  }, [
    clearDrillTimer,
    workspace,
    flushStudyPersistence,
    studyBasePieces,
    studyBaseTurn,
    activeMovesList,
    currentPly,
  ]);

  const handleTransferOpeningToStudy = useCallback(() => {
    const base = createInitialPieces('even');
    const openingTitle =
      matchedOpeningNode?.openingName ||
      lastMatchedOpeningInfo?.openingName ||
      '标准开局（定式研习）';
    const openingCat =
      matchedOpeningNode?.category ||
      lastMatchedOpeningInfo?.category ||
      '开局研习';
    handleTransferToStudy({
      basePieces: base,
      baseTurn: 'red',
      currentPieces: pieces,
      currentTurn: turn,
      moves: activeMovesList,
      ply: currentPly,
      targetRightTab: 'moves',
      nextMetadata: {
        redPlayer: '红方（定式研习）',
        blackPlayer: '黑方（定式应对）',
        event: `开局研习 · ${openingCat}`,
        opening: openingTitle,
        result: '进行中',
        isFavorite: false,
      },
    });
  }, [
    matchedOpeningNode,
    lastMatchedOpeningInfo,
    handleTransferToStudy,
    pieces,
    turn,
    activeMovesList,
    currentPly,
  ]);

  const handleJumpToOpeningPly = useCallback(
    (ply: number) => handleJumpPly(ply, !!variationMoves),
    [handleJumpPly, variationMoves]
  );

  const handleExitDrill = useCallback(() => {
    clearDrillTimer();
    setHintArrow(null);
    setDrillState((prev) => ({
      ...prev,
      status: 'idle',
      feedback: null,
      expectedMove: null,
    }));
  }, [clearDrillTimer]);

  const handleChangeOpeningSubMode = useCallback(
    (nextMode: OpeningPanelSubMode) => {
      setOpeningSubMode(nextMode);
      if (nextMode === 'explorer') {
        handleExitDrill();
      }
    },
    [handleExitDrill]
  );

  const handleStartDrill = useCallback(
    (preset: OpeningPresetLine, camp: Camp) => {
      clearDrillTimer();
      if (workspace === 'study') {
        flushStudyPersistence();
      }
      const fresh = createInitialPieces('even');
      setWorkspace('opening');
      setOpeningSubMode('drill');
      setSidebarCollapsed(false);
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setRetryMistakePly(null);
      setRetryFeedback(null);
      setIsAnalyzing(false);
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);
      setFlipped(camp === 'black');
      setPieces(fresh);
      setMainMoves([]);
      setVariationMoves(null);
      setBranchOriginPly(null);
      setCurrentPly(0);
      setTurn('red');
      setDrillState({
        presetId: preset.id,
        playerCamp: camp,
        stepIndex: 0,
        attempts: 0,
        mistakes: 0,
        status: 'drilling',
        feedback:
          camp === 'red'
            ? '您执红先手，请在左侧棋盘走出第 1 步。'
            : '您执黑后手，系统正在为您走出对方先手第 1 步…',
        expectedMove: null,
      });
      if (camp === 'black' && preset.moves.length > 0) {
        scheduleDrillOpponentReply(fresh, [], 0, preset, 0, 0);
      }
    },
    [clearDrillTimer, workspace, flushStudyPersistence, scheduleDrillOpponentReply]
  );

  const handleBoardNavNewGame = useCallback(() => {
    if (workspace === 'opening') {
      if (openingSubMode === 'drill' && drillState.status !== 'idle') {
        const activePreset =
          OPENING_PRESETS.find((p) => p.id === drillState.presetId) || OPENING_PRESETS[0];
        handleStartDrill(activePreset, drillState.playerCamp);
      } else {
        handleSwitchWorkspace('opening');
      }
    } else if (workspace === 'play') {
      handleStartHandicapGame(handicap, skillTier);
    } else if (workspace === 'challenge') {
      handleSelectChallenge(currentChallenge.id);
    } else {
      handleNewStudyGame();
    }
  }, [
    workspace,
    openingSubMode,
    drillState.status,
    drillState.presetId,
    drillState.playerCamp,
    handleStartDrill,
    handleSwitchWorkspace,
    handicap,
    skillTier,
    currentChallenge.id,
    handleStartHandicapGame,
    handleSelectChallenge,
    handleNewStudyGame,
  ]);

  const handleApplyOpeningPreset = useCallback(
    (preset: OpeningPresetLine) => {
      clearDrillTimer();
      if (workspace === 'study') {
        flushStudyPersistence();
      }
      setDrillState((prev) => ({ ...prev, status: 'idle', feedback: null, expectedMove: null }));
      const base = createInitialPieces('even');
      const replayed = replayCompactMoves(
        base,
        preset.moves.map((m) => ({ from: m.from, to: m.to })),
        'red'
      );
      setWorkspace('opening');
      setOpeningSubMode('explorer');
      setIsReplaying(false);
      setSelectedPieceId(null);
      setHintArrow(null);
      setHoveredArrow(null);
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);
      setFlipped(false);
      setPieces(replayed.finalPieces);
      setTurn(replayed.finalTurn);
      setMainMoves(replayed.moves);
      setVariationMoves(null);
      setBranchOriginPly(null);
      setCurrentPly(replayed.moves.length);
      setIsAnalyzing(false);
    },
    [clearDrillTimer, workspace, flushStudyPersistence]
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
        result: terminalOutcome ? (terminalOutcome.winner === 'red' ? '红胜' : '黑胜') : '进行中',
        isFavorite: false,
      },
    });
  }, [handleTransferToStudy, currentChallenge, pieces, turn, mainMoves, currentPly, terminalOutcome]);

  const handleTransferPlayToStudy = useCallback(() => {
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
        result: terminalOutcome ? (terminalOutcome.winner === 'red' ? '红胜' : '黑胜') : '进行中',
        isFavorite: false,
      },
    });
  }, [handleTransferToStudy, handicap, skillTier, pieces, turn, mainMoves, currentPly, terminalOutcome]);

  const handleDismissTerminal = useCallback(() => setTerminalDismissed(true), []);
  const handleRestoreTerminal = useCallback(() => setTerminalDismissed(false), []);
  const handleOpenReviewTab = useCallback(() => {
    setRightTab('review');
    setTerminalDismissed(true);
  }, []);

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
    () =>
      activeModal === 'fen-pgn'
        ? piecesToFen(pieces, workspace === 'setup' ? setupTurn : turn)
        : '',
    [activeModal, pieces, workspace, setupTurn, turn]
  );
  const modalBaseFen = useMemo(() => {
    if (activeModal !== 'fen-pgn') return '';
    if (workspace === 'study') {
      return piecesToFen(studyBasePieces, studyBaseTurn);
    }
    if (workspace === 'challenge') {
      return piecesToFen(currentChallenge.pieces(), currentChallenge.initialTurn);
    }
    if (workspace === 'play') {
      return piecesToFen(
        createInitialPieces(handicap),
        handicap === 'move-first' ? 'black' : 'red'
      );
    }
    if (workspace === 'opening') {
      return INITIAL_FEN;
    }
    return modalFen;
  }, [
    activeModal,
    workspace,
    studyBasePieces,
    studyBaseTurn,
    currentChallenge,
    handicap,
    modalFen,
  ]);
  const modalPgn = useMemo(
    () =>
      activeModal === 'fen-pgn'
        ? formatGameToPgn(metadata, activeMovesList, modalBaseFen || modalFen)
        : '',
    [activeModal, metadata, activeMovesList, modalBaseFen, modalFen]
  );

  const {
    canBoardNewGame,
    newGameDisabledReason,
    canBoardUndo,
    undoDisabledReason,
    canBoardHint,
    hintDisabledReason,
  } = useMemo(() => {
    if (workspace === 'setup') {
      return {
        canBoardNewGame: false,
        newGameDisabledReason: '摆子模式请在右侧面板重置棋盘',
        canBoardUndo: false,
        undoDisabledReason: '摆子模式不支持悔棋',
        canBoardHint: false,
        hintDisabledReason: '摆子模式不支持支招',
      };
    }

    let nextCanNew = true;
    let nextNewReason = '';
    if (workspace === 'study') {
      const isFreshStd =
        mainMoves.length === 0 &&
        !variationMoves &&
        piecesToFen(studyBasePieces, studyBaseTurn) === INITIAL_FEN;
      if (isFreshStd) {
        nextCanNew = false;
        nextNewReason = '当前已是32子标准开局，无需重开';
      }
    } else if (workspace === 'opening') {
      if (openingSubMode === 'drill') {
        if (drillState.status === 'idle') {
          nextCanNew = false;
          nextNewReason = '尚未开始对练，无需重开';
        }
      } else if (mainMoves.length === 0 && !variationMoves) {
        nextCanNew = false;
        nextNewReason = '当前已是开局初始状态';
      }
    } else if (workspace === 'challenge') {
      if (currentPly === 0 && mainMoves.length === 0 && !variationMoves) {
        nextCanNew = false;
        nextNewReason = '尚未走子，无需重摆当前残局';
      }
    } else if (workspace === 'play') {
      if (currentPly === 0 && mainMoves.length === 0 && !variationMoves) {
        nextCanNew = false;
        nextNewReason = '尚未走子，无需重开对局';
      }
    }

    let nextCanUndo = true;
    let nextUndoReason = '';
    if (isBotThinking) {
      nextCanUndo = false;
      nextUndoReason = '电脑正在思考应手，请稍候';
    } else if (currentPly <= 0) {
      nextCanUndo = false;
      nextUndoReason = '当前处于起始步，暂无可悔着法';
    }

    let nextCanHint = true;
    let nextHintReason = '';
    if (isBotThinking) {
      nextCanHint = false;
      nextHintReason = '电脑正在思考应手，请稍候';
    } else if (!hasLegalMovesCurrentTurn) {
      nextCanHint = false;
      nextHintReason = '当前局面已终局（绝杀/困毙），无可支着法';
    } else if (workspace === 'study' && primaryEngine.status !== 'ready') {
      nextCanHint = false;
      nextHintReason =
        primaryEngine.status === 'installing'
          ? '主引擎正在安装，就绪后即可支招'
          : '主引擎未安装，请先安装引擎后再支招';
    } else if (
      workspace === 'opening' &&
      openingSubMode === 'drill' &&
      drillState.status === 'completed'
    ) {
      nextCanHint = false;
      nextHintReason = '本套定式对练已通关';
    }

    return {
      canBoardNewGame: nextCanNew,
      newGameDisabledReason: nextNewReason,
      canBoardUndo: nextCanUndo,
      undoDisabledReason: nextUndoReason,
      canBoardHint: nextCanHint,
      hintDisabledReason: nextHintReason,
    };
  }, [
    workspace,
    mainMoves.length,
    variationMoves,
    studyBasePieces,
    studyBaseTurn,
    openingSubMode,
    drillState.status,
    currentPly,
    isBotThinking,
    hasLegalMovesCurrentTurn,
    primaryEngine.status,
  ]);

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
        onOpenModal={handleTitlebarOpenModal}
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
                  workspace === 'opening'
                    ? openingSubMode === 'drill' && drillState.status !== 'idle'
                      ? drillState.playerCamp === topCamp
                        ? '我方（定式对练）'
                        : '陪练定式体系'
                      : topCamp === 'black'
                      ? '黑方（定式应对）'
                      : '红方（定式先手）'
                    : workspace === 'challenge'
                    ? currentChallenge.sourceBook
                    : workspace === 'play'
                    ? '电脑引擎'
                    : topCamp === 'black'
                    ? metadata.blackPlayer
                    : metadata.redPlayer
                }
                subtitle={
                  workspace === 'opening'
                    ? matchedOpeningNode?.category || lastMatchedOpeningInfo?.category || '开局研习'
                    : workspace === 'challenge'
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
                multiPvArrows={workspace === 'study' ? boardArrows.primaryArrows : []}
                secondaryPvArrow={workspace === 'study' ? boardArrows.secondaryArrow : null}
                threatArrow={workspace === 'study' ? threatArrow : null}
                hoveredArrow={isOpeningDrillSpoilerFree ? null : hoveredArrow}
                hintArrow={hintArrow}
                impactEffect={impactEffect}
                redCheckPos={checkPositions.redCheckPos}
                blackCheckPos={checkPositions.blackCheckPos}
                checkAttackLines={checkAttackLines}
                checkSealEffect={checkSealEffect}
                illegalCheckCamp={illegalCheckCamp}
                terminalOutcome={terminalOutcome}
                terminalDismissed={terminalDismissed}
                onDismissTerminal={handleDismissTerminal}
                onRestoreTerminal={handleRestoreTerminal}
                onTerminalPrimaryAction={
                  workspace === 'study'
                    ? handleOpenReviewTab
                    : workspace === 'opening'
                    ? handleTransferOpeningToStudy
                    : workspace === 'challenge'
                    ? handleTransferChallengeToStudy
                    : workspace === 'play'
                    ? handleTransferPlayToStudy
                    : undefined
                }
                terminalPrimaryLabel={workspace === 'study' ? '复盘报告' : '转入复盘分析'}
                onTerminalRestartAction={handleBoardNavNewGame}
                terminalRestartLabel={
                  workspace === 'challenge'
                    ? '重摆此关'
                    : workspace === 'play'
                    ? '再来一局'
                    : '新开一局'
                }
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
                  workspace === 'opening'
                    ? openingSubMode === 'drill' && drillState.status !== 'idle'
                      ? drillState.playerCamp === bottomCamp
                        ? '我方（定式对练）'
                        : '陪练定式体系'
                      : bottomCamp === 'red'
                      ? '红方（定式先手）'
                      : '黑方（定式应对）'
                    : workspace === 'challenge'
                    ? '挑战者（红方）'
                    : workspace === 'play'
                    ? '玩家（红方）'
                    : bottomCamp === 'red'
                    ? metadata.redPlayer
                    : metadata.blackPlayer
                }
                subtitle={
                  workspace === 'opening'
                    ? matchedOpeningNode?.openingName || lastMatchedOpeningInfo?.openingName
                    : workspace === 'challenge'
                    ? currentChallenge.title
                    : undefined
                }
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
              hideReplay={isOpeningDrillSpoilerFree}
              canNewGame={canBoardNewGame}
              newGameDisabledReason={newGameDisabledReason}
              canUndo={canBoardUndo}
              undoDisabledReason={undoDisabledReason}
              canHint={canBoardHint}
              hintDisabledReason={hintDisabledReason}
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
            {workspace === 'opening' ? (
              /* 独立「开局研习」专属工作台（定式树探索 + 7套经典骨架 + 变例防剧透对练 + 携带转入复盘） */
              <OpeningBookPanel
                mode="full"
                turn={turn}
                currentPly={currentPly}
                activeMoves={activeMovesList}
                matchedNode={matchedOpeningNode}
                lastMatchedInfo={lastMatchedOpeningInfo}
                matchedLibraryCount={matchedLibraryCount}
                activeMatchKeyword={activeMatchKeyword}
                subMode={openingSubMode}
                drillState={drillState}
                drillProgressMap={drillProgressMap}
                onChangeSubMode={handleChangeOpeningSubMode}
                onSelectOpeningMove={executeMoveOnBoard}
                onHoverOpeningMove={setHoveredArrow}
                onJumpToPly={handleJumpToOpeningPly}
                onApplyOpeningPreset={handleApplyOpeningPreset}
                onOpenMatchingLibrary={handleOpenMatchingLibrary}
                onStartDrill={handleStartDrill}
                onShowDrillHint={handleShowDrillHint}
                onExitDrill={handleExitDrill}
                onTransferOpeningToStudy={handleTransferOpeningToStudy}
              />
            ) : workspace === 'challenge' ? (
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
                    onClick={handleTransferPlayToStudy}
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
              /* 默认「复盘分析」三页签：回合棋谱 ↔ 复盘报告 ↔ 定式查询（轻量化） */
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
                      <span>定式查询</span>
                    </button>
                  </div>
                </div>

                {/* 复盘工作台常驻：实时定式识别条与「同开局名局」/「去开局研习」双联动 */}
                <div className="px-3.5 py-1.5 border-b xq-border bg-[var(--xq-bg-canvas)]/75 flex items-center justify-between gap-2 text-[11px] shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenOpeningTab}
                    className="flex-1 min-w-0 text-left flex items-center gap-1.5 cursor-pointer group"
                    title="点击查看当前盘面流行定式分支"
                  >
                    <BookMarked className="w-3 h-3 text-[var(--xq-accent-gold)] shrink-0" />
                    <span className="xq-text-muted shrink-0">定式</span>
                    <span className="font-serif-sc font-semibold xq-text-primary group-hover:text-[var(--xq-accent-gold)] truncate transition-colors">
                      {matchedOpeningNode
                        ? matchedOpeningNode.openingName
                        : lastMatchedOpeningInfo
                        ? `${lastMatchedOpeningInfo.openingName}（脱谱）`
                        : '标准布局 · 自由拆棋'}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeMatchKeyword && (
                      <button
                        type="button"
                        onClick={() => handleOpenMatchingLibrary(activeMatchKeyword)}
                        className="text-[var(--xq-accent-gold)] hover:underline cursor-pointer whitespace-nowrap font-mono-tabular"
                      >
                        同开局名局 ({matchedLibraryCount})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleGoToOpeningWorkspace}
                      className="xq-text-secondary hover:text-[var(--xq-accent-gold)] cursor-pointer whitespace-nowrap"
                    >
                      去精练 →
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
                    canSaveToLibrary={canSaveCurrentGame}
                    isExistingUserSave={isExistingUserSave}
                    isLibraryLinked={!!activeLibraryGame}
                    onOpenOpeningTab={handleGoToOpeningWorkspace}
                    onLoadSampleGame={handleLoadSampleMasterGame}
                    onOpenImportModal={handleOpenImportModal}
                    onOpenExportModal={handleOpenExportModal}
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
                    mode="compact"
                    turn={turn}
                    currentPly={currentPly}
                    activeMoves={activeMovesList}
                    matchedNode={matchedOpeningNode}
                    lastMatchedInfo={lastMatchedOpeningInfo}
                    matchedLibraryCount={matchedLibraryCount}
                    activeMatchKeyword={activeMatchKeyword}
                    subMode="explorer"
                    drillState={drillState}
                    drillProgressMap={drillProgressMap}
                    onChangeSubMode={handleChangeOpeningSubMode}
                    onSelectOpeningMove={executeMoveOnBoard}
                    onHoverOpeningMove={setHoveredArrow}
                    onJumpToPly={handleJumpToOpeningPly}
                    onApplyOpeningPreset={handleApplyOpeningPreset}
                    onOpenMatchingLibrary={handleOpenMatchingLibrary}
                    onStartDrill={handleStartDrill}
                    onShowDrillHint={handleShowDrillHint}
                    onExitDrill={handleExitDrill}
                    onGoToOpeningWorkspace={handleGoToOpeningWorkspace}
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
        terminalOutcome={terminalOutcome}
        illegalMoveWarning={illegalMoveWarning}
        isVariationActive={!!variationMoves}
        isOpeningDrillActive={isOpeningDrillSpoilerFree}
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
        exportBaseFen={modalBaseFen}
        exportMoves={activeMovesList}
        initialFenPgnTab={fenPgnInitialTab}
        metadata={metadata}
        libraryGames={libraryGames}
        initialLibrarySearch={initialLibrarySearch}
        onClose={handleCloseModal}
        onOpenModal={setActiveModal}
        onSwitchWorkspace={handleSwitchWorkspace}
        onOpenOpeningBook={handleGoToOpeningWorkspace}
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
              isFavorite: false,
            },
          });
          return true;
        }}
        onApplyPgnSession={(pgnText, fenFallback) => {
          const session = parsePgnTextToSession(pgnText, fenFallback);
          if (!session) return false;
          handleTransferToStudy({
            basePieces: session.basePieces,
            baseTurn: session.baseTurn,
            currentPieces: session.finalPieces,
            currentTurn: session.finalTurn,
            moves: session.moves,
            ply: session.moves.length,
            nextMetadata: {
              opening: session.moves.length > 0 ? '导入 PGN 棋谱' : '导入 FEN 局面',
              ...session.metadata,
              isFavorite: false,
            },
          });
          return true;
        }}
        onSaveMetadata={setMetadata}
        onSaveCurrentGameToLibrary={handleSaveCurrentGameToLibrary}
        canSaveCurrentGame={canSaveCurrentGame}
        isExistingUserSave={isExistingUserSave}
        onExportLibraryGame={handleExportLibraryGame}
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
              libraryGameId: game.id,
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
                libraryGameId: game.id,
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
            libraryGameId: game.id,
          });
        }}
        onToggleLibraryFavorite={(id) => {
          let nextFavState: boolean | null = null;
          setLibraryGames((prev) =>
            prev.map((g) => {
              if (g.id !== id) return g;
              nextFavState = !g.isFavorite;
              return { ...g, isFavorite: nextFavState };
            })
          );
          if (id === activeLibraryGameId && nextFavState !== null) {
            const syncedFav = nextFavState;
            setMetadata((prev) => ({ ...prev, isFavorite: syncedFav }));
          }
        }}
        onDeleteLibraryGame={(id) => {
          setLibraryGames((prev) => prev.filter((g) => g.id !== id));
          if (id === activeLibraryGameId) {
            setActiveLibraryGameId(null);
            setMetadata((prev) => ({ ...prev, isFavorite: false }));
          }
        }}
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
          if (next.connected) {
            setWorkspace('study');
            if (next.autoAnalyze) {
              setIsAnalyzing(true);
            }
          }
        }}
        onTriggerHint={handleTriggerHint}
      />
    </div>
  );
}
