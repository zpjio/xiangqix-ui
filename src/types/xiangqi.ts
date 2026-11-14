export type Camp = 'red' | 'black';

export type PieceType =
  | 'general'   // 帅 / 将
  | 'advisor'   // 仕 / 士
  | 'elephant'  // 相 / 象
  | 'horse'     // 傌 / 馬
  | 'chariot'   // 俥 / 車
  | 'cannon'    // 炮 / 砲
  | 'soldier';  // 兵 / 卒

export interface Piece {
  id: string;
  type: PieceType;
  camp: Camp;
  row: number; // 0..9 (0 top/Black, 9 bottom/Red)
  col: number; // 0..8
}

export interface Position {
  row: number;
  col: number;
}

export type MoveQuality = '妙' | '优' | '良' | '缓' | '败';

export type MoveNag = '!!' | '!' | '!?' | '?!' | '?' | '??';

export interface MoveRecord {
  ply: number;
  piece: Piece;
  from: Position;
  to: Position;
  captured?: Piece;
  notation: string; // 如 "炮二平五"
  evalScore: number; // 红方视角分值，如 +0.45
  mateIn?: number; // 如 +3 表示红杀3
  quality?: MoveQuality;
  nag?: MoveNag; // 棋评符号 (!!, !, !?, ?!, ?, ??)
  bestAlternative?: string; // 若为缓/败着，记录引擎推荐正着
  bestFrom?: Position;
  bestTo?: Position;
  comment?: string;
  piecesSnapshot: Piece[];
}

export type BoardTheme = 'xuan-rosewood' | 'imperial-lacquer' | 'song-celadon';
export type PieceCraftStyle = 'boxwood-ebony' | 'ebony-gilt' | 'mutton-jade';
export type FontScheme = 'kaiti-serif' | 'calligraphy-brush' | 'seal-script';
export type AppTheme = 'dark' | 'light' | 'eyecare';
export type FontScale = 'standard' | 'large' | 'xlarge';

export interface ImpactEffect {
  id: number;
  row: number;
  col: number;
  camp: Camp;
  isCapture: boolean;
}

export interface MultiPVArrow {
  rank: number; // 1 = 主变, 2..3 = 次变
  from: Position;
  to: Position;
  scoreText: string;
  notation: string;
  isThreat?: boolean; // 对手威胁雷达虚线箭头
  isGhostPreview?: boolean; // 鼠标悬停幽灵预览箭头
  isSecondaryEngine?: boolean; // 双擎对比模式下副引擎天青蓝箭头
  isConsensus?: boolean; // 双擎首推一致时的共识合并箭头
}

export interface MultiPVLine {
  multipv: number;
  depth: number;
  scoreCp: number;
  mate?: number;
  nps: number; // kN/s
  hashfull: number; // ‰
  pvMoves: string[];
  firstMove: {
    from: Position;
    to: Position;
    notation: string;
  };
  summaryText: string;
}

// 五大纯粹工作空间 (Top Bar 导航：复盘分析 → 开局研习 → 残局题库 → 人机对弈 → 摆子编辑)
export type WorkspaceMode =
  | 'study'      // 复盘分析（双栏棋谱 + 无感内联分支 + 整局复盘报告 + 定式查询）
  | 'opening'    // 开局研习（定式树探索 + 7套经典骨架 + 变例防剧透对练）
  | 'challenge'  // 残局题库（传世残局杀局挑战 + 锦囊提示）
  | 'play'       // 人机对弈（支持传统让子：平先 / 让先 / 让左马 / 让双马）
  | 'setup';     // 摆子编辑（自由摆子与 FEN 工坊）

export type HandicapType = 'even' | 'move-first' | 'left-horse' | 'two-horses';
export type EngineSkillTier = 'scholar' | 'strategist' | 'grandmaster' | 'deity';
export type EngineInstallStatus = 'missing' | 'installing' | 'ready';
export type EngineProtocol = 'UCI' | 'UCCI';
export type EngineStyleBias = 'balanced' | 'aggressive' | 'positional';

export interface EngineProfile {
  id: string;
  name: string;
  shortName: string;
  version: string;
  protocol: EngineProtocol;
  styleBias: EngineStyleBias;
  styleLabel: string;
  nnueFile: string;
  sizeMb: number;
  status: EngineInstallStatus;
  installProgress: number;
}

export type ActiveModalId =
  | null
  | 'command-palette'
  | 'library'
  | 'fen-pgn'
  | 'connect'
  | 'game-info'
  | 'settings';

export type ExternalPlatformId = 'tiantian' | 'jj' | 'emulator';

export interface ExternalConnectState {
  connected: boolean;
  platform: ExternalPlatformId;
  platformLabel: string;
  autoAnalyze: boolean;
}

