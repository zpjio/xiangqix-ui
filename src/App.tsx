/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightCircle,
  Award,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Pause,
  Play,
  Scale,
  Swords,
  Upload,
  X,
} from 'lucide-react';
import { Board } from './components/Board';
import { BoardNav } from './components/BoardNav';
import { ChallengeWorkbench } from './components/ChallengeWorkbench';
import { DialogsModalSuite } from './components/DialogsModalSuite';
import { EnginePanel, EngineStreamTelemetry } from './components/EnginePanel';
import { EvalBar } from './components/EvalBar';
import { GameReviewPanel } from './components/GameReviewPanel';
import { MoveList } from './components/MoveList';
import { OpeningBookPanel } from './components/OpeningBookPanel';
import { PlayerSeatBar } from './components/PlayerSeatBar';
import { SetupWorkbench } from './components/SetupWorkbench';
import { StatusBar } from './components/StatusBar';
import { Titlebar } from './components/Titlebar';
import { CLASSICAL_CHALLENGES } from './data/catalogRegistry';
import { countMatchingLibraryGames, lookupOpeningBookNode, OPENING_PRESETS } from './data/openingBook';
import {
  CHESS_CLOCK_PRESETS,
  DEFAULT_ENGINE_PROFILES,
  DEFAULT_STUDY_METADATA,
  getMoveQualityAccuracyScore,
  INITIAL_FEN,
  PIECE_QUOTA_BY_TYPE,
  SAMPLE_MASTER_METADATA,
} from './constants/xiangqiConstants';
import {
  ActiveModalId,
  AppTheme,
  BatchReviewPreset,
  BatchReviewProgressEvent,
  BoardAnnotationSnapshot,
  BoardTheme,
  Camp,
  CheckSealEffect,
  ChessClockPresetId,
  CompactLibraryMove,
  EngineProfile,
  EngineProtocol,
  EngineSearchMode,
  EngineSkillTier,
  ExternalConnectState,
  FontScale,
  FontScheme,
  GameMetadata,
  GameTerminalState,
  HandicapType,
  ImpactEffect,
  LibraryBackupImportStrategy,
  LibraryGameItem,
  MoveNag,
  MoveRecord,
  MultiPVArrow,
  MultiPVLine,
  OpeningBookCategory,
  OpeningDrillProgress,
  OpeningDrillRuntime,
  OpeningPanelSubMode,
  OpeningPresetLine,
  ParsedImportSession,
  Piece,
  PieceCraftStyle,
  PieceType,
  PlayOpponentMode,
  Position,
  WorkspaceMode,
} from './types/xiangqi';
import {
  applyBatchReviewToMoves,
  BatchReviewHandle,
  startSimulatedBatchReview,
  startSimulatedEngineStream,
  StreamEngineHandle,
} from './utils/engineSimulation';
import { mergeLibraryBackupGames, parseImportedGameFile } from './utils/fileImportExport';
import { selectBotPlayMove } from './utils/playBotEngine';
import { parseShareHashFromLocation } from './utils/shareExport';
import {
  playCheckChimeSound,
  playCheckmateGongSound,
  playClockWarningTickSound,
  playInvalidWarningSound,
  playWoodClackSound,
} from './utils/soundEffects';
import {
  readStoredLibraryGames,
  readStoredOpeningDrillProgress,
  readStoredPrefs,
  readStoredSolvedChallenges,
  readStoredStudySession,
  StoredStudySession,
  writeStoredLibraryGames,
  writeStoredOpeningDrillProgress,
  writeStoredPrefs,
  writeStoredSolvedChallenges,
  writeStoredStudySession,
} from './utils/storage';
import {
  buildBoardGrid,
  calculateMaterialAndCaptures,
  computeDrawRuleStatus,
  createInitialPieces,
  createKingsOnlyPieces,
  createSampleSessionMoves,
  downloadTextFile,
  evaluateBoardScore,
  formatChineseMoveNotation,
  formatGameToPgn,
  generateSimulatedMultiPV,
  getCheckingAttackers,
  getLegalMovesForPiece,
  getPieceAt,
  getPieceAtGrid,
  getSafeLegalMovesForPiece,
  hasAnyLegalMoves,
  isCampInCheck,
  isSetupPiecePlacementAllowed,
  parseFenToPieces,
  parsePgnTextToSession,
  piecesToFen,
  replayCompactMoves,
  sanitizeExportFilename,
  validateSetupPosition,
} from './utils/xiangqiRules';

