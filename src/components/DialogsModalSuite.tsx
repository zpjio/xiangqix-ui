import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
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
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ActiveModalId,
  AppTheme,
  BoardTheme,
  Camp,
  EngineProfile,
  EngineProtocol,
  ExternalConnectState,
  ExternalPlatformId,
  FontScale,
  GameMetadata,
  LibraryGameItem,
  PieceCraftStyle,
  WorkspaceMode,
} from '../types/xiangqi';
import { INITIAL_FEN } from '../utils/xiangqiRules';

interface DialogsModalSuiteProps {
  activeModal: ActiveModalId;
  appTheme: AppTheme;
  fontScale: FontScale;
  soundEnabled: boolean;
  boardTheme: BoardTheme;
  craftStyle: PieceCraftStyle;
  useTraditionalChar: boolean;
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
  metadata: GameMetadata;
  libraryGames: LibraryGameItem[];
  onClose: () => void;
  onSwitchWorkspace: (ws: WorkspaceMode) => void;
  onApplyFen: (fen: string) => boolean;
  onSaveMetadata: (meta: GameMetadata) => void;
  onLoadLibraryGame: (game: LibraryGameItem) => void;
  onToggleLibraryFavorite: (id: string) => void;
  onDeleteLibraryGame: (id: string) => void;
  onChangeAppTheme: (theme: AppTheme) => void;
  onChangeFontScale: (scale: FontScale) => void;
  onChangeSoundEnabled: (enabled: boolean) => void;
  onChangeBoardTheme: (theme: BoardTheme) => void;
  onChangeCraftStyle: (style: PieceCraftStyle) => void;
  onChangeUseTraditionalChar: (useTrad: boolean) => void;
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

export const DialogsModalSuite: React.FC<DialogsModalSuiteProps> = ({
  activeModal,
  appTheme,
  fontScale,
  soundEnabled,
  boardTheme,
  craftStyle,
  useTraditionalChar,
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
  metadata,
  libraryGames,
  onClose,
  onSwitchWorkspace,
  onApplyFen,
  onSaveMetadata,
  onLoadLibraryGame,
  onToggleLibraryFavorite,
  onDeleteLibraryGame,
  onChangeAppTheme,
  onChangeFontScale,
  onChangeSoundEnabled,
  onChangeBoardTheme,
  onChangeCraftStyle,
  onChangeUseTraditionalChar,
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
  const [importMode, setImportMode] = useState<'fen-pgn' | 'image'>('fen-pgn');
  const [fenInput, setFenInput] = useState(currentFen);
  const [pgnInput, setPgnInput] = useState(currentPgn);
  const [fenError, setFenError] = useState<string | null>(null);
  const [copiedFen, setCopiedFen] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);

  // 图片识别状态
  const [imgTurn, setImgTurn] = useState<Camp>('red');
  const [selectedSampleImgId, setSelectedSampleImgId] = useState<string>(
    SAMPLE_IMAGE_RECOGNITIONS[0].id
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // 棋谱库与元数据编辑状态
  const [metaDraft, setMetaDraft] = useState<GameMetadata>(metadata);
  const [libCategory, setLibCategory] = useState<'all' | 'favorite' | 'master' | 'ancient'>('all');
  const [libSearch, setLibSearch] = useState('');

  // 连线配置草稿
  const [connectPlatform, setConnectPlatform] = useState<ExternalPlatformId>(
    connectState.platform
  );
  const [connectAutoAnalyze, setConnectAutoAnalyze] = useState<boolean>(
    connectState.autoAnalyze
  );

  // 关于检查更新状态
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'latest'>('idle');

  useEffect(() => {
    setFenInput(currentFen);
    setPgnInput(currentPgn);
    setMetaDraft(metadata);
  }, [currentFen, currentPgn, metadata, activeModal]);

  if (!activeModal) return null;

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
      id: 'cmd-challenge',
      label: '进入「残局题库」（七星聚会 / 野马操田）',
      shortcut: '2',
      action: () => {
        onSwitchWorkspace('challenge');
        onClose();
      },
    },
    {
      id: 'cmd-play',
      label: '开启「人机对弈」（支持分先/让左马/让双马）',
      shortcut: '3',
      action: () => {
        onSwitchWorkspace('play');
        onClose();
      },
    },
    {
      id: 'cmd-setup',
      label: '打开「摆子编辑」自由摆设局面',
      shortcut: '4',
      action: () => {
        onSwitchWorkspace('setup');
        onClose();
      },
    },
    {
      id: 'cmd-image-board',
      label: '从图片识别导入局面（截图识谱）',
      shortcut: 'I',
      action: () => {
        setImportMode('image');
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
      label: '切换深浅外观主题',
      shortcut: 'T',
      action: () => {
        onChangeAppTheme(appTheme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((c) =>
    c.label.toLowerCase().includes(cmdQuery.trim().toLowerCase())
  );

  const filteredLibrary = libraryGames.filter((g) => {
    if (libCategory === 'favorite' && !g.isFavorite) return false;
    if (libCategory === 'master' && g.category !== 'master') return false;
    if (libCategory === 'ancient' && g.category !== 'ancient') return false;
    if (libSearch.trim()) {
      const q = libSearch.trim().toLowerCase();
      return (
        g.redPlayer.toLowerCase().includes(q) ||
        g.blackPlayer.toLowerCase().includes(q) ||
        g.event.toLowerCase().includes(q) ||
        g.opening.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
          activeModal === 'settings' ? 'rgba(0, 0, 0, 0.14)' : 'var(--xq-bg-backdrop)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border xq-elevated shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
                  className="w-full bg-transparent text-xs focus:outline-none"
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
                  className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    idx === 0
                      ? 'bg-[var(--xq-bg-active)] font-medium'
                      : 'hover:bg-[var(--xq-bg-hover)]'
                  }`}
                >
                  <span>{cmd.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--xq-bg-canvas)] border xq-border font-mono-tabular text-[10px] xq-text-muted">
                    {cmd.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 2. 棋谱库（含我的收藏闭环） ==================== */}
        {activeModal === 'library' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b xq-border pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-semibold">棋谱库</h3>
                <div className="flex items-center gap-1.5 text-xs">
                  {(
                    [
                      { id: 'all', label: '全部棋谱' },
                      {
                        id: 'favorite',
                        label: `★ 我的收藏 (${libraryGames.filter((g) => g.isFavorite).length})`,
                      },
                      { id: 'master', label: '现代名局' },
                      { id: 'ancient', label: '古谱名局' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLibCategory(tab.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap ${
                        libCategory === tab.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
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

            <div className="relative text-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 xq-text-muted" />
              <input
                type="text"
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
                placeholder="搜索棋手、赛事、开局体系…"
                className="w-full pl-8 pr-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)]"
              />
            </div>

            <div className="space-y-2 max-h-68 overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <div className="py-8 text-center text-xs xq-text-muted">
                  暂无匹配棋谱（可在右侧棋谱栏点击「★ 收藏」将当前对局加入收藏夹）
                </div>
              ) : (
                filteredLibrary.map((game) => (
                  <div
                    key={game.id}
                    className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] hover:bg-[var(--xq-bg-hover)] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#C8372D]">{game.redPlayer}</span>
                        <span className="xq-text-muted">vs</span>
                        <span className="font-semibold">{game.blackPlayer}</span>
                        <span className="xq-text-muted">·</span>
                        <span className="text-xs xq-text-secondary">{game.result}</span>
                        <span className="xq-text-muted">·</span>
                        <span className="font-mono-tabular text-xs text-[#10B981]">
                          精准度 {game.accuracyRed}% / {game.accuracyBlack}%
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
                      <button
                        type="button"
                        onClick={() => {
                          onLoadLibraryGame(game);
                          onClose();
                        }}
                        className="px-3 py-1 rounded-md xq-btn-primary text-xs cursor-pointer"
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

        {/* ==================== 3. 导入 / 棋谱（FEN + PGN + 图片识别二合一弹窗） ==================== */}
        {activeModal === 'fen-pgn' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b xq-border pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-semibold">导入与导出</h3>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('fen-pgn')}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${
                      importMode === 'fen-pgn' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>FEN / PGN 棋谱</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('image')}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${
                      importMode === 'image' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>图片识别局面</span>
                  </button>
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

            {importMode === 'fen-pgn' ? (
              <div className="space-y-3.5 text-xs">
                {/* FEN 区 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold xq-text-secondary">1. FEN 局面编码</span>
                    <div className="flex items-center gap-2 text-xs xq-text-secondary">
                      <button
                        type="button"
                        onClick={() => {
                          setFenInput(INITIAL_FEN);
                          setFenError(null);
                        }}
                        className="hover:underline cursor-pointer"
                      >
                        标准开局 FEN
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFenInput(
                            '5k3/4a4/4b4/7R1/3r4R/1p7/9/4p4/4pp3/4K3C w - - 0 1'
                          );
                          setFenError(null);
                        }}
                        className="hover:underline cursor-pointer text-[var(--xq-accent-gold)] font-medium"
                      >
                        《七星聚会》FEN
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fenInput}
                      onChange={(e) => {
                        setFenInput(e.target.value);
                        setFenError(null);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(fenInput).catch(() => {});
                        setCopiedFen(true);
                        setTimeout(() => setCopiedFen(false), 1600);
                      }}
                      className="px-3 py-1.5 rounded-md xq-btn-secondary flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      {copiedFen ? (
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedFen ? '已复制' : '复制 FEN'}</span>
                    </button>
                  </div>
                </div>

                {/* PGN 完整棋谱区 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold xq-text-secondary">
                      2. PGN 完整棋谱文本（支持复制导出或粘贴含 [FEN] 棋谱）
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(pgnInput).catch(() => {});
                        setCopiedPgn(true);
                        setTimeout(() => setCopiedPgn(false), 1600);
                      }}
                      className="text-xs text-[var(--xq-accent-gold)] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPgn ? (
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedPgn ? '已复制完整 PGN' : '复制 PGN 棋谱'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={pgnInput}
                    onChange={(e) => {
                      setPgnInput(e.target.value);
                      const fenMatch = e.target.value.match(/\[FEN\s+"([^"]+)"\]/i);
                      if (fenMatch?.[1]) {
                        setFenInput(fenMatch[1]);
                      }
                    }}
                    className="w-full p-2.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] font-mono-tabular text-xs leading-relaxed"
                  />
                </div>

                {fenError && (
                  <div className="p-2 rounded-md xq-btn-danger text-xs">
                    {fenError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t xq-border">
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
                      const ok = onApplyFen(fenInput);
                      if (!ok) {
                        setFenError('FEN 格式不合法：必须包含 10 行有效九路盘面编码');
                      } else {
                        onClose();
                      }
                    }}
                    className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
                  >
                    载入到棋盘
                  </button>
                </div>
              </div>
            ) : (
              /* 图片识别局面（极简一键识图：拖入/粘贴/选图 + 红黑先行 + 载入） */
              <div
                className="space-y-3.5 text-xs"
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (items && items.length > 0) {
                    setUploadedFileName('剪贴板截图.png');
                  }
                }}
              >
                {/* 极简核心上传/粘贴区 */}
                <label className="p-6 rounded-xl border-2 border-dashed xq-border bg-[var(--xq-bg-canvas)] hover:border-[var(--xq-accent-gold)]/60 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer">
                  <Upload className="w-6 h-6 text-[var(--xq-accent-gold)]" />
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
                <div className="flex items-center justify-between pt-2 border-t xq-border gap-3">
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
                        onSwitchWorkspace('study');
                        onClose();
                      }}
                      className="px-4 py-1.5 rounded-md xq-btn-primary cursor-pointer"
                    >
                      识别并载入棋盘
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 4. 极简外部平台连线面板 (复用复盘分析) ==================== */}
        {activeModal === 'connect' && (
          <div className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b xq-border pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                <div>
                  <h3 className="text-[15px] font-semibold">连线外部棋盘同步分析</h3>
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
                        <div className="font-semibold text-[13px]">{p.label}</div>
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
                <div className="font-semibold text-[13px]">同步落子时自动启动引擎分析</div>
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

            <div className="flex items-center justify-between pt-2 border-t xq-border">
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
              <h3 className="text-[15px] font-semibold">编辑对局信息</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-[var(--xq-bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
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

            <div className="flex justify-end gap-2 pt-3 border-t xq-border text-xs">
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
          <div className="p-5 space-y-3 text-[13px]">
            <div className="flex items-center justify-between border-b xq-border pb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold">设置中心</h3>
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs xq-text-primary">
                    多引擎库管理（支持 UCI / UCCI 协议与双擎并行对比）
                  </span>
                  <button
                    type="button"
                    onClick={onToggleCompareMode}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
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
                      className="px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-surface)] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {eng.status === 'ready' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                        )}
                        <span className="font-semibold truncate">{eng.name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono-tabular border xq-border xq-text-secondary shrink-0">
                          {eng.protocol} · {eng.styleLabel}
                        </span>
                        {isPrimary && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#10B981] text-white shrink-0">
                            主擎
                          </span>
                        )}
                        {isSecondary && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#3B82F6] text-white shrink-0">
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
                                className="px-2 py-0.5 rounded text-[11px] xq-btn-secondary cursor-pointer"
                              >
                                设为主擎
                              </button>
                            )}
                            {!isSecondary && !isPrimary && (
                              <button
                                type="button"
                                onClick={() => onChangeSecondaryEngine(eng.id)}
                                className="px-2 py-0.5 rounded text-[11px] xq-btn-secondary cursor-pointer"
                              >
                                设为副擎
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onResetEngineMissing(eng.id)}
                              className="px-2 py-0.5 rounded text-[11px] xq-btn-ghost cursor-pointer"
                            >
                              卸载
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={eng.status === 'installing'}
                            onClick={() => onInstallEngine(eng.id)}
                            className="px-2.5 py-0.5 rounded text-[11px] xq-btn-primary flex items-center gap-1 cursor-pointer"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="font-semibold text-xs xq-text-secondary">界面主题（与顶栏按钮同步）</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeAppTheme('dark')}
                    className={`py-1.5 rounded-md text-xs cursor-pointer ${
                      appTheme === 'dark' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    深色模式
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAppTheme('light')}
                    className={`py-1.5 rounded-md text-xs cursor-pointer ${
                      appTheme === 'light' ? 'xq-btn-option-active' : 'xq-btn-option'
                    }`}
                  >
                    浅色模式
                  </button>
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
            <div className="grid grid-cols-2 gap-3">
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

            {/* 第三部分：字号与音效同行紧凑排列 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between">
                <span className="font-semibold text-xs xq-text-secondary">界面字号</span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'standard', label: '标准' },
                      { id: 'large', label: '大' },
                      { id: 'xlarge', label: '特大' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeFontScale(s.id)}
                      className={`px-2.5 py-1 rounded-md text-xs cursor-pointer ${
                        fontScale === s.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

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

            {/* 底部内嵌关于栏 + 完成按钮 */}
            <div className="pt-2.5 border-t xq-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs xq-text-muted">
                <Info className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                <span>关于：象棋X Desktop v2.4.0 · Pikafish NNUE 内核</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setUpdateCheckStatus('checking');
                    setTimeout(() => setUpdateCheckStatus('latest'), 500);
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
                className="px-4 py-1.5 rounded-md xq-btn-primary text-xs cursor-pointer shrink-0"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