export interface GameMetadata {
  redPlayer: string;
  blackPlayer: string;
  event: string;
  date: string;
  result: '红胜' | '黑胜' | '和棋' | '进行中';
  site: string;
  opening: string;
  isFavorite: boolean;
}

export interface ClassicalChallengeItem {
  id: string;
  title: string;
  sourceBook: string;
  bookSeries: string;
  difficulty: '★★☆ · 进阶' | '★★★ · 高难' | '★★★★ · 绝杀';
  expectedPlies: number;
  objective: string;
  lore: string;
  initialTurn: Camp;
  pieces: () => Piece[];
  hintMove: {
    from: Position;
    to: Position;
    notation: string;
    explanation: string;
  };
}

export interface CompactLibraryMove {
  from: Position;
  to: Position;
  evalScore?: number;
  quality?: MoveQuality;
  nag?: MoveNag;
  comment?: string;
}

export interface LibraryGameItem {
  id: string;
  redPlayer: string;
  blackPlayer: string;
  event: string;
  date: string;
  result: '红胜' | '黑胜' | '和棋' | '进行中';
  opening: string;
  pliesCount: number;
  accuracyRed: number;
  accuracyBlack: number;
  isFavorite: boolean;
  category: 'master' | 'ancient' | 'user' | 'recent';
  fen?: string;
  baseFen?: string;
  movesData?: CompactLibraryMove[];
}

export type OpeningBookCategory =
  | '初始布局'
  | '中炮体系'
  | '仙人指路'
  | '飞相局'
  | '起马局';

export interface OpeningMoveStat {
  from: Position;
  to: Position;
  notation: string;
  frequencyPct: number;
  redWinPct: number;
  drawPct: number;
  blackWinPct: number;
  targetOpeningName: string;
  badge?: '主流' | '稳健' | '激烈' | '陷阱' | '古谱';
}

export interface OpeningBookNode {
  positionKey: string;
  openingName: string;
  category: OpeningBookCategory;
  matchKeyword: string;
  plyDepth: number;
  totalGames: number;
  comment: string;
  nextMoves: OpeningMoveStat[];
}

export interface OpeningPresetLine {
  id: string;
  title: string;
  category: OpeningBookCategory;
  matchKeyword: string;
  difficulty: '基础' | '进阶' | '经典';
  summary: string;
  moves: { from: Position; to: Position }[];
}

export type OpeningPanelSubMode = 'explorer' | 'drill';
export type OpeningDrillStatus = 'idle' | 'drilling' | 'mistake' | 'completed';

export interface OpeningDrillProgress {
  bestAccuracyPct: number;
  completedCount: number;
  lastPracticedAt: string;
}

export interface OpeningDrillRuntime {
  presetId: string;
  playerCamp: Camp;
  stepIndex: number;
  attempts: number;
  mistakes: number;
  status: OpeningDrillStatus;
  feedback: string | null;
  expectedMove?: {
    from: Position;
    to: Position;
    notation: string;
  } | null;
}

export interface CheckSealEffect {
  id: number;
  camp: Camp; // 被将军的一方
}

export interface CheckAttackLine {
  from: Position;
  to: Position;
}

export type GameTerminalKind =
  | 'checkmate'
  | 'stalemate'
  | 'draw-60moves'
  | 'draw-repetition'
  | 'draw-agreement'
  | 'draw-insufficient'
  | 'perpetual-check'
  | 'resign'
  | 'timeout';

export interface GameTerminalState {
  kind: GameTerminalKind;
  winner?: Camp;
  loser?: Camp;
  reasonText?: string;
}

export interface DrawRuleStatus {
  halfmoveNoCapture: number;
  noCaptureRounds: number;
  repetitionCount: number;
  canClaim60MoveDraw: boolean;
  canClaimRepetitionDraw: boolean;
  perpetualCheckCamp: Camp | null;
  canClaimInsufficientDraw: boolean;
}

export interface SetupValidationResult {
  isValid: boolean;
  reason: string | null;
  hasBothGenerals: boolean;
  generalsFacing: boolean;
  inactiveCampInCheck: Camp | null;
}

export interface MaterialAdvantagePiece {
  type: PieceType;
  count: number;
}

export type BoardAnnotationColor = 'gold' | 'jade' | 'crimson' | 'azure';

export interface BoardUserArrow {
  id: string;
  from: Position;
  to: Position;
  color: BoardAnnotationColor;
}

export interface BoardUserCircle {
  id: string;
  pos: Position;
  color: BoardAnnotationColor;
}

export type ChessClockPresetId = 'none' | 'blitz-5-3' | 'rapid-10-5' | 'classical-20-10';

export interface ChessClockPreset {
  id: ChessClockPresetId;
  label: string;
  shortLabel: string;
  initialMs: number;
  incrementMs: number;
}