export default function App() {
  const initialPrefs = useMemo(() => readStoredPrefs(), []);
  const initialShareParsed = useMemo(() => parseShareHashFromLocation(), []);
  const initialStudy = useMemo(
    () => (initialShareParsed.session ? null : readStoredStudySession()),
    [initialShareParsed.session]
  );

  // ==================== 1. 全局外观与主题状态 ====================
  const [appTheme, setAppTheme] = useState<AppTheme>(() =>
    initialPrefs.appTheme === 'light' ||
    initialPrefs.appTheme === 'eyecare' ||
    initialPrefs.appTheme === 'dark'
      ? initialPrefs.appTheme
      : 'dark'
  );
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
  const [showBoardCoordinates, setShowBoardCoordinates] = useState<boolean>(
    initialPrefs.showBoardCoordinates ?? true
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
    () =>
      initialShareParsed.session?.basePieces ||
      initialStudy?.basePieces ||
      createInitialPieces('even')
  );
  const [studyBaseTurn, setStudyBaseTurn] = useState<Camp>(
    () => initialShareParsed.session?.baseTurn || initialStudy?.baseTurn || 'red'
  );
  const [mainMoves, setMainMoves] = useState<MoveRecord[]>(
    () => initialShareParsed.session?.moves || initialStudy?.mainMoves || []
  );
  const [variationMoves, setVariationMoves] = useState<MoveRecord[] | null>(
    () => (initialShareParsed.session ? null : initialStudy?.variationMoves || null)
  );
  const [branchOriginPly, setBranchOriginPly] = useState<number | null>(
    () => (initialShareParsed.session ? null : initialStudy?.branchOriginPly ?? null)
  );
  const [currentPly, setCurrentPly] = useState<number>(
    () => initialShareParsed.session?.ply ?? initialStudy?.currentPly ?? 0
  );
  const [pieces, setPieces] = useState<Piece[]>(
    () =>
      initialShareParsed.session?.currentPieces ||
      initialStudy?.pieces ||
      createInitialPieces('even')
  );
  const [turn, setTurn] = useState<Camp>(
    () => initialShareParsed.session?.currentTurn || initialStudy?.turn || 'red'
  );
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [impactEffect, setImpactEffect] = useState<ImpactEffect | null>(null);
  const [checkSealEffect, setCheckSealEffect] = useState<CheckSealEffect | null>(null);
  const [illegalCheckCamp, setIllegalCheckCamp] = useState<Camp | null>(null);
  const [illegalMoveWarning, setIllegalMoveWarning] = useState<string | null>(null);
  const [terminalDismissed, setTerminalDismissed] = useState<boolean>(false);
  const [flipped, setFlipped] = useState<boolean>(
    () => initialShareParsed.session?.flipped ?? initialStudy?.flipped ?? false
  );

  // 多引擎注册表与双擎并行对比状态（预置皮卡鱼 UCI、旋风 UCI、天机 UCCI 三大引擎）
  const [engines, setEngines] = useState<EngineProfile[]>(() =>
    DEFAULT_ENGINE_PROFILES.map((eng) => ({ ...eng }))
  );
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
  const [engineSearchMode, setEngineSearchMode] = useState<EngineSearchMode>(
    initialPrefs.engineSearchMode || 'depth'
  );
  const [engineMoveTimeMs, setEngineMoveTimeMs] = useState<3000 | 5000>(
    initialPrefs.engineMoveTimeMs || 3000
  );
  const [streamTelemetry, setStreamTelemetry] = useState<EngineStreamTelemetry>({
    phase: 'idle',
    currentDepth: 0,
    selDepth: 0,
    nodes: 0,
    nps: 0,
    elapsedMs: 0,
    cacheHit: false,
  });
  const [primaryStreamResult, setPrimaryStreamResult] = useState<{
    fen: string;
    lines: MultiPVLine[];
    arrows: MultiPVArrow[];
    threatArrow: MultiPVArrow | null;
  }>({ fen: '', lines: [], arrows: [], threatArrow: null });
  const [secondaryStreamResult, setSecondaryStreamResult] = useState<{
    fen: string;
    lines: MultiPVLine[];
  }>({ fen: '', lines: [] });
  const searchSessionIdRef = useRef<number>(0);
  const primaryStreamRef = useRef<StreamEngineHandle | null>(null);
  const secondaryStreamRef = useRef<StreamEngineHandle | null>(null);

  // 一键整局自动复盘状态
  const [batchReviewPreset, setBatchReviewPreset] = useState<BatchReviewPreset>('fast');
  const [batchReviewProgress, setBatchReviewProgress] =
    useState<BatchReviewProgressEvent | null>(null);
  const [hasScannedCurrentGame, setHasScannedCurrentGame] = useState<boolean>(false);
  const batchReviewHandleRef = useRef<BatchReviewHandle | null>(null);
  const batchReviewIdRef = useRef<number>(0);
  const pendingAutoBatchReviewRef = useRef<BatchReviewPreset | null>(null);

  // 跨工作台文件拖拽导入、#share= 看谱提示与内联通知状态
  const [isRootFileDragging, setIsRootFileDragging] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);
  const [pendingDroppedBackup, setPendingDroppedBackup] = useState<{
    fileName: string;
    games: LibraryGameItem[];
  } | null>(null);
  const [shareBannerDismissed, setShareBannerDismissed] = useState<boolean>(false);
  const [importBannerMessage, setImportBannerMessage] = useState<string | null>(null);

  const [threatRadarEnabled, setThreatRadarEnabled] = useState<boolean>(false);
  const [hoveredArrow, setHoveredArrow] = useState<MultiPVArrow | null>(null);
  const [hintArrow, setHintArrow] = useState<MultiPVArrow | null>(null);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const installIntervalsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const intervals = installIntervalsRef.current;
    return () => {
      intervals.forEach((timerId) => window.clearInterval(timerId));
      intervals.clear();
    };
  }, []);

  const handleInstallEngine = useCallback((targetId: string) => {
    const existingTimer = installIntervalsRef.current.get(targetId);
    if (existingTimer !== undefined) {
      window.clearInterval(existingTimer);
      installIntervalsRef.current.delete(targetId);
    }
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
          installIntervalsRef.current.delete(targetId);
          return prev;
        }
        if (target.installProgress >= 92) {
          window.clearInterval(timer);
          installIntervalsRef.current.delete(targetId);
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
    installIntervalsRef.current.set(targetId, timer);
  }, []);

  const handleResetEngineMissing = useCallback((targetId: string) => {
    const existingTimer = installIntervalsRef.current.get(targetId);
    if (existingTimer !== undefined) {
      window.clearInterval(existingTimer);
      installIntervalsRef.current.delete(targetId);
    }
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

  // 对弈实战（人机自选执红/执黑、本地双人、传统让子）与包干加秒棋钟状态
  const [playOpponentMode, setPlayOpponentMode] = useState<PlayOpponentMode>('ai');
  const [playHumanCamp, setPlayHumanCamp] = useState<Camp>('red');
  const [handicap, setHandicap] = useState<HandicapType>('even');
  const [skillTier, setSkillTier] = useState<EngineSkillTier>('grandmaster');
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [manualTerminalOutcome, setManualTerminalOutcome] =
    useState<GameTerminalState | null>(null);
  const [dismissedDrawClaimKey, setDismissedDrawClaimKey] = useState<string | null>(null);
  const [playActionNotice, setPlayActionNotice] = useState<string | null>(null);
  const [hasBoardAnnotations, setHasBoardAnnotations] = useState<boolean>(false);
  const [boardAnnotations, setBoardAnnotations] = useState<BoardAnnotationSnapshot>({
    arrows: [],
    circles: [],
  });
  const [clearAnnotationsNonce, setClearAnnotationsNonce] = useState<number>(0);

  const getPlaySetupConfig = useCallback(
    (mode: PlayOpponentMode, humanCamp: Camp, targetHandicap: HandicapType) => {
      const aiCamp: Camp | null =
        mode === 'ai' ? (humanCamp === 'red' ? 'black' : 'red') : null;
      const concededBy: Camp = mode === 'ai' && humanCamp === 'black' ? 'red' : 'black';
      const baseTurn: Camp = targetHandicap === 'move-first' ? 'black' : 'red';
      return {
        aiCamp,
        concededBy,
        baseTurn,
        createBasePieces: () => createInitialPieces(targetHandicap, concededBy),
      };
    },
    []
  );

  const [clockPresetId, setClockPresetId] = useState<ChessClockPresetId>(
    () => initialPrefs.clockPresetId || 'none'
  );
  const activeClockPreset = useMemo(
    () => CHESS_CLOCK_PRESETS.find((p) => p.id === clockPresetId) || CHESS_CLOCK_PRESETS[0],
    [clockPresetId]
  );
  const [clockRedMs, setClockRedMs] = useState<number>(() => {
    const preset =
      CHESS_CLOCK_PRESETS.find((p) => p.id === (initialPrefs.clockPresetId || 'none')) ||
      CHESS_CLOCK_PRESETS[0];
    return preset.initialMs;
  });
  const [clockBlackMs, setClockBlackMs] = useState<number>(() => {
    const preset =
      CHESS_CLOCK_PRESETS.find((p) => p.id === (initialPrefs.clockPresetId || 'none')) ||
      CHESS_CLOCK_PRESETS[0];
    return preset.initialMs;
  });
  const [clockPaused, setClockPaused] = useState<boolean>(false);
  const lastClockTickSecRef = useRef<{ camp: Camp; sec: number } | null>(null);
  const clockRedMsRef = useRef<number>(clockRedMs);
  const clockBlackMsRef = useRef<number>(clockBlackMs);

  useEffect(() => {
    clockRedMsRef.current = clockRedMs;
  }, [clockRedMs]);

  useEffect(() => {
    clockBlackMsRef.current = clockBlackMs;
  }, [clockBlackMs]);

  const resetClocksForPreset = useCallback(
    (targetId: ChessClockPresetId = clockPresetId) => {
      const preset = CHESS_CLOCK_PRESETS.find((p) => p.id === targetId) || CHESS_CLOCK_PRESETS[0];
      clockRedMsRef.current = preset.initialMs;
      clockBlackMsRef.current = preset.initialMs;
      setClockRedMs(preset.initialMs);
      setClockBlackMs(preset.initialMs);
      setClockPaused(false);
      lastClockTickSecRef.current = null;
    },
    [clockPresetId]
  );

  // 摆子工坊状态
  const [setupSelectedTemplate, setSetupSelectedTemplate] = useState<{
    camp: Camp;
    type: PieceType;
  } | null>({ camp: 'red', type: 'chariot' });
  const [setupTurn, setSetupTurn] = useState<Camp>('red');
  const [setupPlacementError, setSetupPlacementError] = useState<string | null>(null);

  // 对局名录与弹窗状态
  const [metadata, setMetadata] = useState<GameMetadata>(() =>
    initialShareParsed.session
      ? { ...DEFAULT_STUDY_METADATA, ...initialShareParsed.session.metadata }
      : initialStudy?.metadata || DEFAULT_STUDY_METADATA
  );
  const [libraryGames, setLibraryGames] = useState<LibraryGameItem[]>(() =>
    readStoredLibraryGames()
  );
  const [activeLibraryGameId, setActiveLibraryGameId] = useState<string | null>(
    () => (initialShareParsed.session ? null : initialStudy?.activeLibraryGameId ?? null)
  );
  const [activeModal, setActiveModal] = useState<ActiveModalId>(null);
  const [fenPgnInitialTab, setFenPgnInitialTab] = useState<'import' | 'export'>('import');
  const [initialLibrarySearch, setInitialLibrarySearch] = useState<string | null>(null);

  useEffect(() => {
    if (!initialShareParsed.hadShareParam) return;
    if (!initialShareParsed.session) {
      setIllegalMoveWarning('分享链接无效或已损坏，已恢复本地复盘工作台');
    }
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // Ignore history restriction
    }
  }, [initialShareParsed]);

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
  const botReplyTimerRef = useRef<number | null>(null);

  const clearDrillTimer = useCallback(() => {
    if (drillReplyTimerRef.current !== null) {
      window.clearTimeout(drillReplyTimerRef.current);
      drillReplyTimerRef.current = null;
    }
  }, []);

  const clearBotReplyTimer = useCallback(() => {
    if (botReplyTimerRef.current !== null) {
      window.clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }
    setIsBotThinking(false);
  }, []);

  useEffect(() => {
    return () => {
      clearDrillTimer();
      clearBotReplyTimer();
    };
  }, [clearDrillTimer, clearBotReplyTimer]);

  // 自动防抖持久化「复盘分析」当前会话，并在页面隐藏/卸载前立即落盘
  const latestStudyPayloadRef = useRef<StoredStudySession | null>(null);
  const studyPersistTimerRef = useRef<number | null>(null);

  const flushStudyPersistence = useCallback(() => {
    if (studyPersistTimerRef.current !== null) {
      window.clearTimeout(studyPersistTimerRef.current);
      studyPersistTimerRef.current = null;
    }
    if (!latestStudyPayloadRef.current) return;
    writeStoredStudySession(latestStudyPayloadRef.current);
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
      writeStoredStudySession(latestStudyPayloadRef.current);
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
    writeStoredPrefs({
      appTheme,
      fontScale,
      soundEnabled,
      boardTheme,
      craftStyle,
      useTraditionalChar,
      showBoardCoordinates,
      primaryEngineId,
      secondaryEngineId,
      compareMode,
      multiPvCount,
      engineDepth,
      engineThreads,
      engineHashMb,
      engineSearchMode,
      engineMoveTimeMs,
      clockPresetId,
    });
  }, [
    appTheme,
    fontScale,
    soundEnabled,
    boardTheme,
    craftStyle,
    useTraditionalChar,
    showBoardCoordinates,
    primaryEngineId,
    secondaryEngineId,
    compareMode,
    multiPvCount,
    engineDepth,
    engineThreads,
    engineHashMb,
    engineSearchMode,
    engineMoveTimeMs,
    clockPresetId,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeStoredLibraryGames(libraryGames);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [libraryGames]);

  useEffect(() => {
    writeStoredSolvedChallenges(solvedChallengeIds);
  }, [solvedChallengeIds]);

  useEffect(() => {
    writeStoredOpeningDrillProgress(drillProgressMap);
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

  // 流式渐进思考调度：按当前 FEN + 模式（限深/限时/无限）+ LRU 会话缓存异步推进
  const currentStudyPositionFen = useMemo(
    () => (workspace === 'study' ? piecesToFen(pieces, turn) : ''),
    [workspace, pieces, turn]
  );

  useEffect(() => {
    if (primaryStreamRef.current) {
      primaryStreamRef.current.stop();
      primaryStreamRef.current = null;
    }

    if (workspace !== 'study' || !isAnalyzing || primaryEngine.status !== 'ready') {
      setStreamTelemetry((prev) => ({
        ...prev,
        phase: !isAnalyzing ? 'stopped' : 'idle',
      }));
      return;
    }

    const targetFen = currentStudyPositionFen;
    const sessionId = `pri-${++searchSessionIdRef.current}`;

    const debounceTimer = window.setTimeout(() => {
      primaryStreamRef.current = startSimulatedEngineStream(
        {
          sessionId,
          fen: targetFen,
          engineId: primaryEngine.id,
          mode: engineSearchMode,
          targetDepth: engineDepth,
          moveTimeMs: engineMoveTimeMs,
          multiPvCount,
          threads: engineThreads,
          hashMb: engineHashMb,
        },
        primaryEngine.styleBias,
        threatRadarEnabled,
        (ev) => {
          setStreamTelemetry({
            phase: ev.phase,
            currentDepth: ev.currentDepth,
            selDepth: ev.selDepth,
            nodes: ev.nodes,
            nps: ev.nps,
            elapsedMs: ev.elapsedMs,
            cacheHit: ev.cacheHit,
          });
          setPrimaryStreamResult({
            fen: targetFen,
            lines: ev.lines,
            arrows: ev.arrows,
            threatArrow:
              (ev as typeof ev & { threatArrow?: MultiPVArrow }).threatArrow || null,
          });
        }
      );
    }, 55);

    return () => {
      window.clearTimeout(debounceTimer);
      if (primaryStreamRef.current) {
        primaryStreamRef.current.stop();
        primaryStreamRef.current = null;
      }
    };
  }, [
    workspace,
    isAnalyzing,
    primaryEngine.id,
    primaryEngine.status,
    primaryEngine.styleBias,
    currentStudyPositionFen,
    engineSearchMode,
    engineDepth,
    engineMoveTimeMs,
    multiPvCount,
    engineThreads,
    engineHashMb,
    threatRadarEnabled,
  ]);

  useEffect(() => {
    if (secondaryStreamRef.current) {
      secondaryStreamRef.current.stop();
      secondaryStreamRef.current = null;
    }

    if (
      workspace !== 'study' ||
      !isAnalyzing ||
      !compareMode ||
      secondaryEngine.status !== 'ready'
    ) {
      return;
    }

    const targetFen = currentStudyPositionFen;
    const sessionId = `sec-${++searchSessionIdRef.current}`;

    const debounceTimer = window.setTimeout(() => {
      secondaryStreamRef.current = startSimulatedEngineStream(
        {
          sessionId,
          fen: targetFen,
          engineId: secondaryEngine.id,
          mode: engineSearchMode,
          targetDepth: engineDepth,
          moveTimeMs: engineMoveTimeMs,
          multiPvCount: 2,
          threads: engineThreads,
          hashMb: engineHashMb,
        },
        secondaryEngine.styleBias,
        false,
        (ev) => {
          setSecondaryStreamResult({
            fen: targetFen,
            lines: ev.lines,
          });
        }
      );
    }, 65);

    return () => {
      window.clearTimeout(debounceTimer);
      if (secondaryStreamRef.current) {
        secondaryStreamRef.current.stop();
        secondaryStreamRef.current = null;
      }
    };
  }, [
    workspace,
    isAnalyzing,
    compareMode,
    secondaryEngine.id,
    secondaryEngine.status,
    secondaryEngine.styleBias,
    currentStudyPositionFen,
    engineSearchMode,
    engineDepth,
    engineMoveTimeMs,
    engineThreads,
    engineHashMb,
  ]);

  const analysisMatchesCurrent =
    workspace === 'study' &&
    isAnalyzing &&
    primaryEngine.status === 'ready' &&
    primaryStreamResult.fen === currentStudyPositionFen;

  const multiPvData = useMemo(() => {
    if (primaryEngine.status !== 'ready' || !isAnalyzing || workspace !== 'study') {
      return { lines: [] as MultiPVLine[], arrows: [] as MultiPVArrow[] };
    }
    return {
      lines: primaryStreamResult.lines,
      arrows: primaryStreamResult.arrows,
    };
  }, [primaryEngine.status, isAnalyzing, workspace, primaryStreamResult]);

  const secondaryMultiPvData = useMemo(() => {
    if (
      !compareMode ||
      secondaryEngine.status !== 'ready' ||
      !isAnalyzing ||
      workspace !== 'study'
    ) {
      return { lines: [] as MultiPVLine[], arrows: [] as MultiPVArrow[] };
    }
    return {
      lines: secondaryStreamResult.lines,
      arrows: [] as MultiPVArrow[],
    };
  }, [compareMode, secondaryEngine.status, isAnalyzing, workspace, secondaryStreamResult]);

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
    const secTop =
      secondaryStreamResult.fen === currentStudyPositionFen
        ? secondaryMultiPvData.lines[0]
        : undefined;
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
    secondaryStreamResult.fen,
    currentStudyPositionFen,
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
    return primaryStreamResult.threatArrow;
  }, [
    primaryEngine.status,
    threatRadarEnabled,
    workspace,
    analysisMatchesCurrent,
    primaryStreamResult.threatArrow,
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

  const currentChallenge = useMemo(
    () =>
      CLASSICAL_CHALLENGES.find((c) => c.id === selectedChallengeId) ||
      CLASSICAL_CHALLENGES[0],
    [selectedChallengeId]
  );

  // 开局库盘面指纹 O(1) 实时匹配与增量时间线缓存（切换手数时零 FEN 重序列化）
  const isOpeningContext = workspace === 'study' || workspace === 'opening';
  const openingStandardInitialRef = useRef<Piece[] | null>(null);
  if (!openingStandardInitialRef.current) {
    openingStandardInitialRef.current = createInitialPieces('even');
  }

  const drawRuleStatus = useMemo(() => {
    if (workspace === 'setup') return null;
    const playCfg =
      workspace === 'play'
        ? getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap)
        : null;
    const basePiecesForDraw =
      workspace === 'opening'
        ? openingStandardInitialRef.current!
        : workspace === 'challenge'
        ? currentChallenge.pieces()
        : playCfg
        ? playCfg.createBasePieces()
        : studyBasePieces;
    const baseTurnForDraw: Camp =
      workspace === 'opening'
        ? 'red'
        : workspace === 'challenge'
        ? currentChallenge.initialTurn
        : playCfg
        ? playCfg.baseTurn
        : studyBaseTurn;
    return computeDrawRuleStatus(basePiecesForDraw, baseTurnForDraw, activeMovesList, currentPly);
  }, [
    workspace,
    getPlaySetupConfig,
    playOpponentMode,
    playHumanCamp,
    handicap,
    currentChallenge,
    studyBasePieces,
    studyBaseTurn,
    activeMovesList,
    currentPly,
  ]);

  const naturalTerminalOutcome = useMemo<GameTerminalState | null>(() => {
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

  const terminalOutcome = manualTerminalOutcome || naturalTerminalOutcome;

  const isOpeningDrillSpoilerFree =
    workspace === 'opening' &&
    openingSubMode === 'drill' &&
    (drillState.status === 'drilling' || drillState.status === 'mistake');

  const drawClaimPrompt = useMemo(() => {
    if (!drawRuleStatus || terminalOutcome || isOpeningDrillSpoilerFree || workspace === 'setup') {
      return null;
    }

    if (drawRuleStatus.perpetualCheckCamp && workspace !== 'play') {
      const claimKey = `${workspace}-${currentPly}-perpetual-check`;
      if (dismissedDrawClaimKey === claimKey) {
        return null;
      }
      const offenderLabel = drawRuleStatus.perpetualCheckCamp === 'red' ? '红方' : '黑方';
      return {
        claimKey,
        kind: 'perpetual-check' as const,
        isViolationAlert: true,
        label: `单方长将禁止 · ${offenderLabel}须变着`,
        detail: `三次重复循环内${offenderLabel}每步连续将军，按棋规不变判负（请勿按和棋结算）`,
      };
    }

    if (drawRuleStatus.canClaimRepetitionDraw) {
      const claimKey = `${workspace}-${currentPly}-repetition`;
      if (dismissedDrawClaimKey === claimKey) return null;
      return {
        claimKey,
        kind: 'repetition' as const,
        isViolationAlert: false,
        label: '三次重复局面 · 可判和',
        detail: `当前相同局面已累计出现 ${drawRuleStatus.repetitionCount} 次（非单方长将）`,
      };
    }

    if (drawRuleStatus.canClaim60MoveDraw) {
      const claimKey = `${workspace}-${currentPly}-60moves`;
      if (dismissedDrawClaimKey === claimKey) return null;
      return {
        claimKey,
        kind: '60moves' as const,
        isViolationAlert: false,
        label: '60 回合无吃子 · 可判和',
        detail: `已连续 ${drawRuleStatus.noCaptureRounds} 回合无吃子（已扣除将军手数），达到自然限着`,
      };
    }

    if (drawRuleStatus.canClaimInsufficientDraw) {
      const claimKey = `${workspace}-${currentPly}-insufficient`;
      if (dismissedDrawClaimKey === claimKey) return null;
      return {
        claimKey,
        kind: 'insufficient' as const,
        isViolationAlert: false,
        label: '双方无进攻子力 · 死和',
        detail: '场上均无车马炮兵卒，按象棋规例可一键判和',
      };
    }

    return null;
  }, [
    drawRuleStatus,
    terminalOutcome,
    isOpeningDrillSpoilerFree,
    workspace,
    currentPly,
    dismissedDrawClaimKey,
  ]);

  const setupValidation = useMemo(
    () =>
      workspace === 'setup'
        ? validateSetupPosition(pieces, setupTurn)
        : {
            isValid: true,
            reason: null,
            hasBothGenerals: true,
            generalsFacing: false,
            inactiveCampInCheck: null,
          },
    [workspace, pieces, setupTurn]
  );

  const matchedOpeningNode = useMemo(
    () => (isOpeningContext ? lookupOpeningBookNode(pieces, turn) : null),
    [isOpeningContext, pieces, turn]
  );

  // 预构建各手最近命中的开局定式索引表，依赖与 currentPly 解耦，跳步翻谱直接 O(1) 下标读取
  const openingMatchTimeline = useMemo(() => {
    if (!isOpeningContext) return [];
    const baseSnap =
      workspace === 'opening' ? openingStandardInitialRef.current! : studyBasePieces;
    const baseTurnVal: Camp = workspace === 'opening' ? 'red' : studyBaseTurn;
    const maxPly = activeMovesList.length;
    const timeline: ({
      ply: number;
      openingName: string;
      category: OpeningBookCategory;
      matchKeyword: string;
    } | null)[] = new Array(maxPly + 1).fill(null);

    let latestMatch: {
      ply: number;
      openingName: string;
      category: OpeningBookCategory;
      matchKeyword: string;
    } | null = null;

    const rootNode = lookupOpeningBookNode(baseSnap, baseTurnVal);
    if (rootNode) {
      latestMatch = {
        ply: 0,
        openingName: rootNode.openingName,
        category: rootNode.category,
        matchKeyword: rootNode.matchKeyword,
      };
    }
    timeline[0] = latestMatch;

    for (let ply = 1; ply <= maxPly; ply++) {
      timeline[ply] = latestMatch;
      const move = activeMovesList[ply - 1];
      if (!move?.piecesSnapshot) continue;
      const snapTurn: Camp = move.piece.camp === 'red' ? 'black' : 'red';
      const node = lookupOpeningBookNode(move.piecesSnapshot, snapTurn);
      if (node) {
        latestMatch = {
          ply,
          openingName: node.openingName,
          category: node.category,
          matchKeyword: node.matchKeyword,
        };
      }
    }
    return timeline;
  }, [isOpeningContext, workspace, studyBasePieces, studyBaseTurn, activeMovesList]);

  const lastMatchedOpeningInfo = useMemo(() => {
    if (!isOpeningContext || matchedOpeningNode || currentPly <= 0) return null;
    const clampedPly = Math.min(currentPly, openingMatchTimeline.length - 1);
    return clampedPly >= 0 ? openingMatchTimeline[clampedPly] : null;
  }, [isOpeningContext, matchedOpeningNode, currentPly, openingMatchTimeline]);

  const activeMatchKeyword =
    matchedOpeningNode?.matchKeyword ?? lastMatchedOpeningInfo?.matchKeyword ?? '';
  const matchedLibraryCount = useMemo(
    () => countMatchingLibraryGames(libraryGames, activeMatchKeyword),
    [libraryGames, activeMatchKeyword]
  );

  // ==================== 4. 切换工作空间、新局重置与载入古谱/示范名局 ====================
  const cancelActiveBatchReview = useCallback(() => {
    if (batchReviewHandleRef.current) {
      batchReviewHandleRef.current.cancel();
      batchReviewHandleRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelActiveBatchReview();
    };
  }, [cancelActiveBatchReview]);

  const handleStartBatchReview = useCallback(
    (overridePreset?: BatchReviewPreset) => {
      if (mainMoves.length === 0) return;
      cancelActiveBatchReview();
      const targetPreset = overridePreset || batchReviewPreset;
      const reviewId = `rev-${++batchReviewIdRef.current}`;
      const baseFen = piecesToFen(studyBasePieces, studyBaseTurn);
      const compactMoves: CompactLibraryMove[] = mainMoves.map((m) => ({
        from: { ...m.from },
        to: { ...m.to },
        evalScore: m.evalScore,
        quality: m.quality,
      }));
      setBatchReviewProgress({
        reviewId,
        status: 'running',
        preset: targetPreset,
        completedPlies: 0,
        totalPlies: compactMoves.length,
        estimatedRemainingMs: compactMoves.length * (targetPreset === 'deep' ? 95 : 42),
        results: [],
      });
      batchReviewHandleRef.current = startSimulatedBatchReview(
        {
          reviewId,
          baseFen,
          moves: compactMoves,
          preset: targetPreset,
          engineId: primaryEngine.id,
        },
        (ev) => {
          if (ev.reviewId !== reviewId) return;
          setBatchReviewProgress(ev);
          if (ev.status === 'completed') {
            batchReviewHandleRef.current = null;
            setMainMoves((prev) =>
              prev.length === compactMoves.length
                ? applyBatchReviewToMoves(prev, ev.results)
                : prev
            );
            setHasScannedCurrentGame(true);
          } else if (ev.status === 'cancelled') {
            batchReviewHandleRef.current = null;
          }
        }
      );
    },
    [mainMoves, cancelActiveBatchReview, batchReviewPreset, studyBasePieces, studyBaseTurn, primaryEngine.id]
  );

  const handleCancelBatchReview = useCallback(() => {
    cancelActiveBatchReview();
  }, [cancelActiveBatchReview]);

  const handleNewStudyGame = useCallback(() => {
    clearDrillTimer();
    clearBotReplyTimer();
    cancelActiveBatchReview();
    setBatchReviewProgress(null);
    setHasScannedCurrentGame(false);
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
    setManualTerminalOutcome(null);
    setDismissedDrawClaimKey(null);
    setPlayActionNotice(null);
    resetClocksForPreset();
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
  }, [clearDrillTimer, clearBotReplyTimer, cancelActiveBatchReview, resetClocksForPreset]);

  const handleLoadSampleMasterGame = useCallback(() => {
    clearDrillTimer();
    clearBotReplyTimer();
    cancelActiveBatchReview();
    setBatchReviewProgress(null);
    setHasScannedCurrentGame(false);
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
    setManualTerminalOutcome(null);
    setDismissedDrawClaimKey(null);
    setPlayActionNotice(null);
    resetClocksForPreset();
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
  }, [clearDrillTimer, clearBotReplyTimer, cancelActiveBatchReview, getSampleSession, resetClocksForPreset]);

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
      autoReviewPreset?: BatchReviewPreset;
    }) => {
      clearDrillTimer();
      clearBotReplyTimer();
      cancelActiveBatchReview();
      setBatchReviewProgress(null);
      setHasScannedCurrentGame(false);
      pendingAutoBatchReviewRef.current =
        payload.autoReviewPreset && payload.moves.length > 0 ? payload.autoReviewPreset : null;
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
      setPlayActionNotice(null);
      resetClocksForPreset();
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
    [clearDrillTimer, clearBotReplyTimer, cancelActiveBatchReview, resetClocksForPreset]
  );

  useEffect(() => {
    if (
      workspace === 'study' &&
      rightTab === 'review' &&
      pendingAutoBatchReviewRef.current &&
      mainMoves.length > 0
    ) {
      const preset = pendingAutoBatchReviewRef.current;
      pendingAutoBatchReviewRef.current = null;
      setBatchReviewPreset(preset);
      handleStartBatchReview(preset);
    }
  }, [workspace, rightTab, mainMoves.length, handleStartBatchReview]);

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

  const schedulePlayBotMove = useCallback(
    (
      boardPieces: Piece[],
      botCamp: Camp,
      basePly: number,
      recordsBeforeBot: MoveRecord[],
      modeNow: PlayOpponentMode,
      humanCampNow: Camp,
      handicapNow: HandicapType,
      tierNow: EngineSkillTier,
      delayMs = 560
    ) => {
      clearBotReplyTimer();
      setIsBotThinking(true);
      botReplyTimerRef.current = window.setTimeout(() => {
        botReplyTimerRef.current = null;
        const reply = selectBotPlayMove(
          boardPieces,
          botCamp,
          tierNow,
          basePly,
          recordsBeforeBot
        );
        if (reply) {
          const botPiece = getPieceAt(boardPieces, reply.from.row, reply.from.col);
          if (botPiece) {
            const botCap = getPieceAt(boardPieces, reply.to.row, reply.to.col);
            const afterBot = boardPieces
              .filter((p) => !(p.row === reply.to.row && p.col === reply.to.col))
              .map((p) =>
                p.id === botPiece.id ? { ...p, row: reply.to.row, col: reply.to.col } : p
              );
            const nextTurnAfterBot: Camp = botCamp === 'red' ? 'black' : 'red';
            const botRec: MoveRecord = {
              ply: basePly + 1,
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
              nextTurnAfterBot,
              !!botCap,
              reply.to.row,
              reply.to.col
            );
            const recordsAfterBot = [...recordsBeforeBot, botRec];
            const cfg = getPlaySetupConfig(modeNow, humanCampNow, handicapNow);
            let botPerpetualCamp: Camp | null = null;
            if (!botTerminal) {
              const statusAfterBot = computeDrawRuleStatus(
                cfg.createBasePieces(),
                cfg.baseTurn,
                recordsAfterBot,
                recordsAfterBot.length
              );
              botPerpetualCamp = statusAfterBot.perpetualCheckCamp;
            }
            setPieces(afterBot);
            setMainMoves(recordsAfterBot);
            setCurrentPly(basePly + 1);
            setTurn(nextTurnAfterBot);
            if (botPerpetualCamp) {
              const winner: Camp = botPerpetualCamp === 'red' ? 'black' : 'red';
              playCheckmateGongSound(soundEnabled);
              setTerminalDismissed(false);
              setManualTerminalOutcome({
                kind: 'perpetual-check',
                winner,
                loser: botPerpetualCamp,
                reasonText: `${botPerpetualCamp === 'red' ? '红方' : '黑方'}三次重复单方连续长将，按棋规违例判负`,
              });
            } else if (activeClockPreset.incrementMs > 0 && !botTerminal) {
              if (botCamp === 'red') {
                setClockRedMs((ms) => ms + activeClockPreset.incrementMs);
              } else {
                setClockBlackMs((ms) => ms + activeClockPreset.incrementMs);
              }
            }
          }
        }
        setIsBotThinking(false);
      }, delayMs);
    },
    [
      clearBotReplyTimer,
      getPlaySetupConfig,
      triggerMoveSoundAndCheckEffects,
      soundEnabled,
      activeClockPreset.incrementMs,
    ]
  );

  const handleSwitchWorkspace = useCallback(
    (nextWs: WorkspaceMode) => {
      clearDrillTimer();
      clearBotReplyTimer();
      cancelActiveBatchReview();
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
      setPlayActionNotice(null);

      if (nextWs === 'study') {
        resetClocksForPreset();
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
          setFlipped(!!stored.flipped);
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
          setFlipped(false);
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
        resetClocksForPreset();
        const cfg = getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap);
        const initP = cfg.createBasePieces();
        setPieces(initP);
        setMainMoves([]);
        setVariationMoves(null);
        setCurrentPly(0);
        setTurn(cfg.baseTurn);
        setFlipped(playOpponentMode === 'ai' && playHumanCamp === 'black');
        setIsAnalyzing(false);
        if (cfg.aiCamp && cfg.baseTurn === cfg.aiCamp) {
          schedulePlayBotMove(
            initP,
            cfg.aiCamp,
            0,
            [],
            playOpponentMode,
            playHumanCamp,
            handicap,
            skillTier,
            480
          );
        }
      } else if (nextWs === 'setup') {
        setSetupTurn(turn);
        setSetupPlacementError(null);
        setSidebarCollapsed(false);
        setIsAnalyzing(false);
      }
    },
    [
      clearDrillTimer,
      clearBotReplyTimer,
      cancelActiveBatchReview,
      workspace,
      flushStudyPersistence,
      resetClocksForPreset,
      getPlaySetupConfig,
      playOpponentMode,
      playHumanCamp,
      handicap,
      skillTier,
      turn,
      schedulePlayBotMove,
    ]
  );

  const handleSelectChallenge = useCallback(
    (chId: string) => {
      clearBotReplyTimer();
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
      setChallengeStatusBanner(`破局目标：${ch.objective}`);
    },
    [clearBotReplyTimer]
  );

  const handleStartPlayGame = useCallback(
    (
      newMode: PlayOpponentMode,
      newHumanCamp: Camp,
      newHandicap: HandicapType,
      newTier: EngineSkillTier
    ) => {
      clearBotReplyTimer();
      setPlayOpponentMode(newMode);
      setPlayHumanCamp(newHumanCamp);
      setHandicap(newHandicap);
      setSkillTier(newTier);
      const cfg = getPlaySetupConfig(newMode, newHumanCamp, newHandicap);
      const initP = cfg.createBasePieces();
      setPieces(initP);
      setMainMoves([]);
      setVariationMoves(null);
      setCurrentPly(0);
      setTurn(cfg.baseTurn);
      setFlipped(newMode === 'ai' && newHumanCamp === 'black');
      setHintArrow(null);
      setCheckSealEffect(null);
      setIllegalMoveWarning(null);
      setTerminalDismissed(false);
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
      setPlayActionNotice(null);
      resetClocksForPreset();
      if (cfg.aiCamp && cfg.baseTurn === cfg.aiCamp) {
        schedulePlayBotMove(
          initP,
          cfg.aiCamp,
          0,
          [],
          newMode,
          newHumanCamp,
          newHandicap,
          newTier,
          480
        );
      }
    },
    [clearBotReplyTimer, getPlaySetupConfig, resetClocksForPreset, schedulePlayBotMove]
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
      clearBotReplyTimer();
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);

      if (clamped === 0) {
        const playCfg =
          workspace === 'play'
            ? getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap)
            : null;
        const baseInit =
          workspace === 'opening'
            ? createInitialPieces('even')
            : workspace === 'challenge'
            ? currentChallenge.pieces()
            : playCfg
            ? playCfg.createBasePieces()
            : studyBasePieces.map((p) => ({ ...p }));
        setPieces(baseInit);
        setTurn(
          workspace === 'opening'
            ? 'red'
            : workspace === 'challenge'
            ? currentChallenge.initialTurn
            : playCfg
            ? playCfg.baseTurn
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
      clearBotReplyTimer,
      isOpeningDrillSpoilerFree,
      clearDrillTimer,
      variationMoves,
      mainMoves,
      workspace,
      getPlaySetupConfig,
      playOpponentMode,
      playHumanCamp,
      handicap,
      currentChallenge,
      studyBasePieces,
      studyBaseTurn,
    ]
  );

  const executeMoveOnBoard = useCallback(
    (from: Position, to: Position) => {
      clearBotReplyTimer();
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
      setPlayActionNotice(null);

      if (terminalAfterPlayer && workspace === 'study' && metadata.result === '进行中') {
        setMetadata((prev) => ({
          ...prev,
          result:
            terminalAfterPlayer.winner === 'red'
              ? '红胜'
              : terminalAfterPlayer.winner === 'black'
              ? '黑胜'
              : '和棋',
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
      let recordsAfterPlayerMove: MoveRecord[] = [];
      if (workspace === 'study' || workspace === 'opening') {
        const existingMainMove = mainMoves[currentPly];
        const isSameAsMain =
          existingMainMove &&
          existingMainMove.from.row === from.row &&
          existingMainMove.from.col === from.col &&
          existingMainMove.to.row === to.row &&
          existingMainMove.to.col === to.col;

        if (isSameAsMain && !variationMoves) {
          recordsAfterPlayerMove = mainMoves.slice(0, nextPly);
        } else if (currentPly < mainMoves.length || variationMoves) {
          const baseList = variationMoves || mainMoves;
          const origin = branchOriginPly ?? currentPly;
          const nextVar = [...baseList.slice(0, currentPly), newRecord];
          setBranchOriginPly(origin);
          setVariationMoves(nextVar);
          recordsAfterPlayerMove = nextVar;
        } else {
          if (workspace === 'study') {
            cancelActiveBatchReview();
            setBatchReviewProgress(null);
            setHasScannedCurrentGame(false);
          }
          const nextMain = [...mainMoves, newRecord];
          setMainMoves(nextMain);
          recordsAfterPlayerMove = nextMain;
        }
      } else {
        const nextMain = [...mainMoves.slice(0, currentPly), newRecord];
        setMainMoves(nextMain);
        recordsAfterPlayerMove = nextMain;
      }

      // 对弈实战模式下：若玩家走后构成三次重复「单方长将」，直接按违例判负；未违例且未终局再加秒并触发电脑应手
      if (workspace === 'play') {
        const playCfg = getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap);
        if (!terminalAfterPlayer) {
          const playStatusAfterPlayer = computeDrawRuleStatus(
            playCfg.createBasePieces(),
            playCfg.baseTurn,
            recordsAfterPlayerMove,
            recordsAfterPlayerMove.length
          );
          if (playStatusAfterPlayer.perpetualCheckCamp) {
            const violator = playStatusAfterPlayer.perpetualCheckCamp;
            const winner: Camp = violator === 'red' ? 'black' : 'red';
            playCheckmateGongSound(soundEnabled);
            setTerminalDismissed(false);
            setManualTerminalOutcome({
              kind: 'perpetual-check',
              winner,
              loser: violator,
              reasonText: `${violator === 'red' ? '红方' : '黑方'}三次重复单方连续长将，按棋规违例判负`,
            });
            return;
          }
          if (activeClockPreset.incrementMs > 0) {
            if (moving.camp === 'red') {
              setClockRedMs((ms) => ms + activeClockPreset.incrementMs);
            } else {
              setClockBlackMs((ms) => ms + activeClockPreset.incrementMs);
            }
          }
          if (playCfg.aiCamp && nextTurn === playCfg.aiCamp) {
            schedulePlayBotMove(
              nextPieces,
              playCfg.aiCamp,
              nextPly,
              recordsAfterPlayerMove,
              playOpponentMode,
              playHumanCamp,
              handicap,
              skillTier,
              580
            );
          }
        }
        return;
      }

      // 若在「古谱闯关」模式下且轮到黑方（引擎），先判定是否已绝杀/困毙，未终局则延迟 620ms 自动应手
      if (workspace === 'challenge' && nextTurn === 'black') {
        if (terminalAfterPlayer) {
          if (terminalAfterPlayer.winner === 'red') {
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

        if (nextPly === 1) {
          const hm = currentChallenge.hintMove;
          if (from.row === hm.from.row && from.col === hm.from.col && to.row === hm.to.row && to.col === hm.to.col) {
            setSolvedChallengeIds((prev) =>
              prev.includes(currentChallenge.id) ? prev : [...prev, currentChallenge.id]
            );
            setChallengeStatusBanner(`好棋！走出《${currentChallenge.sourceBook}》正着「${notation}」，已记录破关！`);
          } else {
            setChallengeStatusBanner(`已走出「${notation}」，黑方应对中（可点「支招」查看正着）`);
          }
        } else if (nextPly >= 3 && nextEval >= 5.0) {
          setSolvedChallengeIds((prev) =>
            prev.includes(currentChallenge.id) ? prev : [...prev, currentChallenge.id]
          );
          setChallengeStatusBanner(`红方已取得胜势（${nextEval >= 0 ? '+' : ''}${nextEval.toFixed(2)}），自动标记为已破关！`);
        }

        setIsBotThinking(true);
        botReplyTimerRef.current = window.setTimeout(() => {
          botReplyTimerRef.current = null;
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
              const recordsAfterBot = [...recordsAfterPlayerMove, botRec];
              setPieces(afterBot);
              setMainMoves(recordsAfterBot);
              setCurrentPly(nextPly + 1);
              setTurn('red');
              if (botTerminal) {
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
      clearBotReplyTimer,
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
      activeClockPreset.incrementMs,
      retryMistakePly,
      retryTargetMove,
      workspace,
      metadata.result,
      mainMoves,
      variationMoves,
      branchOriginPly,
      currentChallenge,
      getPlaySetupConfig,
      playOpponentMode,
      playHumanCamp,
      handicap,
      skillTier,
      schedulePlayBotMove,
      recordDrillCompletion,
      scheduleDrillOpponentReply,
      triggerMoveSoundAndCheckEffects,
      cancelActiveBatchReview,
    ]
  );

  const handleEnsureSelectedPiece = useCallback((pieceId: string) => {
    setSelectedPieceId(pieceId);
  }, []);

  const handleDropMove = useCallback(
    (from: Position, to: Position) => {
      if (isBotThinking || workspace === 'setup' || terminalOutcome) return;
      const moving = getPieceAtGrid(boardGrid, from.row, from.col);
      if (!moving || moving.camp !== turn) return;

      const safeMoves = getSafeLegalMovesForPiece(moving, pieces, boardGrid);
      if (safeMoves.some((m) => m.row === to.row && m.col === to.col)) {
        executeMoveOnBoard(from, to);
        return;
      }

      const pseudoLegal = getLegalMovesForPiece(moving, pieces, boardGrid);
      if (pseudoLegal.some((m) => m.row === to.row && m.col === to.col)) {
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

      setSelectedPieceId(moving.id);
    },
    [
      isBotThinking,
      workspace,
      terminalOutcome,
      boardGrid,
      turn,
      pieces,
      executeMoveOnBoard,
      checkPositions.inCheckCamp,
      soundEnabled,
    ]
  );

  const handleAcceptDrawClaim = useCallback(() => {
    if (!drawClaimPrompt || drawClaimPrompt.isViolationAlert) return;
    clearBotReplyTimer();
    playCheckmateGongSound(soundEnabled);
    setTerminalDismissed(false);
    setSelectedPieceId(null);
    setManualTerminalOutcome({
      kind:
        drawClaimPrompt.kind === 'repetition'
          ? 'draw-repetition'
          : drawClaimPrompt.kind === 'insufficient'
          ? 'draw-insufficient'
          : 'draw-60moves',
      reasonText: drawClaimPrompt.detail,
    });
    if (workspace === 'study' && metadata.result === '进行中') {
      setMetadata((prev) => ({ ...prev, result: '和棋' }));
    }
  }, [drawClaimPrompt, clearBotReplyTimer, soundEnabled, workspace, metadata.result]);

  const handleStepBackFromViolation = useCallback(() => {
    if (currentPly <= 0) return;
    handleJumpPly(currentPly - 1, !!variationMoves);
  }, [currentPly, handleJumpPly, variationMoves]);

  const handleDismissDrawClaim = useCallback(() => {
    if (!drawClaimPrompt) return;
    setDismissedDrawClaimKey(drawClaimPrompt.claimKey);
  }, [drawClaimPrompt]);

  const handlePlayResign = useCallback(() => {
    if (workspace !== 'play' || terminalOutcome || isBotThinking) return;
    clearBotReplyTimer();
    playCheckmateGongSound(soundEnabled);
    setSelectedPieceId(null);
    setTerminalDismissed(false);
    setPlayActionNotice(null);
    const loser: Camp = playOpponentMode === 'local-pvp' ? turn : playHumanCamp;
    const winner: Camp = loser === 'red' ? 'black' : 'red';
    setManualTerminalOutcome({
      kind: 'resign',
      winner,
      loser,
      reasonText:
        playOpponentMode === 'local-pvp'
          ? `${loser === 'red' ? '红方' : '黑方'}主动认输，${winner === 'red' ? '红方' : '黑方'}获胜`
          : `玩家（${loser === 'red' ? '红方' : '黑方'}）主动认输，电脑获胜`,
    });
  }, [
    workspace,
    terminalOutcome,
    isBotThinking,
    clearBotReplyTimer,
    soundEnabled,
    playOpponentMode,
    turn,
    playHumanCamp,
  ]);

  const handlePlayOfferDraw = useCallback(() => {
    if (workspace !== 'play' || terminalOutcome || isBotThinking) return;
    if (drawRuleStatus?.perpetualCheckCamp) {
      playInvalidWarningSound(soundEnabled);
      setPlayActionNotice('当前存在单方长将违例循环，不可按和棋提和');
      return;
    }
    const isInsufficient = !!drawRuleStatus?.canClaimInsufficientDraw;
    if (playOpponentMode === 'local-pvp') {
      clearBotReplyTimer();
      playCheckmateGongSound(soundEnabled);
      setSelectedPieceId(null);
      setTerminalDismissed(false);
      setPlayActionNotice(null);
      setManualTerminalOutcome({
        kind: isInsufficient ? 'draw-insufficient' : 'draw-agreement',
        reasonText: isInsufficient
          ? '双方均无进攻子力，确认按死和结算'
          : '双方面对面协商一致，握手言和',
      });
      return;
    }
    const isNearDrawRule =
      !!drawRuleStatus &&
      (drawRuleStatus.canClaim60MoveDraw ||
        drawRuleStatus.canClaimRepetitionDraw ||
        isInsufficient ||
        drawRuleStatus.noCaptureRounds >= 35 ||
        drawRuleStatus.repetitionCount >= 2);
    if (!isNearDrawRule && mainMoves.length < 6) {
      setPlayActionNotice('开局尚不足 3 回合，电脑暂不受理提和');
      return;
    }
    const aiCamp: Camp = playHumanCamp === 'red' ? 'black' : 'red';
    const aiEvalAdvantage = aiCamp === 'red' ? currentEvalScore : -currentEvalScore;
    if (!isNearDrawRule && aiEvalAdvantage > 1.2) {
      playInvalidWarningSound(soundEnabled);
      setPlayActionNotice(
        `电脑评估${aiCamp === 'red' ? '红方' : '黑方'}优势较大，婉拒本次提和`
      );
      return;
    }
    clearBotReplyTimer();
    playCheckmateGongSound(soundEnabled);
    setSelectedPieceId(null);
    setTerminalDismissed(false);
    setPlayActionNotice(null);
    setManualTerminalOutcome({
      kind: isInsufficient ? 'draw-insufficient' : 'draw-agreement',
      reasonText: isInsufficient
        ? '双方均无进攻子力，电脑同意按死和结算'
        : isNearDrawRule
        ? '双方局面胶着，电脑同意协议和棋'
        : '电脑评估局势平稳，双方握手言和',
    });
  }, [
    workspace,
    terminalOutcome,
    isBotThinking,
    drawRuleStatus,
    playOpponentMode,
    playHumanCamp,
    mainMoves.length,
    currentEvalScore,
    soundEnabled,
    clearBotReplyTimer,
  ]);

  const handleChangeClockPreset = useCallback(
    (nextPresetId: ChessClockPresetId) => {
      setClockPresetId(nextPresetId);
      resetClocksForPreset(nextPresetId);
      setPlayActionNotice(null);
      setManualTerminalOutcome((prev) => (prev?.kind === 'timeout' ? null : prev));
    },
    [resetClocksForPreset]
  );

  const handleToggleClockPaused = useCallback(() => {
    setClockPaused((prev) => !prev);
  }, []);

  const handleUpdateMoveAnnotation = useCallback(
    (ply: number, isVariation: boolean, nag: MoveNag | undefined, comment: string) => {
      const cleanComment = comment.trim();
      const applyUpdate = (list: MoveRecord[]) =>
        list.map((m) =>
          m.ply === ply
            ? {
                ...m,
                nag: nag || undefined,
                comment: cleanComment ? cleanComment : undefined,
              }
            : m
        );
      if (isVariation) {
        setVariationMoves((prev) => (prev ? applyUpdate(prev) : prev));
      } else {
        setMainMoves((prev) => applyUpdate(prev));
      }
    },
    []
  );

  const isClockWorkspaceActive =
    clockPresetId !== 'none' &&
    workspace === 'play' &&
    mainMoves.length > 0;

  useEffect(() => {
    if (!isClockWorkspaceActive || clockPaused || terminalOutcome || activeModal) {
      lastClockTickSecRef.current = null;
      return;
    }
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, now - lastTick);
      lastTick = now;

      const handleLowClockSound = (remainingMs: number) => {
        if (remainingMs > 0 && remainingMs <= 10_000) {
          const secNow = Math.ceil(remainingMs / 1000);
          if (
            !lastClockTickSecRef.current ||
            lastClockTickSecRef.current.camp !== turn ||
            lastClockTickSecRef.current.sec !== secNow
          ) {
            lastClockTickSecRef.current = { camp: turn, sec: secNow };
            playClockWarningTickSound(secNow, soundEnabled);
          }
        }
      };

      if (turn === 'red') {
        const prev = clockRedMsRef.current;
        const next = Math.max(0, prev - delta);
        clockRedMsRef.current = next;
        setClockRedMs(next);
        handleLowClockSound(next);
        if (next === 0 && prev > 0) {
          clearBotReplyTimer();
          playCheckmateGongSound(soundEnabled);
          setTerminalDismissed(false);
          setManualTerminalOutcome({
            kind: 'timeout',
            winner: 'black',
            loser: 'red',
            reasonText: '红方包干加秒用尽，按超时判负',
          });
        }
      } else {
        const prev = clockBlackMsRef.current;
        const next = Math.max(0, prev - delta);
        clockBlackMsRef.current = next;
        setClockBlackMs(next);
        handleLowClockSound(next);
        if (next === 0 && prev > 0) {
          clearBotReplyTimer();
          playCheckmateGongSound(soundEnabled);
          setTerminalDismissed(false);
          setManualTerminalOutcome({
            kind: 'timeout',
            winner: 'red',
            loser: 'black',
            reasonText: '黑方包干加秒用尽，按超时判负',
          });
        }
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [
    isClockWorkspaceActive,
    clockPaused,
    terminalOutcome,
    activeModal,
    turn,
    clearBotReplyTimer,
    soundEnabled,
  ]);

  const handleSelectIntersection = useCallback(
    (row: number, col: number) => {
      if (isBotThinking) return;

      if (workspace === 'setup') {
        const existing = getPieceAtGrid(boardGrid, row, col);
        if (existing) {
          if (existing.type === 'general') {
            const alreadySelected =
              setupSelectedTemplate?.type === 'general' &&
              setupSelectedTemplate?.camp === existing.camp;
            setSetupPlacementError(null);
            setIllegalMoveWarning(null);
            setSetupSelectedTemplate(
              alreadySelected ? null : { camp: existing.camp, type: 'general' }
            );
            return;
          }
          setSetupPlacementError(null);
          setIllegalMoveWarning(null);
          setPieces((prev) => prev.filter((p) => p.id !== existing.id));
        } else if (setupSelectedTemplate) {
          const checkPlacement = isSetupPiecePlacementAllowed(
            setupSelectedTemplate.camp,
            setupSelectedTemplate.type,
            row,
            col
          );
          if (!checkPlacement.allowed) {
            playInvalidWarningSound(soundEnabled);
            const msg = checkPlacement.reason || '该交叉点不符合该棋种摆子规范';
            setSetupPlacementError(msg);
            setIllegalMoveWarning(msg);
            return;
          }

          if (setupSelectedTemplate.type === 'general') {
            const existingGeneral = pieces.find(
              (p) => p.camp === setupSelectedTemplate.camp && p.type === 'general'
            );
            playWoodClackSound(false, row, col, soundEnabled);
            setSetupPlacementError(null);
            setIllegalMoveWarning(null);
            if (existingGeneral) {
              setPieces((prev) =>
                prev.map((p) => (p.id === existingGeneral.id ? { ...p, row, col } : p))
              );
            } else {
              const newGeneral: Piece = {
                id: `${setupSelectedTemplate.camp[0]}-general`,
                camp: setupSelectedTemplate.camp,
                type: 'general',
                row,
                col,
              };
              setPieces((prev) => [...prev, newGeneral]);
            }
            return;
          }

          const currentCount = pieces.filter(
            (p) =>
              p.camp === setupSelectedTemplate.camp &&
              p.type === setupSelectedTemplate.type
          ).length;
          const quotaMax = PIECE_QUOTA_BY_TYPE[setupSelectedTemplate.type];
          if (currentCount >= quotaMax) {
            playInvalidWarningSound(soundEnabled);
            setSetupPlacementError('该棋种数量已达上限，请先移除盘面多余棋子');
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
          setSetupPlacementError(null);
          setIllegalMoveWarning(null);
          setPieces((prev) => [...prev, newPiece]);
          if (currentCount + 1 >= quotaMax) {
            setSetupSelectedTemplate(null);
          }
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
    if (workspace === 'setup' || isBotThinking || terminalOutcome) return;
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
    terminalOutcome,
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

  // 全局快捷键支持：使用最新处理器 Ref，仅在应用挂载时绑定一次 keydown 监听器
  const keydownHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keydownHandlerRef.current = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'command-palette' ? null : 'command-palette'));
        return;
      }
      if (activeModal) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft') {
        if (workspace === 'setup' || isBotThinking || isOpeningDrillSpoilerFree) return;
        e.preventDefault();
        handleJumpPly(currentPly - 1, !!variationMoves);
      } else if (e.key === 'ArrowRight') {
        if (workspace === 'setup' || isBotThinking || isOpeningDrillSpoilerFree) return;
        e.preventDefault();
        handleJumpPly(currentPly + 1, !!variationMoves);
      } else if (e.key === 'Home') {
        if (workspace === 'setup' || isBotThinking || isOpeningDrillSpoilerFree) return;
        e.preventDefault();
        handleJumpPly(0, !!variationMoves);
      } else if (e.key === 'End') {
        if (workspace === 'setup' || isBotThinking || isOpeningDrillSpoilerFree) return;
        e.preventDefault();
        handleJumpPly(activeMovesList.length, !!variationMoves);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'c' && workspace === 'study') {
        e.preventDefault();
        setCompareMode((prev) => !prev);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowBoardCoordinates((prev) => !prev);
      } else if (
        e.key === ' ' &&
        workspace === 'study' &&
        !isOpeningDrillSpoilerFree &&
        !isBotThinking &&
        !terminalOutcome &&
        primaryEngine.status === 'ready' &&
        hasLegalMovesCurrentTurn
      ) {
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
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keydownHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
        ...(m.nag ? { nag: m.nag } : {}),
        ...(m.comment ? { comment: m.comment } : {}),
      }));
      const redMoves = activeMovesList.filter((m) => m.piece.camp === 'red');
      const blackMoves = activeMovesList.filter((m) => m.piece.camp === 'black');
      const accuracyRed =
        redMoves.length > 0
          ? Number(
              (
                redMoves.reduce((s, m) => s + getMoveQualityAccuracyScore(m.quality), 0) /
                redMoves.length
              ).toFixed(1)
            )
          : 92.0;
      const accuracyBlack =
        blackMoves.length > 0
          ? Number(
              (
                blackMoves.reduce((s, m) => s + getMoveQualityAccuracyScore(m.quality), 0) /
                blackMoves.length
              ).toFixed(1)
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
    () =>
      setAppTheme((prev) =>
        prev === 'dark' ? 'light' : prev === 'light' ? 'eyecare' : 'dark'
      ),
    []
  );
  const handleToggleCompareMode = useCallback(() => setCompareMode((prev) => !prev), []);
  const handleToggleAnalysis = useCallback(() => setIsAnalyzing((prev) => !prev), []);
  const handleToggleThreatRadar = useCallback(() => setThreatRadarEnabled((prev) => !prev), []);
  const handleFlipBoard = useCallback(() => setFlipped((prev) => !prev), []);
  const handleClearBoardAnnotations = useCallback(
    () => setClearAnnotationsNonce((n) => n + 1),
    []
  );
  const handleBoardNavJumpPly = useCallback(
    (targetPly: number) => {
      handleJumpPly(targetPly, !!variationMoves);
    },
    [handleJumpPly, variationMoves]
  );

  const handleUndoMove = useCallback(() => {
    if (isBotThinking) return;
    if (workspace === 'play') {
      if (terminalOutcome?.kind === 'timeout') return;
      if (playOpponentMode === 'local-pvp') {
        handleJumpPly(Math.max(0, currentPly - 1));
        return;
      }
      const cfg = getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap);
      const minPlayPly = cfg.aiCamp && cfg.baseTurn === cfg.aiCamp ? 1 : 0;
      if (turn === playHumanCamp) {
        const step = currentPly - minPlayPly >= 2 ? 2 : 1;
        handleJumpPly(Math.max(minPlayPly, currentPly - step));
      } else {
        handleJumpPly(Math.max(minPlayPly, currentPly - 1));
      }
      return;
    }
    if (workspace === 'challenge' && turn === 'red') {
      const step = currentPly >= 2 ? 2 : 1;
      handleJumpPly(Math.max(0, currentPly - step));
      return;
    }
    handleJumpPly(Math.max(0, currentPly - 1), !!variationMoves);
  }, [
    isBotThinking,
    workspace,
    terminalOutcome?.kind,
    playOpponentMode,
    playHumanCamp,
    handicap,
    getPlaySetupConfig,
    turn,
    currentPly,
    variationMoves,
    handleJumpPly,
  ]);
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
    clearBotReplyTimer();
    cancelActiveBatchReview();
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
    setCheckSealEffect(null);
    setIllegalMoveWarning(null);
    setTerminalDismissed(false);
    setManualTerminalOutcome(null);
    setDismissedDrawClaimKey(null);
    setPlayActionNotice(null);
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
    clearBotReplyTimer,
    cancelActiveBatchReview,
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
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
      handleStartPlayGame(playOpponentMode, playHumanCamp, handicap, skillTier);
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
    playOpponentMode,
    playHumanCamp,
    handicap,
    skillTier,
    currentChallenge.id,
    handleStartPlayGame,
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
      setManualTerminalOutcome(null);
      setDismissedDrawClaimKey(null);
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
        result: terminalOutcome
          ? terminalOutcome.winner === 'red'
            ? '红胜'
            : terminalOutcome.winner === 'black'
            ? '黑胜'
            : '和棋'
          : '进行中',
        isFavorite: false,
      },
    });
  }, [handleTransferToStudy, currentChallenge, pieces, turn, mainMoves, currentPly, terminalOutcome]);

  const transferPlayToStudy = useCallback(
    (autoScan: boolean) => {
      const cfg = getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap);
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
      const isLocalPvp = playOpponentMode === 'local-pvp';
      const redPlayerName = isLocalPvp
        ? '红方棋手'
        : playHumanCamp === 'red'
        ? '玩家（红方）'
        : `电脑引擎（${tierLabel}）`;
      const blackPlayerName = isLocalPvp
        ? '黑方棋手'
        : playHumanCamp === 'black'
        ? '玩家（黑方）'
        : `电脑引擎（${tierLabel}）`;
      handleTransferToStudy({
        basePieces: cfg.createBasePieces(),
        baseTurn: cfg.baseTurn,
        currentPieces: pieces,
        currentTurn: turn,
        moves: mainMoves,
        ply: currentPly,
        targetRightTab: autoScan ? 'review' : 'moves',
        autoReviewPreset: autoScan ? 'fast' : undefined,
        nextMetadata: {
          redPlayer: redPlayerName,
          blackPlayer: blackPlayerName,
          event: isLocalPvp ? `本地双人对弈 · ${handicapLabel}` : `人机对弈 · ${handicapLabel}`,
          opening: isLocalPvp ? `本地双人实战 (${handicapLabel})` : `人机实战 (${handicapLabel})`,
          result: terminalOutcome
            ? terminalOutcome.winner === 'red'
              ? '红胜'
              : terminalOutcome.winner === 'black'
              ? '黑胜'
              : '和棋'
            : '进行中',
          isFavorite: false,
        },
      });
    },
    [
      getPlaySetupConfig,
      playOpponentMode,
      playHumanCamp,
      handicap,
      skillTier,
      handleTransferToStudy,
      pieces,
      turn,
      mainMoves,
      currentPly,
      terminalOutcome,
    ]
  );

  const handleTransferPlayToStudy = useCallback(
    () => transferPlayToStudy(false),
    [transferPlayToStudy]
  );

  const handleTransferPlayToStudyAndScan = useCallback(
    () => transferPlayToStudy(true),
    [transferPlayToStudy]
  );

  const handleDismissTerminal = useCallback(() => setTerminalDismissed(true), []);
  const handleRestoreTerminal = useCallback(() => setTerminalDismissed(false), []);
  const handleOpenReviewTab = useCallback(() => {
    setRightTab('review');
    setTerminalDismissed(true);
  }, []);

  const handlePromoteVariationToMain = useCallback(() => {
    if (variationMoves) {
      cancelActiveBatchReview();
      setBatchReviewProgress(null);
      setHasScannedCurrentGame(false);
      setMainMoves(variationMoves);
      setVariationMoves(null);
      setBranchOriginPly(null);
    }
  }, [variationMoves, cancelActiveBatchReview]);

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

  const handleSelectSetupTemplate = useCallback(
    (template: { camp: Camp; type: PieceType } | null) => {
      setSetupSelectedTemplate(template);
      setSetupPlacementError(null);
    },
    []
  );
  const handleChangeSetupTurn = useCallback((nextCamp: Camp) => {
    setSetupTurn(nextCamp);
    setSetupPlacementError(null);
    setIllegalMoveWarning(null);
  }, []);
  const handleClearSetupToKings = useCallback(() => {
    setSetupPlacementError(null);
    setIllegalMoveWarning(null);
    setPieces(createKingsOnlyPieces());
  }, []);
  const handleResetSetupInitial = useCallback(() => {
    setSetupPlacementError(null);
    setIllegalMoveWarning(null);
    setPieces(createInitialPieces());
  }, []);
  const handleFinishSetup = useCallback(() => {
    if (!setupValidation.isValid) {
      playInvalidWarningSound(soundEnabled);
      setSetupPlacementError(setupValidation.reason || '当前局面存在不合法站位，请先修正');
      return;
    }
    setSetupPlacementError(null);
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
  }, [setupValidation, soundEnabled, handleTransferToStudy, pieces, setupTurn]);

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
      const cfg = getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap);
      return piecesToFen(cfg.createBasePieces(), cfg.baseTurn);
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
    getPlaySetupConfig,
    playOpponentMode,
    playHumanCamp,
    handicap,
    modalFen,
  ]);
  const exportMetadata = useMemo<GameMetadata>(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const terminalResult: GameMetadata['result'] = terminalOutcome
      ? terminalOutcome.winner === 'red'
        ? '红胜'
        : terminalOutcome.winner === 'black'
        ? '黑胜'
        : '和棋'
      : '进行中';

    if (workspace === 'play') {
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
      const isLocalPvp = playOpponentMode === 'local-pvp';
      const redPlayer = isLocalPvp
        ? '红方棋手'
        : playHumanCamp === 'red'
        ? '玩家（红方）'
        : `电脑引擎（${tierLabel}）`;
      const blackPlayer = isLocalPvp
        ? '黑方棋手'
        : playHumanCamp === 'black'
        ? '玩家（黑方）'
        : `电脑引擎（${tierLabel}）`;
      return {
        redPlayer,
        blackPlayer,
        event: isLocalPvp ? `本地双人对弈 · ${handicapLabel}` : `人机对弈 · ${handicapLabel}`,
        date: todayStr,
        result: terminalResult,
        site: '象棋X 实战对弈',
        opening:
          matchedOpeningNode?.openingName ||
          lastMatchedOpeningInfo?.openingName ||
          (isLocalPvp ? `本地双人实战 (${handicapLabel})` : `人机实战 (${handicapLabel})`),
        isFavorite: false,
      };
    }

    if (workspace === 'challenge') {
      return {
        redPlayer: '挑战者（红方）',
        blackPlayer: currentChallenge.sourceBook,
        event: `古谱残局 · ${currentChallenge.difficulty}`,
        date: todayStr,
        result: terminalResult,
        site: '象棋X 残局闯关',
        opening: currentChallenge.title,
        isFavorite: false,
      };
    }

    if (workspace === 'opening') {
      const openingTitle =
        matchedOpeningNode?.openingName ||
        lastMatchedOpeningInfo?.openingName ||
        '标准开局（定式研习）';
      const openingCat =
        matchedOpeningNode?.category ||
        lastMatchedOpeningInfo?.category ||
        '开局研习';
      return {
        redPlayer: '红方（定式研习）',
        blackPlayer: '黑方（定式应对）',
        event: `开局研习 · ${openingCat}`,
        date: todayStr,
        result: terminalResult,
        site: '象棋X 开局库',
        opening: openingTitle,
        isFavorite: false,
      };
    }

    if (workspace === 'setup') {
      return {
        redPlayer: '红方',
        blackPlayer: '黑方',
        event: '摆子推演',
        date: todayStr,
        result: '进行中',
        site: '象棋X 摆子工坊',
        opening: '自定义摆子局面',
        isFavorite: false,
      };
    }

    return metadata;
  }, [
    workspace,
    metadata,
    terminalOutcome,
    handicap,
    skillTier,
    playOpponentMode,
    playHumanCamp,
    matchedOpeningNode,
    lastMatchedOpeningInfo,
    currentChallenge,
  ]);

  const modalPgn = useMemo(
    () =>
      activeModal === 'fen-pgn'
        ? formatGameToPgn(exportMetadata, activeMovesList, modalBaseFen || modalFen)
        : '',
    [activeModal, exportMetadata, activeMovesList, modalBaseFen, modalFen]
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

    const playCfgForUndo =
      workspace === 'play'
        ? getPlaySetupConfig(playOpponentMode, playHumanCamp, handicap)
        : null;
    const minUndoPly =
      playCfgForUndo && playCfgForUndo.aiCamp && playCfgForUndo.baseTurn === playCfgForUndo.aiCamp
        ? 1
        : 0;
    let nextCanUndo = true;
    let nextUndoReason = '';
    if (isBotThinking) {
      nextCanUndo = false;
      nextUndoReason = '电脑正在思考应手，请稍候';
    } else if (workspace === 'play' && terminalOutcome?.kind === 'timeout') {
      nextCanUndo = false;
      nextUndoReason = '棋钟已超时判负，请点击「重开」开始新局';
    } else if (currentPly <= minUndoPly) {
      nextCanUndo = false;
      nextUndoReason = '当前处于起始步，暂无可悔着法';
    }

    let nextCanHint = true;
    let nextHintReason = '';
    if (isBotThinking) {
      nextCanHint = false;
      nextHintReason = '电脑正在思考应手，请稍候';
    } else if (terminalOutcome || !hasLegalMovesCurrentTurn) {
      nextCanHint = false;
      nextHintReason = '当前局面已终局，无可支着法';
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
    getPlaySetupConfig,
    playOpponentMode,
    playHumanCamp,
    handicap,
    isBotThinking,
    terminalOutcome,
    hasLegalMovesCurrentTurn,
    primaryEngine.status,
  ]);

  const handleStartRetryMistake = useCallback(
    (mistakeMove: MoveRecord) => {
      const prevPly = Math.max(0, mistakeMove.ply - 1);
      setVariationMoves(null);
      setBranchOriginPly(null);
      handleJumpPly(prevPly, false);
      setRetryMistakePly(mistakeMove.ply);
      if (mistakeMove.bestFrom && mistakeMove.bestTo && mistakeMove.bestAlternative) {
        setRetryTargetMove({
          from: mistakeMove.bestFrom,
          to: mistakeMove.bestTo,
          notation: mistakeMove.bestAlternative,
        });
        setRetryFeedback(
          `已回到第 ${mistakeMove.ply} 手失误前！请在左侧棋盘尝试走出正着（提示：${mistakeMove.bestAlternative}）`
        );
      }
    },
    [handleJumpPly]
  );

  const handleDemoBestAlternative = useCallback(
    (mistakeMove: MoveRecord) => {
      if (!mistakeMove.bestFrom || !mistakeMove.bestTo) return;
      const originPly = Math.max(0, mistakeMove.ply - 1);
      const prevRec = originPly > 0 ? mainMoves[originPly - 1] : null;
      const baseSnap = prevRec ? prevRec.piecesSnapshot : studyBasePieces;
      const moving = getPieceAt(baseSnap, mistakeMove.bestFrom.row, mistakeMove.bestFrom.col);
      if (!moving) return;

      const grid = buildBoardGrid(baseSnap);
      const legal = getSafeLegalMovesForPiece(moving, baseSnap, grid);
      if (!legal.some((m) => m.row === mistakeMove.bestTo!.row && m.col === mistakeMove.bestTo!.col)) {
        return;
      }

      const captured = getPieceAt(baseSnap, mistakeMove.bestTo.row, mistakeMove.bestTo.col);
      const notation = formatChineseMoveNotation(
        moving,
        mistakeMove.bestFrom,
        mistakeMove.bestTo
      );
      const nextPieces = baseSnap
        .filter(
          (p) =>
            !(p.row === mistakeMove.bestTo!.row && p.col === mistakeMove.bestTo!.col)
        )
        .map((p) =>
          p.id === moving.id
            ? { ...p, row: mistakeMove.bestTo!.row, col: mistakeMove.bestTo!.col }
            : p
        );
      const nextTurn: Camp = moving.camp === 'red' ? 'black' : 'red';
      const demoRecord: MoveRecord = {
        ply: originPly + 1,
        piece: { ...moving },
        from: { ...mistakeMove.bestFrom },
        to: { ...mistakeMove.bestTo },
        captured: captured ? { ...captured } : undefined,
        notation,
        evalScore: evaluateBoardScore(nextPieces),
        quality: '优',
        piecesSnapshot: nextPieces.map((p) => ({ ...p })),
      };

      clearBotReplyTimer();
      triggerMoveSoundAndCheckEffects(
        nextPieces,
        nextTurn,
        !!captured,
        mistakeMove.bestTo.row,
        mistakeMove.bestTo.col
      );
      setSelectedPieceId(null);
      setHintArrow(null);
      setRetryMistakePly(null);
      setRetryTargetMove(null);
      setRetryFeedback(
        `已在棋盘演示第 ${mistakeMove.ply} 手推荐正着「${notation}」（已建立推演支线，可点击「升为主线」或「回主谱」）`
      );
      setBranchOriginPly(originPly);
      setVariationMoves([...mainMoves.slice(0, originPly), demoRecord]);
      setPieces(nextPieces);
      setTurn(nextTurn);
      setCurrentPly(originPly + 1);
    },
    [
      mainMoves,
      studyBasePieces,
      clearBotReplyTimer,
      triggerMoveSoundAndCheckEffects,
    ]
  );

  const handleApplyFenModal = useCallback(
    (fenStr: string) => {
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
    },
    [handleTransferToStudy]
  );

  const handleApplyPgnSessionModal = useCallback(
    (pgnText: string, fenFallback: string) => {
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
    },
    [handleTransferToStudy]
  );

  const handleApplyParsedImportSession = useCallback(
    (session: ParsedImportSession) => {
      handleTransferToStudy({
        basePieces: session.basePieces,
        baseTurn: session.baseTurn,
        currentPieces: session.finalPieces,
        currentTurn: session.finalTurn,
        moves: session.moves,
        ply: session.moves.length,
        nextMetadata: {
          opening: session.metadata.opening || '导入棋谱',
          ...session.metadata,
          isFavorite: false,
        },
      });
      if (session.warning) {
        setImportBannerMessage(session.warning);
      } else {
        setImportBannerMessage(
          `已导入「${session.fileName}」（${session.moves.length} 手着法）`
        );
      }
    },
    [handleTransferToStudy]
  );

  const handleRestoreLibraryBackup = useCallback(
    (incomingGames: LibraryGameItem[], strategy: LibraryBackupImportStrategy) => {
      const merged = mergeLibraryBackupGames(libraryGames, incomingGames, strategy);
      setLibraryGames(merged.nextGames);
      setImportBannerMessage(
        strategy === 'replace'
          ? `已使用备份替换棋谱库（共 ${merged.nextGames.length} 局）`
          : `已合并棋谱库备份：新增 ${merged.addedCount} 局，更新 ${merged.updatedCount} 局`
      );
      return { addedCount: merged.addedCount, updatedCount: merged.updatedCount };
    },
    [libraryGames]
  );

  const handleRootFileDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsRootFileDragging(true);
  }, []);

  const handleRootFileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleRootFileDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsRootFileDragging(false);
    }
  }, []);

  const handleRootFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsRootFileDragging(false);
      const file = e.dataTransfer.files[0];
      const outcome = await parseImportedGameFile(file);
      if (outcome.kind === 'session') {
        handleApplyParsedImportSession(outcome.session);
      } else if (outcome.kind === 'library-backup') {
        setPendingDroppedBackup({
          fileName: outcome.fileName,
          games: outcome.games,
        });
      } else {
        setImportBannerMessage(outcome.error);
      }
    },
    [handleApplyParsedImportSession]
  );

  useEffect(() => {
    if (!importBannerMessage) return;
    const timer = window.setTimeout(() => setImportBannerMessage(null), 4800);
    return () => window.clearTimeout(timer);
  }, [importBannerMessage]);

  const handleLoadLibraryGameModal = useCallback(
    (game: LibraryGameItem) => {
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
    },
    [handleTransferToStudy, getSampleSession]
  );

  const handleToggleLibraryFavoriteModal = useCallback(
    (id: string) => {
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
    },
    [activeLibraryGameId]
  );

  const handleDeleteLibraryGameModal = useCallback(
    (id: string) => {
      setLibraryGames((prev) => prev.filter((g) => g.id !== id));
      if (id === activeLibraryGameId) {
        setActiveLibraryGameId(null);
        setMetadata((prev) => ({ ...prev, isFavorite: false }));
      }
    },
    [activeLibraryGameId]
  );

  const handleUpdateConnectStateModal = useCallback((next: ExternalConnectState) => {
    setConnectState(next);
    if (next.connected) {
      setWorkspace('study');
      if (next.autoAnalyze) {
        setIsAnalyzing(true);
      }
    }
  }, []);

  const topCamp: Camp = flipped ? 'red' : 'black';
  const bottomCamp: Camp = flipped ? 'black' : 'red';

  return (
    <div
      onDragEnter={handleRootFileDragEnter}
      onDragOver={handleRootFileDragOver}
      onDragLeave={handleRootFileDragLeave}
      onDrop={handleRootFileDrop}
      className="min-h-dvh min-[900px]:h-screen w-full min-[900px]:w-screen overflow-x-hidden min-[900px]:overflow-hidden flex flex-col xq-canvas select-none relative"
    >
      {/* 全局本地文件拖拽导入覆盖层 (.pgn / .xqf / .fen / .json) */}
      {isRootFileDragging && (
        <div className="fixed inset-0 z-50 bg-[var(--xq-bg-backdrop)] backdrop-blur-[2px] flex items-center justify-center p-4 pointer-events-none">
          <div className="max-w-md w-full rounded-xl border-2 border-dashed border-[var(--xq-accent-gold)] bg-[var(--xq-bg-surface)] p-6 text-center shadow-2xl space-y-2">
            <Upload className="w-8 h-8 text-[var(--xq-accent-gold)] mx-auto" />
            <div className="font-serif-sc font-bold text-base xq-text-primary">
              松开即可导入棋谱或恢复备份
            </div>
            <p className="text-xs xq-text-secondary">
              支持 .pgn（UTF-8 / GB18030）、明文 .xqf、.fen 及 象棋X .json 棋谱库备份
            </p>
          </div>
        </div>
      )}

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

      {/* #share= 分享冷启动提示条 / 全局导入通知条 / 备份合并内联确认条 */}
      {initialShareParsed.session && !shareBannerDismissed && (
        <div className="px-3 min-[900px]:px-6 py-1.5 border-b xq-border bg-[var(--xq-bg-elevated)] flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="xq-text-primary truncate">
            已通过分享链接载入对局（第 {currentPly}/{activeMovesList.length} 手）· 可直接步进看谱或自由拆棋
          </span>
          <button
            type="button"
            onClick={() => setShareBannerDismissed(true)}
            aria-label="关闭分享提示"
            className="p-1 rounded xq-text-muted hover:text-[var(--xq-text-primary)] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pendingDroppedBackup && (
        <div className="px-3 min-[900px]:px-6 py-2 border-b border-[var(--xq-accent-gold)]/55 bg-[var(--xq-accent-gold)]/10 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <span className="font-medium xq-text-primary">
            已拖入棋谱库备份「{pendingDroppedBackup.fileName}」（共 {pendingDroppedBackup.games.length} 局）：
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                handleRestoreLibraryBackup(pendingDroppedBackup.games, 'merge');
                setPendingDroppedBackup(null);
              }}
              className="px-2.5 py-1 rounded xq-btn-primary cursor-pointer"
            >
              合并去重导入
            </button>
            <button
              type="button"
              onClick={() => {
                handleRestoreLibraryBackup(pendingDroppedBackup.games, 'replace');
                setPendingDroppedBackup(null);
              }}
              className="px-2.5 py-1 rounded xq-btn-danger cursor-pointer"
            >
              覆盖当前库
            </button>
            <button
              type="button"
              onClick={() => setPendingDroppedBackup(null)}
              className="px-2 py-1 rounded xq-btn-secondary cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {importBannerMessage && (
        <div className="px-3 min-[900px]:px-6 py-1.5 border-b xq-border bg-[var(--xq-bg-elevated)] flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-[var(--xq-accent-gold)] font-medium truncate">
            {importBannerMessage}
          </span>
          <button
            type="button"
            onClick={() => setImportBannerMessage(null)}
            aria-label="关闭导入提示"
            className="p-1 rounded xq-text-muted hover:text-[var(--xq-text-primary)] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== 2. 主工作台：中央棋盘画布 + 右侧专业工作台 ==================== */}
      <main className="flex-1 min-h-0 flex flex-col min-[900px]:flex-row overflow-visible min-[900px]:overflow-hidden relative">
        {/* 左侧主画布区：桌面启用 size 容器，窄屏竖排启用 inline-size 容器防止高度塌陷 */}
        <div className="w-full min-[900px]:flex-1 min-w-0 min-[900px]:h-full min-[900px]:overflow-hidden px-2 sm:px-4 py-2 min-[900px]:py-1.5 flex flex-col items-center justify-center relative [container-type:inline-size] min-[900px]:[container-type:size]">
          <div className="w-fit max-w-full max-h-full flex flex-col items-stretch justify-center gap-1">
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
                    ? playOpponentMode === 'local-pvp'
                      ? topCamp === 'red'
                        ? '红方棋手'
                        : '黑方棋手'
                      : topCamp === playHumanCamp
                      ? `玩家（${topCamp === 'red' ? '红方' : '黑方'}）`
                      : `电脑引擎（${topCamp === 'red' ? '红方' : '黑方'}）`
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
                    ? `${
                        handicap === 'even'
                          ? '分先'
                          : handicap === 'left-horse'
                          ? '让左马'
                          : handicap === 'two-horses'
                          ? '让双马'
                          : '让先'
                      }${playOpponentMode === 'local-pvp' ? ' · 本地双人' : ''}`
                    : metadata.event
                }
                isTurn={turn === topCamp}
                isInCheck={checkPositions.inCheckCamp === topCamp}
                materialDiff={
                  topCamp === 'black'
                    ? -materialStats.netAdvantageRed
                    : materialStats.netAdvantageRed
                }
                advantagePieces={
                  topCamp === 'red'
                    ? materialStats.redAdvantagePieces
                    : materialStats.blackAdvantagePieces
                }
                useTraditionalChar={useTraditionalChar}
                clockMs={
                  clockPresetId !== 'none' && workspace === 'play'
                    ? topCamp === 'red'
                      ? clockRedMs
                      : clockBlackMs
                    : null
                }
                clockActive={
                  isClockWorkspaceActive && !clockPaused && !terminalOutcome && turn === topCamp
                }
                clockPaused={clockPaused}
                onEditGameInfo={workspace === 'study' ? handleOpenGameInfo : undefined}
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
                turn={turn}
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
                onTerminalExtraAction={
                  workspace === 'play' && mainMoves.length > 0
                    ? handleTransferPlayToStudyAndScan
                    : undefined
                }
                terminalExtraLabel={
                  workspace === 'play' && mainMoves.length > 0 ? '转入复盘并扫描' : undefined
                }
                onTerminalRestartAction={handleBoardNavNewGame}
                terminalRestartLabel={
                  workspace === 'challenge'
                    ? '重摆此关'
                    : workspace === 'play'
                    ? '再来一局'
                    : '新开一局'
                }
                drawClaimPrompt={drawClaimPrompt}
                onAcceptDrawClaim={handleAcceptDrawClaim}
                onDismissDrawClaim={handleDismissDrawClaim}
                onStepBackFromViolation={handleStepBackFromViolation}
                boardTheme={boardTheme}
                appTheme={appTheme}
                craftStyle={craftStyle}
                fontScheme={fontScheme}
                useTraditionalChar={useTraditionalChar}
                showCoordinates={showBoardCoordinates}
                flipped={flipped}
                workspace={workspace}
                setupTemplate={workspace === 'setup' ? setupSelectedTemplate : null}
                isVariationActive={!!variationMoves}
                isBotThinking={isBotThinking}
                annotationResetKey={`${workspace}-${currentPly}-${activeMovesList.length}-${variationMoves ? 'v' : 'm'}`}
                clearAnnotationsNonce={clearAnnotationsNonce}
                onUserAnnotationsChange={setHasBoardAnnotations}
                onAnnotationsSnapshotChange={setBoardAnnotations}
                onTerminalShareAction={handleOpenExportModal}
                onSelectIntersection={handleSelectIntersection}
                onEnsureSelectedPiece={handleEnsureSelectedPiece}
                onDropMove={handleDropMove}
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
                    ? playOpponentMode === 'local-pvp'
                      ? bottomCamp === 'red'
                        ? '红方棋手'
                        : '黑方棋手'
                      : bottomCamp === playHumanCamp
                      ? `玩家（${bottomCamp === 'red' ? '红方' : '黑方'}）`
                      : `电脑引擎（${bottomCamp === 'red' ? '红方' : '黑方'}）`
                    : bottomCamp === 'red'
                    ? metadata.redPlayer
                    : metadata.blackPlayer
                }
                subtitle={
                  workspace === 'opening'
                    ? matchedOpeningNode?.openingName || lastMatchedOpeningInfo?.openingName
                    : workspace === 'challenge'
                    ? currentChallenge.title
                    : workspace === 'play' && playOpponentMode === 'ai' && bottomCamp !== playHumanCamp
                    ? handicap === 'even'
                      ? '分先'
                      : handicap === 'left-horse'
                      ? '让左马'
                      : handicap === 'two-horses'
                      ? '让双马'
                      : '让先'
                    : undefined
                }
                isTurn={turn === bottomCamp}
                isInCheck={checkPositions.inCheckCamp === bottomCamp}
                materialDiff={
                  bottomCamp === 'red'
                    ? materialStats.netAdvantageRed
                    : -materialStats.netAdvantageRed
                }
                advantagePieces={
                  bottomCamp === 'red'
                    ? materialStats.redAdvantagePieces
                    : materialStats.blackAdvantagePieces
                }
                useTraditionalChar={useTraditionalChar}
                clockMs={
                  clockPresetId !== 'none' && workspace === 'play'
                    ? bottomCamp === 'red'
                      ? clockRedMs
                      : clockBlackMs
                    : null
                }
                clockActive={
                  isClockWorkspaceActive && !clockPaused && !terminalOutcome && turn === bottomCamp
                }
                clockPaused={clockPaused}
                onEditGameInfo={workspace === 'study' ? handleOpenGameInfo : undefined}
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
              hasBoardAnnotations={hasBoardAnnotations}
              onClearBoardAnnotations={handleClearBoardAnnotations}
              canNewGame={canBoardNewGame}
              newGameDisabledReason={newGameDisabledReason}
              canUndo={canBoardUndo}
              undoDisabledReason={undoDisabledReason}
              canHint={canBoardHint}
              hintDisabledReason={hintDisabledReason}
              onJumpPly={handleBoardNavJumpPly}
              onToggleReplay={handleToggleReplay}
              onNewGame={handleBoardNavNewGame}
              onFlipBoard={handleFlipBoard}
              onUndoMove={handleUndoMove}
              onTriggerHint={handleTriggerHint}
            />
          </div>

          {/* 侧栏收起时的画布右缘展开把手（仅桌面 >=900px） */}
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="展开右侧面板"
              className="hidden min-[900px]:flex absolute right-0 top-1/2 -translate-y-1/2 px-1.5 py-5 rounded-l-lg border border-r-0 xq-elevated hover:bg-[var(--xq-bg-hover)] shadow-lg flex-col items-center gap-1 cursor-pointer z-30"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--xq-accent-gold)]" />
              <span className="text-xs [writing-mode:vertical-rl] tracking-widest xq-text-secondary">
                展开面板
              </span>
            </button>
          )}
        </div>

        {/* ==================== 3. 右侧专业工作台（桌面分栏 / <900px 竖向全展开） ==================== */}
        <aside
          className={`${
            sidebarCollapsed ? 'flex min-[900px]:hidden' : 'flex'
          } w-full ${
            fontScale === 'xlarge'
              ? 'min-[900px]:w-[clamp(430px,39.5vw,600px)]'
              : fontScale === 'large'
              ? 'min-[900px]:w-[clamp(410px,38.5vw,570px)]'
              : 'min-[900px]:w-[clamp(390px,37.5vw,540px)]'
          } h-auto min-[900px]:h-full min-[900px]:min-h-0 border-t min-[900px]:border-t-0 min-[900px]:border-l xq-surface flex-col shrink-0 relative`}
        >
          {/* 侧栏折叠按钮（仅桌面 >=900px） */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            title="收起右侧栏（全屏专注盘面）"
            className="hidden min-[900px]:flex absolute -left-3 top-3 w-6 h-6 rounded-full border xq-elevated hover:bg-[var(--xq-bg-hover)] items-center justify-center shadow cursor-pointer z-20"
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
              searchMode={engineSearchMode}
              targetDepth={engineDepth}
              moveTimeMs={engineMoveTimeMs}
              streamTelemetry={streamTelemetry}
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
              onChangeSearchMode={setEngineSearchMode}
              onChangeMoveTimeMs={setEngineMoveTimeMs}
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
              /* 对弈实战工作台（人机自选执红/执黑 + 本地双人对弈） */
              <div className="min-[900px]:flex-1 flex flex-col min-[900px]:min-h-0 min-[900px]:overflow-hidden text-[0.8125rem]">
                <div className="px-3.5 py-2.5 border-b xq-border flex items-center justify-between flex-wrap gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                    <span className="font-semibold text-[0.9375rem]">对弈实战设置</span>
                  </div>
                  <span className="text-xs xq-text-muted">
                    {playOpponentMode === 'local-pvp' ? '本地双人面对面' : '支持开局随机与悔棋'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3">
                  {/* 对战形态与执方 */}
                  <div className="space-y-1.5">
                    <label className="block xq-text-secondary font-medium">
                      1. 对战模式与执方（点击立即重开）
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleStartPlayGame('ai', playHumanCamp, handicap, skillTier)
                        }
                        className={`p-2 rounded-lg text-left cursor-pointer ${
                          playOpponentMode === 'ai' ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        <div className="font-semibold text-sm">人机对弈</div>
                        <div className="text-xs xq-text-muted mt-0.5 font-normal">
                          可选执红或执黑对战电脑
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleStartPlayGame('local-pvp', playHumanCamp, handicap, skillTier)
                        }
                        className={`p-2 rounded-lg text-left cursor-pointer ${
                          playOpponentMode === 'local-pvp'
                            ? 'xq-btn-option-active'
                            : 'xq-btn-option'
                        }`}
                      >
                        <div className="font-semibold text-sm">本地双人对弈</div>
                        <div className="text-xs xq-text-muted mt-0.5 font-normal">
                          同屏轮流走子 · 棋钟仲裁
                        </div>
                      </button>
                    </div>
                    {playOpponentMode === 'ai' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleStartPlayGame('ai', 'red', handicap, skillTier)
                          }
                          className={`py-1.5 px-2.5 rounded-md text-center text-xs font-medium cursor-pointer ${
                            playHumanCamp === 'red' ? 'xq-btn-option-active' : 'xq-btn-option'
                          }`}
                        >
                          我方执红（先手）
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleStartPlayGame('ai', 'black', handicap, skillTier)
                          }
                          className={`py-1.5 px-2.5 rounded-md text-center text-xs font-medium cursor-pointer ${
                            playHumanCamp === 'black' ? 'xq-btn-option-active' : 'xq-btn-option'
                          }`}
                        >
                          我方执黑（后手）
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 让子设置 */}
                  <div className="space-y-1.5">
                    <label className="block xq-text-secondary font-medium">
                      2. 开局让子（点击立即重开）
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'even', title: '分先', desc: '双方满子，红方先行' },
                          { id: 'move-first', title: '让先', desc: '双方满子，黑方先行' },
                          {
                            id: 'left-horse',
                            title: '让左马',
                            desc:
                              playOpponentMode === 'ai' && playHumanCamp === 'black'
                                ? '红方撤去左马'
                                : '黑方撤去左马',
                          },
                          {
                            id: 'two-horses',
                            title: '让双马',
                            desc:
                              playOpponentMode === 'ai' && playHumanCamp === 'black'
                                ? '红方撤去双马'
                                : '黑方撤去双马',
                          },
                        ] as const
                      ).map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() =>
                            handleStartPlayGame(playOpponentMode, playHumanCamp, h.id, skillTier)
                          }
                          className={`p-2 rounded-lg text-left cursor-pointer ${
                            handicap === h.id ? 'xq-btn-option-active' : 'xq-btn-option'
                          }`}
                        >
                          <div className="font-semibold text-sm">{h.title}</div>
                          <div className="text-xs xq-text-muted mt-0.5 font-normal">{h.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 棋力档位选择（仅人机模式） */}
                  {playOpponentMode === 'ai' && (
                    <div className="space-y-1.5">
                      <label className="block xq-text-secondary font-medium">
                        3. 电脑棋力难度（含开局随机变化）
                      </label>
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
                  )}

                  {/* 棋钟赛制与暂停/认输/提和操控 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="xq-text-secondary font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                        <span>
                          {playOpponentMode === 'ai' ? '4.' : '3.'} 棋钟赛制（末10秒提示音）
                        </span>
                      </label>
                      {clockPresetId !== 'none' && (
                        <button
                          type="button"
                          onClick={handleToggleClockPaused}
                          className="px-2 py-0.5 rounded border xq-border xq-elevated hover:bg-[var(--xq-bg-hover)] text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {clockPaused ? (
                            <>
                              <Play className="w-3 h-3 text-[var(--xq-accent-jade)]" />
                              <span>继续计时</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 text-[var(--xq-accent-gold)]" />
                              <span>暂停</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CHESS_CLOCK_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleChangeClockPreset(preset.id)}
                          title={preset.label}
                          className={`py-1.5 rounded-md text-center font-mono-tabular cursor-pointer ${
                            clockPresetId === preset.id ? 'xq-btn-option-active' : 'xq-btn-option'
                          }`}
                        >
                          {preset.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 对局裁决：认输与提和 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!!terminalOutcome || isBotThinking}
                      onClick={handlePlayOfferDraw}
                      className="py-1.5 px-2.5 rounded-lg border xq-border xq-elevated hover:bg-[var(--xq-bg-hover)] disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                      <span>{playOpponentMode === 'local-pvp' ? '双方议和' : '向电脑提和'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!terminalOutcome || isBotThinking}
                      onClick={handlePlayResign}
                      className="py-1.5 px-2.5 rounded-lg border border-[var(--xq-accent-crimson)]/40 text-[var(--xq-accent-crimson)] hover:bg-[var(--xq-accent-crimson)]/10 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>
                        {playOpponentMode === 'local-pvp'
                          ? `${turn === 'red' ? '红方' : '黑方'}认输`
                          : '认输'}
                      </span>
                    </button>
                  </div>

                  {playActionNotice && (
                    <div className="px-2.5 py-1.5 rounded border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/10 text-xs text-[var(--xq-accent-gold)]">
                      {playActionNotice}
                    </div>
                  )}

                  {/* 当前实战着法记录 */}
                  <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
                    <div className="flex items-center justify-between text-xs xq-text-secondary">
                      <span>已走手数：{mainMoves.length} 手</span>
                      {isBotThinking && (
                        <span className="text-[var(--xq-accent-gold)] font-medium">
                          电脑思考中…
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                      {mainMoves.length === 0 ? (
                        <span className="text-xs xq-text-muted">
                          请在左侧棋盘点击或拖拽{turn === 'red' ? '红' : '黑'}方棋子走棋
                        </span>
                      ) : (
                        mainMoves.map((m) => (
                          <span
                            key={m.ply}
                            className="px-2 py-0.5 rounded border xq-border font-serif-sc text-[0.8125rem]"
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
                    className="w-full py-2.5 px-4 rounded-lg xq-btn-primary text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
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
                validation={setupValidation}
                setupPlacementError={setupPlacementError}
                onSelectSetupTemplate={handleSelectSetupTemplate}
                onChangeSetupTurn={handleChangeSetupTurn}
                onClearSetupToKings={handleClearSetupToKings}
                onResetSetupInitial={handleResetSetupInitial}
                onFinishSetup={handleFinishSetup}
              />
            ) : (
              /* 默认「复盘分析」三页签：回合棋谱 ↔ 复盘报告 ↔ 定式查询（轻量化） */
              <div className="min-[900px]:flex-1 flex flex-col min-[900px]:min-h-0 min-[900px]:overflow-hidden">
                {/* 三页签切换栏 */}
                <div className="px-3.5 pt-1.5 border-b xq-border flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
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
                <div className="px-3.5 py-1.5 border-b xq-border bg-[var(--xq-bg-canvas)]/75 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
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
                    onUpdateMoveAnnotation={handleUpdateMoveAnnotation}
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
                    batchReviewPreset={batchReviewPreset}
                    batchReviewProgress={batchReviewProgress}
                    hasScannedCurrentGame={hasScannedCurrentGame}
                    onChangeBatchReviewPreset={setBatchReviewPreset}
                    onStartBatchReview={() => handleStartBatchReview()}
                    onCancelBatchReview={handleCancelBatchReview}
                    onJumpPly={handleJumpPly}
                    onStartRetryMistake={handleStartRetryMistake}
                    onDemoBestAlternative={handleDemoBestAlternative}
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
        drawRuleStatus={drawRuleStatus}
        illegalMoveWarning={illegalMoveWarning}
        isVariationActive={!!variationMoves}
        isOpeningDrillActive={isOpeningDrillSpoilerFree}
        advantageSummary={materialStats.advantageSummary}
        playOpponentMode={playOpponentMode}
        playHumanCamp={playHumanCamp}
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
        showBoardCoordinates={showBoardCoordinates}
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
        exportCurrentPieces={pieces}
        exportCurrentTurn={turn}
        exportCurrentPly={currentPly}
        exportFlipped={flipped}
        exportAnnotations={boardAnnotations}
        initialFenPgnTab={fenPgnInitialTab}
        metadata={activeModal === 'game-info' ? metadata : exportMetadata}
        libraryGames={libraryGames}
        initialLibrarySearch={initialLibrarySearch}
        onClose={handleCloseModal}
        onOpenModal={setActiveModal}
        onSwitchWorkspace={handleSwitchWorkspace}
        onOpenOpeningBook={handleGoToOpeningWorkspace}
        onApplyFen={handleApplyFenModal}
        onApplyPgnSession={handleApplyPgnSessionModal}
        onApplyParsedImportSession={handleApplyParsedImportSession}
        onRestoreLibraryBackup={handleRestoreLibraryBackup}
        onSaveMetadata={setMetadata}
        onSaveCurrentGameToLibrary={handleSaveCurrentGameToLibrary}
        canSaveCurrentGame={canSaveCurrentGame}
        isExistingUserSave={isExistingUserSave}
        onExportLibraryGame={handleExportLibraryGame}
        onLoadLibraryGame={handleLoadLibraryGameModal}
        onToggleLibraryFavorite={handleToggleLibraryFavoriteModal}
        onDeleteLibraryGame={handleDeleteLibraryGameModal}
        onChangeAppTheme={setAppTheme}
        onChangeFontScale={setFontScale}
        onChangeSoundEnabled={setSoundEnabled}
        onChangeBoardTheme={setBoardTheme}
        onChangeCraftStyle={setCraftStyle}
        onChangeUseTraditionalChar={setUseTraditionalChar}
        onChangeShowBoardCoordinates={setShowBoardCoordinates}
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
        onUpdateConnectState={handleUpdateConnectStateModal}
        onTriggerHint={handleTriggerHint}
      />
    </div>
  );
}
