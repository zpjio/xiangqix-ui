import {
  Camp,
  EngineProfile,
  GameMetadata,
  MoveQuality,
  PieceType,
} from '../types/xiangqi';

export const INITIAL_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export const RED_ROAD_NUMERALS = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
export const BLACK_ROAD_NUMERALS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const PIECE_LABELS: Record<
  Camp,
  Record<PieceType, { traditional: string; simplified: string; roleDesc: string }>
> = {
  red: {
    general: { traditional: '帥', simplified: '帅', roleDesc: '九宫主帅 · 直行一格' },
    advisor: { traditional: '仕', simplified: '仕', roleDesc: '九宫斜行' },
    elephant: { traditional: '相', simplified: '相', roleDesc: '田字飞相 · 不过河' },
    horse: { traditional: '傌', simplified: '马', roleDesc: '日字跳马 · 蹩马腿' },
    chariot: { traditional: '俥', simplified: '车', roleDesc: '纵横直线行走' },
    cannon: { traditional: '炮', simplified: '炮', roleDesc: '隔子打子' },
    soldier: { traditional: '兵', simplified: '兵', roleDesc: '过河可横行' },
  },
  black: {
    general: { traditional: '將', simplified: '将', roleDesc: '九宫主将 · 直行一格' },
    advisor: { traditional: '士', simplified: '士', roleDesc: '九宫斜行' },
    elephant: { traditional: '象', simplified: '象', roleDesc: '田字飞象 · 不过河' },
    horse: { traditional: '馬', simplified: '马', roleDesc: '日字跳马 · 蹩马腿' },
    chariot: { traditional: '車', simplified: '车', roleDesc: '纵横直线行走' },
    cannon: { traditional: '砲', simplified: '炮', roleDesc: '隔子打子' },
    soldier: { traditional: '卒', simplified: '卒', roleDesc: '过河可横行' },
  },
};

export const PIECE_QUOTA_BY_TYPE: Record<PieceType, number> = {
  chariot: 2,
  horse: 2,
  cannon: 2,
  advisor: 2,
  elephant: 2,
  soldier: 5,
  general: 1,
};

export const PIECE_QUOTA_LIST: { type: PieceType; max: number }[] = [
  { type: 'chariot', max: 2 },
  { type: 'horse', max: 2 },
  { type: 'cannon', max: 2 },
  { type: 'advisor', max: 2 },
  { type: 'elephant', max: 2 },
  { type: 'soldier', max: 5 },
  { type: 'general', max: 1 },
];

export const MATERIAL_QUOTA_WEIGHTS: { type: PieceType; count: number; weight: number }[] = [
  { type: 'chariot', count: 2, weight: 9 },
  { type: 'cannon', count: 2, weight: 4.5 },
  { type: 'horse', count: 2, weight: 4 },
  { type: 'advisor', count: 2, weight: 2 },
  { type: 'elephant', count: 2, weight: 2 },
  { type: 'soldier', count: 5, weight: 1 },
];

export const QUALITY_ACCURACY_WEIGHTS: Record<MoveQuality, number> = {
  妙: 99,
  优: 95,
  良: 88,
  缓: 74,
  败: 48,
};

export function getMoveQualityAccuracyScore(quality?: MoveQuality): number {
  return quality ? QUALITY_ACCURACY_WEIGHTS[quality] : 90;
}

export const DEFAULT_STUDY_METADATA: GameMetadata = {
  redPlayer: '红方（先手）',
  blackPlayer: '黑方（后手）',
  event: '自由拆棋 · 复盘分析',
  date: '2026-11-12',
  result: '进行中',
  site: '象棋X 分析工作台',
  opening: '标准开局（待定式）',
  isFavorite: false,
};

export const SAMPLE_MASTER_METADATA: GameMetadata = {
  redPlayer: '王天一',
  blackPlayer: '郑惟桐',
  event: '全国象棋个人锦标赛冠亚军决战',
  date: '2026-11-11',
  result: '红胜',
  site: '杭州棋院',
  opening: '中炮过河车对屏风马',
  isFavorite: true,
};

export const DEFAULT_ENGINE_PROFILES: EngineProfile[] = [
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
];
