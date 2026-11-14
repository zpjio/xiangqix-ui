import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Link2,
  RefreshCw,
  Search,
  Share2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { ThemeSelect } from './ThemeSelect';
import {
  ActiveModalId,
  AppTheme,
  BoardAnnotationSnapshot,
  BoardTheme,
  Camp,
  EngineProfile,
  EngineProtocol,
  ExternalConnectState,
  ExternalPlatformId,
  FontScale,
  GameMetadata,
  LibraryGameItem,
  MoveRecord,
  Piece,
  PieceCraftStyle,
  WorkspaceMode,
} from '../types/xiangqi';
import {
  buildShareUrl,
  copyBattleReportPngToClipboard,
  downloadBattleReportPng,
  exportBattleReportPngDataUrl,
} from '../utils/shareExport';
import {
  downloadTextFile,
  formatGameToPgn,
  formatGameToWechatText,
  INITIAL_FEN,
  parsePgnTextToSession,
  sanitizeExportFilename,
} from '../utils/xiangqiRules';

interface DialogsModalSuiteProps {
  activeModal: ActiveModalId;
  appTheme: AppTheme;
  fontScale: FontScale;
  soundEnabled: boolean;
  boardTheme: BoardTheme;
  craftStyle: PieceCraftStyle;
  useTraditionalChar: boolean;
  showBoardCoordinates: boolean;
  multiPvCount: 1 | 2 | 3;
  engineDepth: 18 | 24 | 30;
  engineThreads: 4 | 8 | 16;
  engineHashMb: 256 | 512 | 1024;
  engines: EngineProfile[];
  primaryEngineId: string;
  secondaryEngineId: string;
  compareMode: boolean;
  connectState: ExternalConnectState;
  currentFen: string;
  currentPgn: string;
  exportBaseFen?: string;
  exportMoves?: MoveRecord[];
  exportCurrentPieces?: Piece[];
  exportCurrentTurn?: Camp;
  exportCurrentPly?: number;
  exportFlipped?: boolean;
  exportAnnotations?: BoardAnnotationSnapshot;
  initialFenPgnTab?: 'import' | 'export';
  metadata: GameMetadata;
  libraryGames: LibraryGameItem[];
  initialLibrarySearch?: string | null;
  onClose: () => void;
  onOpenModal?: (modal: ActiveModalId) => void;
  onSwitchWorkspace: (ws: WorkspaceMode) => void;
  onOpenOpeningBook?: () => void;
  onApplyFen: (fen: string) => boolean;
  onApplyPgnSession?: (pgnText: string, fenFallback: string) => boolean;
  onSaveMetadata: (meta: GameMetadata) => void;
  onLoadLibraryGame: (game: LibraryGameItem) => void;
  onExportLibraryGame?: (game: LibraryGameItem) => void;
  onSaveCurrentGameToLibrary?: () => void;
  canSaveCurrentGame?: boolean;
  isExistingUserSave?: boolean;
  onToggleLibraryFavorite: (id: string) => void;
  onDeleteLibraryGame: (id: string) => void;
  onChangeAppTheme: (theme: AppTheme) => void;
  onChangeFontScale: (scale: FontScale) => void;
  onChangeSoundEnabled: (enabled: boolean) => void;
  onChangeBoardTheme: (theme: BoardTheme) => void;
  onChangeCraftStyle: (style: PieceCraftStyle) => void;
  onChangeUseTraditionalChar: (useTrad: boolean) => void;
  onChangeShowBoardCoordinates: (show: boolean) => void;
  onChangeMultiPvCount: (count: 1 | 2 | 3) => void;
  onChangeEngineDepth: (depth: 18 | 24 | 30) => void;
  onChangeEngineThreads: (threads: 4 | 8 | 16) => void;
  onChangeEngineHashMb: (hashMb: 256 | 512 | 1024) => void;
  onChangePrimaryEngine: (id: string) => void;
  onChangeSecondaryEngine: (id: string) => void;
  onToggleCompareMode: () => void;
  onInstallEngine: (id: string) => void;
  onResetEngineMissing: (id: string) => void;
  onAddCustomEngine: (fileName: string, protocol: EngineProtocol) => void;
  onUpdateConnectState: (next: ExternalConnectState) => void;
  onTriggerHint: () => void;
}

const SAMPLE_IMAGE_RECOGNITIONS: {
  id: string;
  title: string;
  source: string;
  fen: string;
  summary: string;
}[] = [
  {
    id: 'img-midgame',
    title: '中盘车炮激战截图',
    source: '天天象棋评测室截图',
    fen: 'r1bakab1r/9/1cn4c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR w - - 0 8',
    summary: '识别出 30 枚棋子（红方架中炮过河车，黑方屏风马固防）',
  },
  {
    id: 'img-qixing',
    title: '《七星聚会》棋书内页',
    source: '印刷棋谱扫描图',
    fen: '5k3/4a4/4b4/7R1/3r4R/1p7/9/4p4/4pp3/4K3C w - - 0 1',
    summary: '识别出 14 枚棋子（红黑各 7 子，双车一炮对车三卒经典杀局）',
  },
  {
    id: 'img-endgame',
    title: '车马冷着攻杀实战图',
    source: 'JJ象棋复盘截图',
    fen: '3ak4/4a4/4b4/6N2/8R/9/9/9/4p4/3AK4 w - - 0 1',
    summary: '识别出 9 枚棋子（红方车马联攻黑方双士单象）',
  },
];

export const DialogsModalSuite: React.FC<DialogsModalSuiteProps> = React.memo(({
  activeModal,
  appTheme,
  fontScale,
  soundEnabled,
  boardTheme,
  craftStyle,
  useTraditionalChar,
  showBoardCoordinates,
  multiPvCount,
  engineDepth,
  engineThreads,
  engineHashMb,
  engines,
  primaryEngineId,
  secondaryEngineId,
  compareMode,
  connectState,
  currentFen,
  currentPgn,
  exportBaseFen,
  exportMoves = [],
  exportCurrentPieces,
  exportCurrentTurn = 'red',
  exportCurrentPly,
  exportFlipped = false,
  exportAnnotations,
  initialFenPgnTab = 'import',
  metadata,
  libraryGames,
  initialLibrarySearch = null,
  onClose,
  onOpenModal,
  onSwitchWorkspace,
  onOpenOpeningBook,
  onApplyFen,
  onApplyPgnSession,
  onSaveMetadata,
  onLoadLibraryGame,
  onExportLibraryGame,
  onSaveCurrentGameToLibrary,
  canSaveCurrentGame = true,
  isExistingUserSave = false,
  onToggleLibraryFavorite,
  onDeleteLibraryGame,
  onChangeAppTheme,
  onChangeFontScale,
  onChangeSoundEnabled,
  onChangeBoardTheme,
  onChangeCraftStyle,
  onChangeUseTraditionalChar,
  onChangeShowBoardCoordinates,
  onChangeMultiPvCount,
  onChangeEngineDepth,
  onChangeEngineThreads,
  onChangeEngineHashMb,
  onChangePrimaryEngine,
  onChangeSecondaryEngine,
  onToggleCompareMode,
  onInstallEngine,
  onResetEngineMissing,
  onAddCustomEngine,
  onUpdateConnectState,
  onTriggerHint,
}) => {
  const [cmdQuery, setCmdQuery] = useState('');
  const [fenPgnTab, setFenPgnTab] = useState<'import' | 'export'>(initialFenPgnTab);
  const [importMode, setImportMode] = useState<'fen-pgn' | 'image'>('fen-pgn');
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [pgnDirty, setPgnDirty] = useState(false);
  const [fenError, setFenError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'pgn' | 'wechat'>('pgn');
  const [exportIncludeNotes, setExportIncludeNotes] = useState<boolean>(false);
  const [copiedFen, setCopiedFen] = useState(false);
  const [copiedExportText, setCopiedExportText] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [pngCopyStatus, setPngCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // 图片识别状态
  const [imgTurn, setImgTurn] = useState<Camp>('red');
  const [selectedSampleImgId, setSelectedSampleImgId] = useState<string>(
    SAMPLE_IMAGE_RECOGNITIONS[0].id
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // 棋谱库与元数据编辑状态
  const [metaDraft, setMetaDraft] = useState<GameMetadata>(metadata);
  const [libCategory, setLibCategory] = useState<'all' | 'favorite' | 'master' | 'ancient' | 'user'>('all');
  const [libResultFilter, setLibResultFilter] = useState<'all' | '红胜' | '黑胜' | '和棋'>('all');
  const [libSortBy, setLibSortBy] = useState<'default' | 'date-desc' | 'plies-desc' | 'accuracy-desc'>('default');
  const [libSearch, setLibSearch] = useState('');
  const [libSaveToast, setLibSaveToast] = useState(false);

  // 连线配置草稿
  const [connectPlatform, setConnectPlatform] = useState<ExternalPlatformId>(
    connectState.platform
  );
  const [connectAutoAnalyze, setConnectAutoAnalyze] = useState<boolean>(
    connectState.autoAnalyze
  );

  // 关于检查更新状态
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'latest'>('idle');

  const feedbackTimersRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      feedbackTimersRef.current.forEach((id) => window.clearTimeout(id));
      feedbackTimersRef.current = [];
    };
  }, []);

  const scheduleFeedbackReset = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(() => {
      feedbackTimersRef.current = feedbackTimersRef.current.filter((t) => t !== id);
      fn();
    }, delayMs);
    feedbackTimersRef.current.push(id);
  }, []);

  useEffect(() => {
    setMetaDraft(metadata);
    if (activeModal === 'fen-pgn') {
      setFenPgnTab(initialFenPgnTab);
      setFenInput('');
      setPgnInput('');
      setPgnDirty(false);
      setFenError(null);
      setCopiedFen(false);
      setCopiedExportText(false);
      setCopiedShareUrl(false);
      setPngCopyStatus('idle');
    }
    if (activeModal === 'library') {
      setLibSearch(initialLibrarySearch || '');
      if (initialLibrarySearch) {
        setLibCategory('all');
        setLibResultFilter('all');
      }
    }
  }, [metadata, activeModal, initialLibrarySearch, initialFenPgnTab]);

  const parsedPgnPreview = useMemo(() => {
    if (activeModal !== 'fen-pgn' || fenPgnTab !== 'import' || importMode !== 'fen-pgn' || !pgnDirty) {
      return null;
    }
    return parsePgnTextToSession(pgnInput, fenInput.trim() || undefined);
  }, [activeModal, fenPgnTab, importMode, pgnDirty, pgnInput, fenInput]);

  const effectiveExportBaseFen = exportBaseFen || currentFen || INITIAL_FEN;
  const effectiveExportPly = exportCurrentPly ?? exportMoves.length;
  const effectiveAnnotations = useMemo<BoardAnnotationSnapshot>(
    () => exportAnnotations || { arrows: [], circles: [] },
    [exportAnnotations]
  );

  const exportPreviewText = useMemo(() => {
    if (activeModal !== 'fen-pgn') return '';
    if (exportFormat === 'wechat') {
      return formatGameToWechatText(
        metadata,
        exportMoves,
        effectiveExportBaseFen,
        exportIncludeNotes
      );
    }
    return formatGameToPgn(
      metadata,
      exportMoves,
      effectiveExportBaseFen,
      exportIncludeNotes
    );
  }, [
    activeModal,
    exportFormat,
    metadata,
    exportMoves,
    effectiveExportBaseFen,
    exportIncludeNotes,
  ]);

  const shareDirectUrl = useMemo(() => {
    if (activeModal !== 'fen-pgn' || fenPgnTab !== 'export') return '';
    return buildShareUrl({
      baseFen: effectiveExportBaseFen,
      moves: exportMoves,
      currentPly: effectiveExportPly,
      flipped: exportFlipped,
      metadata,
    });
  }, [
    activeModal,
    fenPgnTab,
    effectiveExportBaseFen,
    exportMoves,
    effectiveExportPly,
    exportFlipped,
    metadata,
  ]);

  const battlePosterOptions = useMemo(() => {
    if (activeModal !== 'fen-pgn' || fenPgnTab !== 'export' || !exportCurrentPieces) {
      return null;
    }
    const lastMoveAtPly =
      effectiveExportPly > 0 ? exportMoves[effectiveExportPly - 1] || null : null;
    return {
      pieces: exportCurrentPieces,
      turn: exportCurrentTurn,
      lastMove: lastMoveAtPly,
      currentPly: effectiveExportPly,
      totalPlies: exportMoves.length,
      metadata,
      boardTheme,
      appTheme,
      craftStyle,
      useTraditionalChar,
      showCoordinates: showBoardCoordinates,
      flipped: exportFlipped,
      annotations: effectiveAnnotations,
    };
  }, [
    activeModal,
    fenPgnTab,
    exportCurrentPieces,
    exportCurrentTurn,
    effectiveExportPly,
    exportMoves,
    metadata,
    boardTheme,
    appTheme,
    craftStyle,
    useTraditionalChar,
    showBoardCoordinates,
    exportFlipped,
    effectiveAnnotations,
  ]);

  const battlePosterPreviewUrl = useMemo(() => {
    if (!battlePosterOptions) return '';
    return exportBattleReportPngDataUrl(battlePosterOptions);
  }, [battlePosterOptions]);

  const filteredCommands = useMemo(() => {
    if (activeModal !== 'command-palette') return [];
    const commands = [
      {
        id: 'cmd-study',
        label: '切换至「复盘分析」',
        shortcut: '1',
        action: () => {
          onSwitchWorkspace('study');
          onClose();
        },
      },
      {
        id: 'cmd-opening',
        label: '进入「开局研习」（定式树探索 · 变例对练）',
        shortcut: '2',
        action: () => {
          onSwitchWorkspace('opening');
          onClose();
        },
      },
      {
        id: 'cmd-challenge',
        label: '进入「残局题库」（七星聚会 / 野马操田）',
        shortcut: '3',
        action: () => {
          onSwitchWorkspace('challenge');
          onClose();
        },
      },
      {
        id: 'cmd-play',
        label: '开启「人机 / 双人对弈」（自选执红/执黑 · 本地面对面）',
        shortcut: '4',
        action: () => {
          onSwitchWorkspace('play');
          onClose();
        },
      },
      {
        id: 'cmd-setup',
        label: '打开「摆子编辑」自由摆设局面',
        shortcut: '5',
        action: () => {
          onSwitchWorkspace('setup');
          onClose();
        },
      },
      {
        id: 'cmd-game-info',
        label: '编辑对局信息（红黑棋手 / 赛事 / 开局）',
        shortcut: 'G',
        action: () => {
          onOpenModal?.('game-info');
        },
      },
      {
        id: 'cmd-export',
        label: '分享战报与导出（高清战报图 .png / 分享直链 / .pgn / .fen）',
        shortcut: 'E',
        action: () => {
          setFenPgnTab('export');
          if (onOpenModal) {
            onOpenModal('fen-pgn');
          }
        },
      },
      {
        id: 'cmd-import-fen',
        label: '导入 FEN / PGN 棋谱至「复盘分析」',
        shortcut: 'F',
        action: () => {
          setFenPgnTab('import');
          setImportMode('fen-pgn');
          if (onOpenModal) {
            onOpenModal('fen-pgn');
          }
        },
      },
      {
        id: 'cmd-image-board',
        label: '从图片识别导入至「复盘分析」（截图识谱）',
        shortcut: 'I',
        action: () => {
          setFenPgnTab('import');
          setImportMode('image');
          if (onOpenModal) {
            onOpenModal('fen-pgn');
          }
        },
      },
      {
        id: 'cmd-connect',
        label: '连线外部平台同步观棋分析（天天/JJ象棋）',
        shortcut: 'L',
        action: () => {
          onUpdateConnectState({
            connected: true,
            platform: 'tiantian',
            platformLabel: '天天象棋桌面版',
            autoAnalyze: true,
          });
          onSwitchWorkspace('study');
          onClose();
        },
      },
      {
        id: 'cmd-compare',
        label: compareMode
          ? '关闭「双擎并行对比」恢复单引擎视图'
          : '开启「双擎并行对比」（皮卡鱼 vs 旋风/天机同盘交叉印证）',
        shortcut: 'C',
        action: () => {
          onToggleCompareMode();
          onSwitchWorkspace('study');
          onClose();
        },
      },
      {
        id: 'cmd-hint',
        label: '请求引擎「支招」',
        shortcut: 'H',
        action: () => {
          onTriggerHint();
          onClose();
        },
      },
      {
        id: 'cmd-theme',
        label: '循环切换护眼主题（深色夜案 → 清朗浅色 → 温润护眼）',
        shortcut: 'T',
        action: () => {
          onChangeAppTheme(
            appTheme === 'dark' ? 'light' : appTheme === 'light' ? 'eyecare' : 'dark'
          );
          onClose();
        },
      },
      {
        id: 'cmd-theme-eyecare',
        label: '直达「温润护眼」低蓝光纸质模式',
        shortcut: 'Y',
        action: () => {
          onChangeAppTheme('eyecare');
          onClose();
        },
      },
      {
        id: 'cmd-board-coords',
        label: showBoardCoordinates ? '隐藏棋盘路数坐标 (九~一 / 1~9)' : '显示棋盘路数坐标 (九~一 / 1~9)',
        shortcut: 'N',
        action: () => {
          onChangeShowBoardCoordinates(!showBoardCoordinates);
          onClose();
        },
      },
    ];
    const q = cmdQuery.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [
    activeModal,
    cmdQuery,
    compareMode,
    appTheme,
    showBoardCoordinates,
    onSwitchWorkspace,
    onClose,
    onOpenModal,
    onUpdateConnectState,
    onToggleCompareMode,
    onTriggerHint,
    onChangeAppTheme,
    onChangeShowBoardCoordinates,
  ]);

  const libraryStats = useMemo(() => {
    if (activeModal !== 'library') {
      return { total: libraryGames.length, fav: 0, master: 0, ancient: 0, user: 0 };
    }
    let fav = 0;
    let master = 0;
    let ancient = 0;
    let user = 0;
    for (const g of libraryGames) {
      if (g.isFavorite) fav++;
      if (g.category === 'master') master++;
      else if (g.category === 'ancient') ancient++;
      else if (g.category === 'user') user++;
    }
    return { total: libraryGames.length, fav, master, ancient, user };
  }, [activeModal, libraryGames]);

  const filteredLibrary = useMemo(() => {
    if (activeModal !== 'library') return [];
    const q = libSearch.trim().toLowerCase();
    const list = libraryGames.filter((g) => {
      if (libCategory === 'favorite' && !g.isFavorite) return false;
      if (libCategory === 'master' && g.category !== 'master') return false;
      if (libCategory === 'ancient' && g.category !== 'ancient') return false;
      if (libCategory === 'user' && g.category !== 'user') return false;
      if (libResultFilter !== 'all' && g.result !== libResultFilter) return false;
      if (q) {
        return (
          g.redPlayer.toLowerCase().includes(q) ||
          g.blackPlayer.toLowerCase().includes(q) ||
          g.event.toLowerCase().includes(q) ||
          g.opening.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (libSortBy === 'date-desc') {
      return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    if (libSortBy === 'plies-desc') {
      return [...list].sort((a, b) => b.pliesCount - a.pliesCount);
    }
    if (libSortBy === 'accuracy-desc') {
      return [...list].sort(
        (a, b) =>
          (b.accuracyRed + b.accuracyBlack) / 2 - (a.accuracyRed + a.accuracyBlack) / 2
      );
    }
    return list;
  }, [activeModal, libraryGames, libCategory, libResultFilter, libSearch, libSortBy]);

  const filteredOutcomeCounts = useMemo(() => {
    let red = 0;
    let black = 0;
    let draw = 0;
    for (const g of filteredLibrary) {
      if (g.result === '红胜') red++;
      else if (g.result === '黑胜') black++;
      else if (g.result === '和棋') draw++;
    }
    return { red, black, draw };
  }, [filteredLibrary]);

  if (!activeModal) return null;

  const activeSampleRecognition =
    SAMPLE_IMAGE_RECOGNITIONS.find((s) => s.id === selectedSampleImgId) ||
    SAMPLE_IMAGE_RECOGNITIONS[0];

  const platformOptions: { id: ExternalPlatformId; label: string; desc: string }[] = [
    {
      id: 'tiantian',
      label: '天天象棋桌面版',
      desc: '自动识别PC端/微信天天象棋窗口并实时同步着法',
    },
    {
      id: 'jj',
      label: 'JJ象棋大厅',
      desc: '实时捕获JJ象棋对局窗口，复用「复盘分析」计算主变',
    },
    {
      id: 'emulator',
      label: '安卓模拟器 / 通用棋盘',
      desc: '兼容雷电、MuMu等模拟器内的主流象棋客户端窗口',
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-150"
      style={{
        backgroundColor:
          activeModal === 'settings'
            ? 'var(--xq-bg-settings-backdrop)'
            : 'var(--xq-bg-backdrop)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${
          activeModal === 'settings' || activeModal === 'library' || activeModal === 'fen-pgn'
            ? 'max-w-3xl'
            : 'max-w-2xl'
        } max-h-[90vh] overflow-y-auto rounded-xl border xq-elevated shadow-2xl animate-in fade-in zoom-in-95 duration-150`}
      >
        {/* ==================== 1. 命令面板 (⌘K) ==================== */}
        {activeModal === 'command-palette' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b xq-border pb-2.5">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 xq-text-muted" />
                <input
                  type="text"
                  value={cmdQuery}
                  onChange={(e) => setCmdQuery(e.target.value)}
                  placeholder="输入指令搜索（如：图片识别、连线、残局题库、人机对弈、支招…）"
                  autoFocus
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.action}
                  className={`w-full px-3 py-2 rounded-lg text-left text-[0.8125rem] flex items-center justify-between transition-colors cursor-pointer ${
                    idx === 0
                      ? 'bg-[var(--xq-bg-active)] font-medium'
                      : 'hover:bg-[var(--xq-bg-hover)]'
                  }`}
                >
                  <span>{cmd.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--xq-bg-canvas)] border xq-border font-mono-tabular text-xs xq-text-muted">
                    {cmd.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 2. 棋谱库（分类计数 + 筛选排序 + 存局入库） ==================== */}
        {activeModal === 'library' && (
          <div className="p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b xq-border pb-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-base font-semibold whitespace-nowrap">
                  棋谱库
                  <span className="ml-1.5 text-xs font-mono-tabular font-normal xq-text-muted">
                    共 {libraryStats.total} 局
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onSaveCurrentGameToLibrary && (
                  <button
                    type="button"
                    disabled={!canSaveCurrentGame}
                    onClick={() => {
                      onSaveCurrentGameToLibrary();
                      setLibSaveToast(true);
                      scheduleFeedbackReset(() => setLibSaveToast(false), 1800);
                    }}
                    title={
                      !canSaveCurrentGame
                        ? '走子或导入局面后即可存入棋谱库'
                        : isExistingUserSave
                        ? '原地更新棋谱库中的当前对局'
                        : '将当前对局保存至「自存对局」'
                    }
                    className={`px-3 py-1 rounded-md text-[0.8125rem] flex items-center gap-1.5 whitespace-nowrap ${
                      canSaveCurrentGame
                        ? 'xq-btn-primary cursor-pointer'
                        : 'xq-btn-secondary opacity-45 cursor-not-allowed'
                    }`}
                  >
                    {libSaveToast ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {libSaveToast
                        ? '已保存到棋谱库'
                        : isExistingUserSave
                        ? '更新当前存局'
                        : '保存当前对局入库'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 双库分工提示条 + 跳转开局研习 */}
            <div className="px-3 py-1.5 rounded-md bg-[var(--xq-bg-canvas)] border xq-border flex items-center justify-between flex-wrap gap-2 text-xs xq-text-muted">
              <span className="min-w-0 truncate">
                棋谱库收录整局名局与自存复盘 · 按盘面查定式胜率或练布局请前往「开局研习」
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onOpenOpeningBook) {
                    onOpenOpeningBook();
                  } else {
                    onSwitchWorkspace('opening');
                  }
                  onClose();
                }}
                className="text-[var(--xq-accent-gold)] font-medium hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                打开开局研习 →
              </button>
            </div>

            {/* 分类计数 Tabs */}
            <div className="flex items-center gap-1.5 text-[0.8125rem] overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: `全部 (${libraryStats.total})` },
                  { id: 'favorite', label: `★ 我的收藏 (${libraryStats.fav})` },
                  { id: 'master', label: `现代名局 (${libraryStats.master})` },
                  { id: 'ancient', label: `古谱名局 (${libraryStats.ancient})` },
                  { id: 'user', label: `自存对局 (${libraryStats.user})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLibCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap font-mono-tabular ${
                    libCategory === tab.id ? 'xq-btn-option-active' : 'xq-btn-option'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 搜索 + 赛果筛选 + 排序 */}
            <div className="flex items-center flex-wrap gap-2 text-[0.8125rem]">
              <div className="relative flex-1 min-w-[12rem]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 xq-text-muted" />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="搜索棋手、赛事、开局体系…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
                />
              </div>

              <div className="w-[7.5rem] shrink-0">
                <ThemeSelect
                  ariaLabel="按赛果筛选"
                  value={libResultFilter}
                  onChange={setLibResultFilter}
                  triggerClassName="px-2.5 py-1.5"
                  menuMinWidthClass="min-w-[8rem]"
                  options={[
                    { value: 'all', label: '全部赛果' },
                    { value: '红胜', label: '红胜' },
                    { value: '黑胜', label: '黑胜' },
                    { value: '和棋', label: '和棋' },
                  ]}
                />
              </div>

              <div className="w-[8rem] shrink-0">
                <ThemeSelect
                  ariaLabel="排序方式"
                  value={libSortBy}
                  onChange={setLibSortBy}
                  menuAlign="right"
                  triggerClassName="px-2.5 py-1.5"
                  menuMinWidthClass="min-w-[8.5rem]"
                  options={[
                    { value: 'default', label: '默认排序' },
                    { value: 'date-desc', label: '最新日期' },
                    { value: 'plies-desc', label: '手数最多' },
                    { value: 'accuracy-desc', label: '精准度最高' },
                  ]}
                />
              </div>
            </div>

            {/* 当前筛选数量与胜负分布汇总条 */}
            <div className="flex items-center justify-between text-xs xq-text-muted px-0.5 font-mono-tabular">
              <span>
                命中 {filteredLibrary.length} 局 · 红胜 {filteredOutcomeCounts.red} · 黑胜{' '}
                {filteredOutcomeCounts.black} · 和棋 {filteredOutcomeCounts.draw}
              </span>
              {(libSearch || libCategory !== 'all' || libResultFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setLibSearch('');
                    setLibCategory('all');
                    setLibResultFilter('all');
                    setLibSortBy('default');
                  }}
                  className="text-[var(--xq-accent-gold)] hover:underline cursor-pointer"
                >
                  重置筛选
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
              {filteredLibrary.length === 0 ? (
                <div className="py-8 text-center text-[0.8125rem] xq-text-muted">
                  暂无匹配棋谱（可点击右上角「保存当前对局入库」或在棋谱栏点击「存局」）
                </div>
              ) : (
                filteredLibrary.map((game) => (
                  <div
                    key={game.id}
                    className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] hover:bg-[var(--xq-bg-hover)] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[0.8125rem]">
                        <span className="font-semibold text-[var(--xq-accent-crimson)] truncate">
                          {game.redPlayer}
                        </span>
                        <span className="xq-text-muted">vs</span>
                        <span className="font-semibold truncate">{game.blackPlayer}</span>
                        <span className="xq-text-muted">·</span>
                        <span className="text-xs xq-text-secondary whitespace-nowrap">
                          {game.result}
                        </span>
                        <span className="xq-text-muted">·</span>
                        <span className="font-mono-tabular text-xs xq-text-secondary whitespace-nowrap">
                          {game.pliesCount}手
                        </span>
                        <span className="xq-text-muted">·</span>
                        <span className="font-mono-tabular text-xs text-[var(--xq-accent-jade)] whitespace-nowrap">
                          {game.accuracyRed}% / {game.accuracyBlack}%
                        </span>
                      </div>
                      <div className="text-xs xq-text-muted mt-0.5 truncate">
                        {game.opening} · {game.event} ({game.date})
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleLibraryFavorite(game.id)}
                        title={game.isFavorite ? '取消收藏' : '加入收藏'}
                        className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            game.isFavorite
                              ? 'fill-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)]'
                              : 'xq-text-muted'
                          }`}
                        />
                      </button>
                      {onExportLibraryGame && (
                        <button
                          type="button"
                          onClick={() => onExportLibraryGame(game)}
                          title="下载标准 .pgn 棋谱文件"
                          className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
                        >
                          <ArrowUpFromLine className="w-3.5 h-3.5 opacity-85" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onLoadLibraryGame(game);
                          onClose();
                        }}
                        className="px-3 py-1 rounded-md xq-btn-primary text-[0.8125rem] cursor-pointer whitespace-nowrap"
                      >
                        载入棋谱
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLibraryGame(game.id)}
                        className="p-1.5 rounded-md xq-btn-danger cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================== 3. 导入与导出（双页签分流：导入至复盘 / 导出当前对局） ==================== */}
        {activeModal === 'fen-pgn' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b xq-border pb-3 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-base font-semibold">导入与导出</h3>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--xq-bg-canvas)] border xq-border text-[0.8125rem]">
                    <button
                      type="button"
                      onClick={() => {
                        setFenPgnTab('import');
                        setFenError(null);
                      }}
                      className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                        fenPgnTab === 'import'
                          ? 'bg-[var(--xq-bg-active)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>导入至复盘</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFenPgnTab('export');
                        setFenError(null);
                      }}
                      className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                        fenPgnTab === 'export'
                          ? 'bg-[var(--xq-bg-active)] text-[var(--xq-accent-gold)] font-semibold'
                          : 'xq-text-secondary hover:text-[var(--xq-text-primary)]'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>分享与导出</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs xq-text-muted">
                  {fenPgnTab === 'import'
                    ? '支持粘贴 FEN、中文纵线 PGN 棋谱或截图识盘，确认后自动载入「复盘分析」'
                    : `支持导出高清战报图 (.png)、生成直链还原第 ${effectiveExportPly} 手盘面，及标准 .pgn / .fen 文本`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer self-start shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {fenPgnTab === 'export' ? (
              /* -------------------- 分享与导出当前对局页签 -------------------- */
              <div className="space-y-3.5 text-[0.8125rem]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* 左列：高清棋盘战报图 PNG 预览与一键下载/复制 */}
                  <div className="md:col-span-5 p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold xq-text-primary flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                        <span>高清战报图 (.png)</span>
                      </span>
                      <span className="text-xs xq-text-muted font-mono-tabular">
                        1080×1400
                      </span>
                    </div>

                    {battlePosterPreviewUrl ? (
                      <div className="rounded-md overflow-hidden border xq-border bg-black/20 flex items-center justify-center">
                        <img
                          src={battlePosterPreviewUrl}
                          alt="棋盘高清战报预览"
                          className="w-full max-h-[19rem] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-56 rounded-md border xq-border flex items-center justify-center text-xs xq-text-muted">
                        正在生成战报预览…
                      </div>
                    )}

                    <div className="text-xs xq-text-muted leading-snug">
                      {effectiveAnnotations.arrows.length + effectiveAnnotations.circles.length > 0
                        ? `已收录 ${effectiveAnnotations.arrows.length + effectiveAnnotations.circles.length} 处手绘标注、路数坐标与红黑对局信息`
                        : '含当前棋具材质、路数坐标、净多子力与红黑对局信息'}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!battlePosterOptions}
                        onClick={() => {
                          if (battlePosterOptions) {
                            downloadBattleReportPng(battlePosterOptions);
                          }
                        }}
                        className="py-1.5 px-2.5 rounded-md xq-btn-primary flex items-center justify-center gap-1 text-xs cursor-pointer whitespace-nowrap disabled:opacity-45"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>下载战报图</span>
                      </button>
                      <button
                        type="button"
                        disabled={!battlePosterOptions}
                        onClick={async () => {
                          if (!battlePosterOptions) return;
                          const ok = await copyBattleReportPngToClipboard(battlePosterOptions);
                          setPngCopyStatus(ok ? 'copied' : 'failed');
                          scheduleFeedbackReset(() => setPngCopyStatus('idle'), 2000);
                        }}
                        className="py-1.5 px-2.5 rounded-md xq-btn-secondary flex items-center justify-center gap-1 text-xs cursor-pointer whitespace-nowrap disabled:opacity-45"
                      >
                        {pngCopyStatus === 'copied' ? (
                          <Check className="w-3.5 h-3.5 text-[var(--xq-accent-jade)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {pngCopyStatus === 'copied'
                            ? '已复制图片'
                            : pngCopyStatus === 'failed'
                            ? '请改用下载'
                            : '复制图片'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 右列：直链分享 + FEN 快照 + PGN/微信棋谱 */}
                  <div className="md:col-span-7 space-y-3">
                    {/* 1. URL 直链分享 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold xq-text-secondary flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                          <span>1. 直链无损分享（打开即还原第 {effectiveExportPly} 手）</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={shareDirectUrl}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs xq-text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(shareDirectUrl).catch(() => {});
                            setCopiedShareUrl(true);
                            scheduleFeedbackReset(() => setCopiedShareUrl(false), 1600);
                          }}
                          className="px-3 py-1.5 rounded-md xq-btn-primary flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {copiedShareUrl ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedShareUrl ? '已复制直链' : '复制直链'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. 当前局面 FEN 快照 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold xq-text-secondary">
                          2. 当前盘面 FEN 编码
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <input
                          type="text"
                          readOnly
                          value={currentFen}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-[10rem] px-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs xq-text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(currentFen).catch(() => {});
                            setCopiedFen(true);
                            scheduleFeedbackReset(() => setCopiedFen(false), 1600);
                          }}
                          className="px-2.5 py-1.5 rounded-md xq-btn-secondary flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          {copiedFen ? (
                            <Check className="w-3.5 h-3.5 text-[var(--xq-accent-jade)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedFen ? '已复制' : '复制'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const baseName = sanitizeExportFilename(
                              `${metadata.opening || 'position'}_${metadata.date || ''}`
                            );
                            downloadTextFile(`${baseName}.fen`, `${currentFen}\n`);
                          }}
                          className="px-2.5 py-1.5 rounded-md xq-btn-secondary flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowUpFromLine className="w-3.5 h-3.5 opacity-85" />
                          <span>.fen</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. 完整棋谱导出（标准 PGN / 微信纯中文文本 + 可选评分批注） */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExportFormat('pgn')}
                            className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap ${
                              exportFormat === 'pgn' ? 'xq-btn-option-active' : 'xq-btn-option'
                            }`}
                          >
                            标准 PGN
                          </button>
                          <button
                            type="button"
                            onClick={() => setExportFormat('wechat')}
                            className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap ${
                              exportFormat === 'wechat' ? 'xq-btn-option-active' : 'xq-btn-option'
                            }`}
                          >
                            微信纯中文
                          </button>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer xq-text-secondary select-none text-xs">
                          <input
                            type="checkbox"
                            checked={exportIncludeNotes}
                            onChange={(e) => setExportIncludeNotes(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[var(--xq-accent-primary)] cursor-pointer"
                          />
                          <span>附带引擎评分（手写批注默认保留）</span>
                        </label>
                      </div>

                      <textarea
                        rows={5}
                        readOnly
                        value={exportPreviewText}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full p-2.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs leading-relaxed"
                      />

                      <div className="text-xs xq-text-muted font-mono-tabular">
                        {exportMoves.length > 0
                          ? `已包含起始基准 [FEN] 与全盘 ${exportMoves.length} 手着法 · 可无损重导`
                          : '当前尚无实走着法，导出仅含对局信息与起始 [FEN]'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t xq-border">
                  <button
                    type="button"
                    onClick={() => setFenPgnTab('import')}
                    className="text-[0.8125rem] xq-text-secondary hover:text-[var(--xq-accent-gold)] cursor-pointer"
                  >
                    ← 切换到「导入至复盘」
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(exportPreviewText).catch(() => {});
                        setCopiedExportText(true);
                        scheduleFeedbackReset(() => setCopiedExportText(false), 1600);
                      }}
                      className="px-3.5 py-1.5 rounded-md xq-btn-secondary flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedExportText ? (
                        <Check className="w-3.5 h-3.5 text-[var(--xq-accent-jade)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedExportText
                          ? '已复制内容'
                          : exportFormat === 'pgn'
                          ? '复制 PGN'
                          : '复制微信文本'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pgnContent = formatGameToPgn(
                          metadata,
                          exportMoves,
                          effectiveExportBaseFen,
                          exportIncludeNotes
                        );
                        const fileName = sanitizeExportFilename(
                          `${metadata.redPlayer}_vs_${metadata.blackPlayer}_${metadata.opening || 'xiangqi'}`
                        );
                        downloadTextFile(`${fileName}.pgn`, pgnContent);
                      }}
                      className="px-4 py-1.5 rounded-md xq-btn-secondary flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ArrowUpFromLine className="w-3.5 h-3.5" />
                      <span>下载 .pgn</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* -------------------- 导入至复盘页签 -------------------- */
              <div className="space-y-3.5 text-[0.8125rem]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('fen-pgn');
                      setFenError(null);
                    }}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${
                      importMode === 'fen-pgn' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>FEN / PGN 文本</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('image');
                      setFenError(null);
                    }}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${
                      importMode === 'image' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>图片识别局面</span>
                  </button>
                </div>

                {importMode === 'fen-pgn' ? (
                  <div className="space-y-3.5">
                    {/* FEN 粘贴区 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold xq-text-secondary">
                          1. 粘贴 FEN 局面编码（单局面导入）
                        </span>
                        <div className="flex items-center gap-2 text-xs xq-text-secondary">
                          <button
                            type="button"
                            onClick={() => {
                              setFenInput(INITIAL_FEN);
                              setPgnDirty(false);
                              setFenError(null);
                            }}
                            className="hover:underline cursor-pointer"
                          >
                            标准开局
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFenInput(
                                '5k3/4a4/4b4/7R1/3r4R/1p7/9/4p4/4pp3/4K3C w - - 0 1'
                              );
                              setPgnDirty(false);
                              setFenError(null);
                            }}
                            className="hover:underline cursor-pointer text-[var(--xq-accent-gold)] font-medium"
                          >
                            《七星聚会》
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFenInput(currentFen);
                              setPgnDirty(false);
                              setFenError(null);
                            }}
                            className="hover:underline cursor-pointer"
                          >
                            填入当前盘面
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <input
                          type="text"
                          value={fenInput}
                          onChange={(e) => {
                            setFenInput(e.target.value);
                            setPgnDirty(false);
                            setFenError(null);
                          }}
                          placeholder="粘贴 FEN 编码串（例如 rnbakabnr/9/... w - - 0 1）"
                          className="flex-1 min-w-[14rem] px-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs"
                        />
                        {(fenInput || pgnInput) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFenInput('');
                              setPgnInput('');
                              setPgnDirty(false);
                              setFenError(null);
                            }}
                            className="px-2.5 py-1.5 rounded-md xq-btn-secondary cursor-pointer whitespace-nowrap"
                          >
                            清空
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PGN 完整棋谱区 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-semibold xq-text-secondary">
                          2. 或粘贴完整 PGN 文本（支持中文纵线着法与 [FEN] 残局头）
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPgnInput(currentPgn);
                            setPgnDirty(true);
                            setFenError(null);
                          }}
                          className="text-xs xq-text-muted hover:text-[var(--xq-accent-gold)] cursor-pointer"
                        >
                          载入当前文本模板
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        value={pgnInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPgnInput(val);
                          setPgnDirty(true);
                          setFenError(null);
                          const fenMatch = val.match(/\[FEN\s+"([^"]+)"\]/i);
                          if (fenMatch?.[1]) {
                            setFenInput(fenMatch[1]);
                          }
                        }}
                        placeholder="粘贴完整 PGN 文本（含中文纵线着法如 1. 炮二平五 马8进7 2. 马二进三 车9平8）"
                        className="w-full p-2.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs leading-relaxed"
                      />
                      {parsedPgnPreview && parsedPgnPreview.moves.length > 0 && (
                        <div className="text-xs text-[var(--xq-accent-jade)] font-mono-tabular">
                          已识别 PGN 棋谱：共 {parsedPgnPreview.moves.length} 手合法着法，将完整还原并导入至「复盘分析」
                        </div>
                      )}
                    </div>

                    {fenError && (
                      <div className="p-2 rounded-md xq-btn-danger text-xs">
                        {fenError}
                      </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t xq-border">
                      <button
                        type="button"
                        onClick={() => setFenPgnTab('export')}
                        className="text-[0.8125rem] xq-text-secondary hover:text-[var(--xq-accent-gold)] cursor-pointer"
                      >
                        需要保存或分享？前往「导出当前对局」→
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-3.5 py-1.5 rounded-md xq-btn-secondary cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (pgnDirty && pgnInput.trim() && onApplyPgnSession) {
                              const ok = onApplyPgnSession(pgnInput, fenInput);
                              if (!ok) {
                                setFenError('PGN 或 FEN 格式不合法：请检查盘面编码与着法记谱');
                              } else {
                                onClose();
                              }
                              return;
                            }
                            if (!fenInput.trim()) {
                              setFenError('请先粘贴有效的 FEN 局面或 PGN 棋谱文本');
                              return;
                            }
                            const ok = onApplyFen(fenInput);
                            if (!ok) {
                              setFenError('FEN 格式不合法：必须包含 10 行有效九路盘面编码');
                            } else {
                              onClose();
                            }
                          }}
                          className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
                        >
                          导入至复盘分析
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
              /* 图片识别局面（极简一键识图：拖入/粘贴/选图 + 红黑先行 + 载入） */
              <div
                className="space-y-3.5 text-[0.8125rem]"
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (items && items.length > 0) {
                    setUploadedFileName('剪贴板截图.png');
                  }
                }}
              >
                {/* 极简核心上传/粘贴区 */}
                <label className="p-6 rounded-xl border-2 border-dashed xq-border bg-[var(--xq-bg-canvas)] hover:border-[var(--xq-accent-gold)]/60 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer">
                  <ArrowDownToLine className="w-6 h-6 text-[var(--xq-accent-gold)]" />
                  <div className="font-semibold text-sm">
                    {uploadedFileName
                      ? `已识别图片：${uploadedFileName}`
                      : '点击选择棋盘截图，或直接按 Ctrl+V 粘贴图片'}
                  </div>
                  <div className="text-xs xq-text-muted">
                    自动识别棋盘网格与红黑棋子位置，支持各类象棋软件截图与棋书照片
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedFileName(file.name);
                      }
                    }}
                  />
                </label>

                {/* 底栏：左侧先行方与示例快速切换，右侧操作按钮 */}
                <div className="flex items-center justify-between flex-wrap pt-2 border-t xq-border gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setImgTurn('red')}
                        className={`px-3 py-1 rounded-md cursor-pointer ${
                          imgTurn === 'red' ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        红先
                      </button>
                      <button
                        type="button"
                        onClick={() => setImgTurn('black')}
                        className={`px-3 py-1 rounded-md cursor-pointer ${
                          imgTurn === 'black' ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        黑先
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx =
                          (SAMPLE_IMAGE_RECOGNITIONS.findIndex(
                            (s) => s.id === selectedSampleImgId
                          ) +
                            1) %
                          SAMPLE_IMAGE_RECOGNITIONS.length;
                        const sample = SAMPLE_IMAGE_RECOGNITIONS[nextIdx];
                        setSelectedSampleImgId(sample.id);
                        setUploadedFileName(`${sample.title}.png`);
                      }}
                      className="text-xs text-[var(--xq-accent-gold)] font-medium hover:underline cursor-pointer whitespace-nowrap"
                    >
                      试用示例截图
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-md xq-btn-secondary cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const baseFen = activeSampleRecognition.fen.split(' ')[0];
                        const finalFen = `${baseFen} ${imgTurn === 'red' ? 'w' : 'b'} - - 0 1`;
                        onApplyFen(finalFen);
                        onClose();
                      }}
                      className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
                    >
                      识别并导入至复盘分析
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
            )}
          </div>
        )}

        {/* ==================== 4. 极简外部平台连线面板 (复用复盘分析) ==================== */}
        {activeModal === 'connect' && (
          <div className="p-5 space-y-4 text-[0.8125rem]">
            <div className="flex items-center justify-between border-b xq-border pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                <div>
                  <h3 className="text-base font-semibold">连线外部棋盘同步分析</h3>
                  <p className="text-xs xq-text-muted">
                    连接成功后直接复用「复盘分析」工作台，实时同步外部棋盘并计算主变
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-semibold xq-text-secondary">选择要同步的外部象棋窗口：</span>
              <div className="space-y-2">
                {platformOptions.map((p) => {
                  const isSel = connectPlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setConnectPlatform(p.id)}
                      className={`w-full p-3 rounded-lg text-left flex items-center justify-between cursor-pointer ${
                        isSel ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm">{p.label}</div>
                        <div className="text-xs xq-text-muted mt-0.5 font-normal">{p.desc}</div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSel ? 'border-[var(--xq-accent-gold)]' : 'xq-border'
                        }`}
                      >
                        {isSel && (
                          <span className="w-2 h-2 rounded-full bg-[var(--xq-accent-gold)]" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-semibold text-sm">同步落子时自动启动引擎分析</div>
                <div className="text-xs xq-text-muted">
                  外部棋盘每走一手，自动更新盘面主变箭头与局势评分
                </div>
              </div>
              <input
                type="checkbox"
                checked={connectAutoAnalyze}
                onChange={(e) => setConnectAutoAnalyze(e.target.checked)}
                className="w-4 h-4 accent-[var(--xq-accent-primary)]"
              />
            </label>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t xq-border">
              {connectState.connected ? (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConnectState({
                      ...connectState,
                      connected: false,
                    });
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-md xq-btn-danger cursor-pointer"
                >
                  断开当前连线
                </button>
              ) : (
                <span className="text-xs xq-text-muted">当前状态：未连接外部窗口</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-md xq-btn-secondary cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const chosen =
                      platformOptions.find((item) => item.id === connectPlatform) ||
                      platformOptions[0];
                    onUpdateConnectState({
                      connected: true,
                      platform: chosen.id,
                      platformLabel: chosen.label,
                      autoAnalyze: connectAutoAnalyze,
                    });
                    onSwitchWorkspace('study');
                    onClose();
                  }}
                  className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
                >
                  一键连接并进入复盘分析
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. 编辑对局信息 ==================== */}
        {activeModal === 'game-info' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b xq-border pb-3">
              <h3 className="text-base font-semibold">编辑对局信息</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.8125rem]">
              <div>
                <label className="block xq-text-secondary mb-1 font-medium">红方棋手</label>
                <input
                  type="text"
                  value={metaDraft.redPlayer}
                  onChange={(e) => setMetaDraft({ ...metaDraft, redPlayer: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
                />
              </div>
              <div>
                <label className="block xq-text-secondary mb-1 font-medium">黑方棋手</label>
                <input
                  type="text"
                  value={metaDraft.blackPlayer}
                  onChange={(e) => setMetaDraft({ ...metaDraft, blackPlayer: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
                />
              </div>
              <div>
                <label className="block xq-text-secondary mb-1 font-medium">赛事名称</label>
                <input
                  type="text"
                  value={metaDraft.event}
                  onChange={(e) => setMetaDraft({ ...metaDraft, event: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
                />
              </div>
              <div>
                <label className="block xq-text-secondary mb-1 font-medium">开局体系</label>
                <input
                  type="text"
                  value={metaDraft.opening}
                  onChange={(e) => setMetaDraft({ ...metaDraft, opening: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t xq-border text-[0.8125rem]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md xq-btn-secondary cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveMetadata(metaDraft);
                  onClose();
                }}
                className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        )}

        {/* ==================== 6. 单页一屏设置（引擎安装管理 + 外观 + 引擎算力 + 底栏关于） ==================== */}
        {activeModal === 'settings' && (
          <div className="p-5 space-y-3 text-[0.8125rem]">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b xq-border pb-2.5">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base font-semibold">设置中心</h3>
                <span className="text-xs xq-text-muted">修改后实时生效，点击空白处即可关闭</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 顶部专享：多引擎库管理 (UCI / UCCI) 与双擎对比分配 */}
            <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-[0.8125rem] xq-text-primary">
                    多引擎库管理（支持 UCI / UCCI 协议与双擎并行对比）
                  </span>
                  <button
                    type="button"
                    onClick={onToggleCompareMode}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      compareMode ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    {compareMode ? '✓ 双擎对比已开启' : '开启双擎对比'}
                  </button>
                </div>

                <label className="px-2.5 py-1 rounded text-xs xq-btn-secondary flex items-center gap-1 cursor-pointer whitespace-nowrap">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>+ 添加本地引擎</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isUcci = file.name.toLowerCase().includes('ucci') || file.name.toLowerCase().includes('xqms');
                        onAddCustomEngine(file.name, isUcci ? 'UCCI' : 'UCI');
                      }
                    }}
                  />
                </label>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {engines.map((eng) => {
                  const isPrimary = eng.id === primaryEngineId;
                  const isSecondary = eng.id === secondaryEngineId;
                  return (
                    <div
                      key={eng.id}
                      className="px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-surface)] flex items-center justify-between flex-wrap gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {eng.status === 'ready' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--xq-accent-jade)] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                        )}
                        <span className="font-semibold truncate">{eng.name}</span>
                        <span className="px-1.5 py-0.2 rounded text-xs font-mono-tabular border xq-border xq-text-secondary shrink-0">
                          {eng.protocol} · {eng.styleLabel}
                        </span>
                        {isPrimary && (
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-[var(--xq-accent-jade)] text-[#F4EFE2] shrink-0">
                            主擎
                          </span>
                        )}
                        {isSecondary && (
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-[var(--xq-accent-azure)] text-[#F4EFE2] shrink-0">
                            副擎
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {eng.status === 'ready' ? (
                          <>
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => onChangePrimaryEngine(eng.id)}
                                className="px-2 py-0.5 rounded text-xs xq-btn-secondary cursor-pointer"
                              >
                                设为主擎
                              </button>
                            )}
                            {!isSecondary && !isPrimary && (
                              <button
                                type="button"
                                onClick={() => onChangeSecondaryEngine(eng.id)}
                                className="px-2 py-0.5 rounded text-xs xq-btn-secondary cursor-pointer"
                              >
                                设为副擎
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onResetEngineMissing(eng.id)}
                              className="px-2 py-0.5 rounded text-xs xq-btn-ghost cursor-pointer"
                            >
                              卸载
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={eng.status === 'installing'}
                            onClick={() => onInstallEngine(eng.id)}
                            className="px-2.5 py-0.5 rounded text-xs xq-btn-primary flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>
                              {eng.status === 'installing'
                                ? `安装中 ${eng.installProgress}%`
                                : `一键下载 (${eng.sizeMb}MB)`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 第一部分：外观与棋具 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs xq-text-secondary">
                    界面主题（与顶栏按钮同步）
                  </span>
                  <span className="text-xs xq-text-muted">低蓝光防眩校准</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'dark', label: '深色夜案' },
                      { id: 'light', label: '清朗浅色' },
                      { id: 'eyecare', label: '温润护眼' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeAppTheme(item.id)}
                      className={`py-1.5 rounded-md text-xs cursor-pointer whitespace-nowrap ${
                        appTheme === item.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">棋子字形</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeUseTraditionalChar(false)}
                    className={`py-1.5 rounded-md text-xs cursor-pointer ${
                      !useTraditionalChar ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    标准简体 (车马炮)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeUseTraditionalChar(true)}
                    className={`py-1.5 rounded-md text-xs cursor-pointer ${
                      useTraditionalChar ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    传统繁体 (俥傌炮)
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">棋盘材质样式</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'xuan-rosewood', label: '宣纸紫檀' },
                      { id: 'imperial-lacquer', label: '深色黑金' },
                      { id: 'song-celadon', label: '宋韵青瓷' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeBoardTheme(item.id)}
                      className={`py-1.5 rounded-md text-xs cursor-pointer ${
                        boardTheme === item.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">棋子工艺样式</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'boxwood-ebony', label: '黄杨乌木' },
                      { id: 'ebony-gilt', label: '乌木描金' },
                      { id: 'mutton-jade', label: '温润白玉' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeCraftStyle(item.id)}
                      className={`py-1.5 rounded-md text-xs cursor-pointer ${
                        craftStyle === item.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 第二部分：引擎核心算力配置（MultiPV + 深度 + CPU 线程 + Hash 内存） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">候选变例 (MultiPV) 与计算深度</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    {([1, 2, 3] as const).map((cnt) => (
                      <button
                        key={`mpv-${cnt}`}
                        type="button"
                        onClick={() => onChangeMultiPvCount(cnt)}
                        className={`py-1 rounded-md text-xs font-mono-tabular cursor-pointer ${
                          multiPvCount === cnt ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        {cnt}变
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {([18, 24, 30] as const).map((d) => (
                      <button
                        key={`depth-${d}`}
                        type="button"
                        onClick={() => onChangeEngineDepth(d)}
                        className={`py-1 rounded-md text-xs font-mono-tabular cursor-pointer ${
                          engineDepth === d ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        {d}层
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">引擎算力分配（CPU 线程 / Hash 内存）</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    {([4, 8, 16] as const).map((th) => (
                      <button
                        key={`th-${th}`}
                        type="button"
                        onClick={() => onChangeEngineThreads(th)}
                        className={`py-1 rounded-md text-xs font-mono-tabular cursor-pointer ${
                          engineThreads === th ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        {th}核
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {([256, 512, 1024] as const).map((hm) => (
                      <button
                        key={`hm-${hm}`}
                        type="button"
                        onClick={() => onChangeEngineHashMb(hm)}
                        className={`py-1 rounded-md text-xs font-mono-tabular cursor-pointer ${
                          engineHashMb === hm ? 'xq-btn-option-active' : 'xq-btn-option'
                        }`}
                      >
                        {hm === 1024 ? '1G' : `${hm}M`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 第三部分：字号、路数坐标与音效 */}
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-xs xq-text-secondary">界面字号</span>
                <div className="flex items-center flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'standard', label: '标准 100%' },
                      { id: 'large', label: '大 112%' },
                      { id: 'xlarge', label: '特大 125%' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeFontScale(s.id)}
                      className={`px-2.5 py-1 rounded-md text-xs cursor-pointer whitespace-nowrap ${
                        fontScale === s.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-xs xq-text-secondary">
                    棋盘路数坐标 (九~一 / 1~9)
                  </span>
                  <input
                    type="checkbox"
                    checked={showBoardCoordinates}
                    onChange={(e) => onChangeShowBoardCoordinates(e.target.checked)}
                    className="w-4 h-4 accent-[var(--xq-accent-primary)]"
                  />
                </label>

                <label className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-xs xq-text-secondary">落子木纹音效</span>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => onChangeSoundEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[var(--xq-accent-primary)]"
                  />
                </label>
              </div>
            </div>

            {/* 底部内嵌关于栏 + 完成按钮 */}
            <div className="pt-2.5 border-t xq-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center flex-wrap gap-2 text-xs xq-text-muted">
                <Info className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                <span>关于：象棋X Desktop v2.4.0 · Pikafish NNUE 内核</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setUpdateCheckStatus('checking');
                    scheduleFeedbackReset(() => setUpdateCheckStatus('latest'), 500);
                  }}
                  className="text-[var(--xq-accent-gold)] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {updateCheckStatus === 'checking' && (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  )}
                  <span>
                    {updateCheckStatus === 'latest'
                      ? '✓ 已是最新版本'
                      : updateCheckStatus === 'checking'
                      ? '正在检查…'
                      : '检查更新'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-md xq-btn-primary text-[0.8125rem] cursor-pointer shrink-0"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
