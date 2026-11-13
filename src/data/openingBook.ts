import {
  Camp,
  LibraryGameItem,
  OpeningBookCategory,
  OpeningBookNode,
  OpeningMoveStat,
  OpeningPresetLine,
  Piece,
  Position,
} from '../types/xiangqi';
import {
  createInitialPieces,
  formatChineseMoveNotation,
  getPieceAt,
  getPositionKeyFromPieces,
} from '../utils/xiangqiRules';

interface OpeningLineDefinition {
  openingName: string;
  category: OpeningBookCategory;
  matchKeyword: string;
  totalGames: number;
  comment: string;
  path: [number, number, number, number][]; // [fromRow, fromCol, toRow, toCol]
  edgeStats: {
    frequencyPct: number;
    redWinPct: number;
    drawPct: number;
    blackWinPct: number;
    badge?: '主流' | '稳健' | '激烈' | '陷阱' | '古谱';
  };
}

function applyStep(pieces: Piece[], from: Position, to: Position): Piece[] {
  const moving = getPieceAt(pieces, from.row, from.col);
  if (!moving) return pieces;
  return pieces
    .filter((p) => !(p.row === to.row && p.col === to.col))
    .map((p) => (p.id === moving.id ? { ...p, row: to.row, col: to.col } : p));
}

const OPENING_LINE_DEFINITIONS: OpeningLineDefinition[] = [
  // ==================== 1. 炮二平五（中炮体系） ====================
  {
    openingName: '中炮局（当头炮）',
    category: '中炮体系',
    matchKeyword: '中炮',
    totalGames: 48620,
    comment: '象棋第一主流先手开局，直指黑方中路弱点，气势宏大、攻守变化极多。',
    path: [[7, 7, 7, 4]],
    edgeStats: { frequencyPct: 42, redWinPct: 39, drawPct: 37, blackWinPct: 24, badge: '主流' },
  },
  // 1a. 中炮对屏风马
  {
    openingName: '中炮对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 24180,
    comment: '黑方跳八路马固守中卒，双马相互照应如屏风，为对抗中炮最稳固的正着体系。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
    ],
    edgeStats: { frequencyPct: 46, redWinPct: 36, drawPct: 41, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮对屏风马（红正马）',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 21400,
    comment: '红方紧随跳起正马护中兵、亮出直车要道，双方步入现代布局经典通道。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
    ],
    edgeStats: { frequencyPct: 84, redWinPct: 37, drawPct: 40, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮对屏风马（黑双马出车）',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 16890,
    comment: '黑方先亮右直车抢占胁道，兼顾进卒与平炮兑车两种主流防线。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
    ],
    edgeStats: { frequencyPct: 68, redWinPct: 35, drawPct: 42, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮直车对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 15240,
    comment: '红方出直车准备随时过河或抢先占位，中局争夺主要围绕七路兵卒展开。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
    ],
    edgeStats: { frequencyPct: 76, redWinPct: 36, drawPct: 41, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮直车对屏风马 · 黑跳双正马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 13900,
    comment: '黑方完成双马守中阵型，后续红方可在「过河车」与「七路兵」间抉择进攻节奏。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
    ],
    edgeStats: { frequencyPct: 82, redWinPct: 35, drawPct: 42, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮过河车对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 8420,
    comment: '红车直插黑方卒林线，既可平车压马又可护兵强攻，历代全国冠军赛最激烈变例之一。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [9, 7, 3, 7],
    ],
    edgeStats: { frequencyPct: 45, redWinPct: 38, drawPct: 39, blackWinPct: 23, badge: '激烈' },
  },
  {
    openingName: '中炮过河车对屏风马平炮兑车',
    category: '中炮体系',
    matchKeyword: '平炮兑车',
    totalGames: 5310,
    comment: '黑方平炮兑车借势反击红方过河强车，衍生出「左马盘河」「急进中兵」两大经典名谱体系。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [9, 7, 3, 7],
      [2, 7, 2, 8],
    ],
    edgeStats: { frequencyPct: 62, redWinPct: 36, drawPct: 41, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '中炮过河车平炮兑车 · 进七兵',
    category: '中炮体系',
    matchKeyword: '平炮兑车',
    totalGames: 3120,
    comment: '红方不急于平车压马，先挺七兵活通七路马并邀兑7卒，走法稳健而富有张力。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [9, 7, 3, 7],
      [2, 7, 2, 8],
      [6, 2, 5, 2],
    ],
    edgeStats: { frequencyPct: 58, redWinPct: 36, drawPct: 42, blackWinPct: 22, badge: '主流' },
  },
  {
    openingName: '中炮过河车急进中兵',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 1940,
    comment: '红方强行冲起中兵发起中路闪击，搏杀极为激烈，要求计算精准不留破绽。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [9, 7, 3, 7],
      [2, 7, 2, 8],
      [6, 4, 5, 4],
    ],
    edgeStats: { frequencyPct: 34, redWinPct: 41, drawPct: 31, blackWinPct: 28, badge: '激烈' },
  },
  {
    openingName: '中炮过河车对屏风马飞象固中',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 2150,
    comment: '黑方先行飞象巩固中路，避开平炮兑车的尖锐变化，局势趋向沉稳互纠。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [9, 7, 3, 7],
      [0, 2, 2, 4],
    ],
    edgeStats: { frequencyPct: 24, redWinPct: 37, drawPct: 41, blackWinPct: 22, badge: '稳健' },
  },
  {
    openingName: '中炮进七兵对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 7180,
    comment: '红方先挺七兵疏通马路，缓步试探黑方两翼进卒选择，稳健而富于弹性。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [6, 2, 5, 2],
    ],
    edgeStats: { frequencyPct: 38, redWinPct: 35, drawPct: 44, blackWinPct: 21, badge: '稳健' },
  },
  {
    openingName: '中炮进七兵对屏风马挺7卒',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 4860,
    comment: '黑方对挺7卒活通左翼象眼与马路，演变为经典的「双头蛇」对「中炮七兵」阵地战。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [6, 2, 5, 2],
      [3, 6, 4, 6],
    ],
    edgeStats: { frequencyPct: 67, redWinPct: 35, drawPct: 43, blackWinPct: 22, badge: '主流' },
  },
  {
    openingName: '中炮进三兵对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    totalGames: 3250,
    comment: '活通右翼三路马路，常转化为「五七炮进三兵」稳步压迫阵型。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [0, 1, 2, 2],
      [6, 6, 5, 6],
    ],
    edgeStats: { frequencyPct: 17, redWinPct: 34, drawPct: 45, blackWinPct: 21 },
  },
  {
    openingName: '中炮巡河炮对屏风马',
    category: '中炮体系',
    matchKeyword: '巡河炮',
    totalGames: 2940,
    comment: '红方平边兵之前先架巡河炮或左炮过宫，注重双翼子力联防。',
    path: [
      [7, 7, 7, 4],
      [0, 7, 2, 6],
      [9, 7, 7, 6],
      [0, 8, 0, 7],
      [9, 8, 9, 7],
      [3, 6, 4, 6],
    ],
    edgeStats: { frequencyPct: 18, redWinPct: 34, drawPct: 43, blackWinPct: 23, badge: '稳健' },
  },
  // 1b. 顺手炮
  {
    openingName: '顺手炮',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 11840,
    comment: '《橘中秘》推崇的刚猛对攻布局：黑方同方向架中炮，双方对攻节奏极快。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
    ],
    edgeStats: { frequencyPct: 24, redWinPct: 44, drawPct: 30, blackWinPct: 26, badge: '古谱' },
  },
  {
    openingName: '顺炮正马对正马',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 9320,
    comment: '双方互跳正马亮出大车，即将围绕「直车」与「横车」展开激烈对杀。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
      [9, 7, 7, 6],
      [0, 7, 2, 6],
    ],
    edgeStats: { frequencyPct: 79, redWinPct: 43, drawPct: 31, blackWinPct: 26, badge: '主流' },
  },
  {
    openingName: '顺炮直车对横车',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 5640,
    comment: '红直车封锁肋道，黑方起横车占肋反击，《橘中秘》与现代特大对局常青树。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
      [9, 7, 7, 6],
      [0, 7, 2, 6],
      [9, 8, 9, 7],
      [0, 8, 1, 8],
    ],
    edgeStats: { frequencyPct: 58, redWinPct: 45, drawPct: 29, blackWinPct: 26, badge: '激烈' },
  },
  {
    openingName: '顺炮直车过河压马',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 3810,
    comment: '红方直车抢先过河压制黑方7路马，黑方需以横车占肋迅速展开对攻。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
      [9, 7, 7, 6],
      [0, 7, 2, 6],
      [9, 8, 9, 7],
      [0, 8, 1, 8],
      [9, 7, 3, 7],
    ],
    edgeStats: { frequencyPct: 72, redWinPct: 46, drawPct: 28, blackWinPct: 26, badge: '激烈' },
  },
  {
    openingName: '顺炮横车占肋反击',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 2920,
    comment: '黑横车直插四路肋道要津，形成典型的双翼互攻激战局面。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
      [9, 7, 7, 6],
      [0, 7, 2, 6],
      [9, 8, 9, 7],
      [0, 8, 1, 8],
      [9, 7, 3, 7],
      [1, 8, 1, 3],
    ],
    edgeStats: { frequencyPct: 64, redWinPct: 43, drawPct: 30, blackWinPct: 27, badge: '主流' },
  },
  {
    openingName: '顺炮双直车（缓开车）',
    category: '中炮体系',
    matchKeyword: '顺',
    totalGames: 3680,
    comment: '黑方改走直车争夺同一肋道，避开横车早期弱点，战局偏稳健细密。',
    path: [
      [7, 7, 7, 4],
      [2, 7, 2, 4],
      [9, 7, 7, 6],
      [0, 7, 2, 6],
      [9, 8, 9, 7],
      [0, 8, 0, 7],
    ],
    edgeStats: { frequencyPct: 42, redWinPct: 40, drawPct: 35, blackWinPct: 25, badge: '稳健' },
  },
  // 1c. 中炮对反宫马
  {
    openingName: '中炮对单提马转反宫马',
    category: '中炮体系',
    matchKeyword: '反宫马',
    totalGames: 7420,
    comment: '黑方先跳2路马预留士角炮，构建柔中带刚的反宫马反击阵形。',
    path: [
      [7, 7, 7, 4],
      [0, 1, 2, 2],
    ],
    edgeStats: { frequencyPct: 16, redWinPct: 38, drawPct: 39, blackWinPct: 23 },
  },
  {
    openingName: '中炮对反宫马标准阵型',
    category: '中炮体系',
    matchKeyword: '反宫马',
    totalGames: 5840,
    comment: '胡荣华等名家发扬光大的反击体系：炮8平6兼护中卒与亮车，弹性极强。',
    path: [
      [7, 7, 7, 4],
      [0, 1, 2, 2],
      [9, 7, 7, 6],
      [2, 7, 2, 5],
    ],
    edgeStats: { frequencyPct: 74, redWinPct: 36, drawPct: 40, blackWinPct: 24, badge: '主流' },
  },
  // 1d. 列手炮 & 陷阱警示
  {
    openingName: '列手炮（大列手炮）',
    category: '中炮体系',
    matchKeyword: '列手炮',
    totalGames: 5910,
    comment: '黑方反方向架起中炮，双方放弃部分边防直接互搏中路，着法凶险锐利。',
    path: [
      [7, 7, 7, 4],
      [2, 1, 2, 4],
    ],
    edgeStats: { frequencyPct: 12, redWinPct: 46, drawPct: 27, blackWinPct: 27, badge: '激烈' },
  },
  {
    openingName: '中炮对挺中卒（失先陷阱）',
    category: '中炮体系',
    matchKeyword: '中炮',
    totalGames: 1260,
    comment: '警示陷阱着：黑方过早挺5卒脱离中炮与双马保护，红方空头炮或中兵进攻威力大增。',
    path: [
      [7, 7, 7, 4],
      [3, 4, 4, 4],
    ],
    edgeStats: { frequencyPct: 2, redWinPct: 58, drawPct: 24, blackWinPct: 18, badge: '陷阱' },
  },

  // ==================== 2. 兵七进一（仙人指路） ====================
  {
    openingName: '仙人指路',
    category: '仙人指路',
    matchKeyword: '仙人指路',
    totalGames: 29450,
    comment: '现代大赛最流行先手试探着：先挺七兵活马，投石问路观察黑方应手后再定格局。',
    path: [[6, 2, 5, 2]],
    edgeStats: { frequencyPct: 26, redWinPct: 36, drawPct: 42, blackWinPct: 22, badge: '主流' },
  },
  {
    openingName: '仙人指路对卒底炮',
    category: '仙人指路',
    matchKeyword: '卒底炮',
    totalGames: 14820,
    comment: '黑方以炮2平3瞄准红七路兵线，为应对仙人指路的第一针锋相对大阵。',
    path: [
      [6, 2, 5, 2],
      [2, 1, 2, 2],
    ],
    edgeStats: { frequencyPct: 48, redWinPct: 35, drawPct: 42, blackWinPct: 23, badge: '主流' },
  },
  {
    openingName: '仙人指路转中炮对卒底炮',
    category: '仙人指路',
    matchKeyword: '卒底炮',
    totalGames: 7920,
    comment: '红方果断架起中炮转入攻杀，与黑方左炮右马形成激烈反先争夺战。',
    path: [
      [6, 2, 5, 2],
      [2, 1, 2, 2],
      [7, 7, 7, 4],
    ],
    edgeStats: { frequencyPct: 54, redWinPct: 37, drawPct: 39, blackWinPct: 24, badge: '激烈' },
  },
  {
    openingName: '仙人指路飞相局对卒底炮',
    category: '仙人指路',
    matchKeyword: '卒底炮',
    totalGames: 4860,
    comment: '红方飞起三路相稳固底防，控制局势转入细腻的相持拉锯战。',
    path: [
      [6, 2, 5, 2],
      [2, 1, 2, 2],
      [9, 6, 7, 4],
    ],
    edgeStats: { frequencyPct: 31, redWinPct: 33, drawPct: 46, blackWinPct: 21, badge: '稳健' },
  },
  {
    openingName: '仙人指路对挺卒（对兵局）',
    category: '仙人指路',
    matchKeyword: '仙人指路',
    totalGames: 8410,
    comment: '黑方毫不示弱挺起7卒对峙，双方多进入稳健散手与中盘柔功较量。',
    path: [
      [6, 2, 5, 2],
      [3, 6, 4, 6],
    ],
    edgeStats: { frequencyPct: 30, redWinPct: 34, drawPct: 45, blackWinPct: 21, badge: '稳健' },
  },
  {
    openingName: '仙人指路对起马',
    category: '仙人指路',
    matchKeyword: '仙人指路',
    totalGames: 5220,
    comment: '黑方跳八路正马还原屏风马架构，布局稳重而不失弹性。',
    path: [
      [6, 2, 5, 2],
      [0, 7, 2, 6],
    ],
    edgeStats: { frequencyPct: 22, redWinPct: 36, drawPct: 43, blackWinPct: 21 },
  },

  // ==================== 3. 相三进五（飞相局） ====================
  {
    openingName: '飞相局',
    category: '飞相局',
    matchKeyword: '飞相',
    totalGames: 20160,
    comment: '以守为攻的儒雅体系：先飞三路相巩固中防与双翼，等待后手先表态再相机反击。',
    path: [[9, 6, 7, 4]],
    edgeStats: { frequencyPct: 18, redWinPct: 33, drawPct: 46, blackWinPct: 21, badge: '稳健' },
  },
  {
    openingName: '飞相局对左中炮',
    category: '飞相局',
    matchKeyword: '飞相',
    totalGames: 10240,
    comment: '黑方针锋相对架起左中炮抢占中路，为迎战飞相局最强硬反击策略。',
    path: [
      [9, 6, 7, 4],
      [2, 1, 2, 4],
    ],
    edgeStats: { frequencyPct: 48, redWinPct: 34, drawPct: 44, blackWinPct: 22, badge: '主流' },
  },
  {
    openingName: '飞相局对左中炮（双方正马亮车）',
    category: '飞相局',
    matchKeyword: '飞相',
    totalGames: 6850,
    comment: '双方顺畅出动主力车马，许银川、吕钦等特大对局中常见高精准度平稳转换。',
    path: [
      [9, 6, 7, 4],
      [2, 1, 2, 4],
      [9, 7, 7, 6],
      [0, 1, 2, 2],
      [9, 8, 9, 7],
      [0, 0, 0, 1],
    ],
    edgeStats: { frequencyPct: 71, redWinPct: 33, drawPct: 47, blackWinPct: 20, badge: '稳健' },
  },
  {
    openingName: '飞相局对过宫炮',
    category: '飞相局',
    matchKeyword: '飞相',
    totalGames: 5620,
    comment: '黑方平8路炮至4路（过宫炮）协调双车，形成稳健对攻态势。',
    path: [
      [9, 6, 7, 4],
      [2, 7, 2, 3],
    ],
    edgeStats: { frequencyPct: 27, redWinPct: 32, drawPct: 47, blackWinPct: 21 },
  },
  {
    openingName: '飞相局对进挺卒',
    category: '飞相局',
    matchKeyword: '飞相',
    totalGames: 4300,
    comment: '黑方先挺7路卒限制红相发展方向，局面多呈对称拉锯。',
    path: [
      [9, 6, 7, 4],
      [3, 6, 4, 6],
    ],
    edgeStats: { frequencyPct: 25, redWinPct: 33, drawPct: 46, blackWinPct: 21 },
  },

  // ==================== 4. 马二进三（起马局） ====================
  {
    openingName: '起马局',
    category: '起马局',
    matchKeyword: '起马',
    totalGames: 10340,
    comment: '先出正马暗伏横车或平炮，讲究柔性与后发制人，常能还原转入中炮或屏风马阵地。',
    path: [[9, 7, 7, 6]],
    edgeStats: { frequencyPct: 9, redWinPct: 35, drawPct: 43, blackWinPct: 22, badge: '稳健' },
  },
  {
    openingName: '起马对挺卒',
    category: '起马局',
    matchKeyword: '起马',
    totalGames: 4820,
    comment: '黑方挺7路卒钳制红三路马前冲，双方在兵卒线上角力，战略变化隐蔽深沉。',
    path: [
      [9, 7, 7, 6],
      [3, 6, 4, 6],
    ],
    edgeStats: { frequencyPct: 47, redWinPct: 34, drawPct: 44, blackWinPct: 22, badge: '主流' },
  },
  {
    openingName: '起马转中炮对挺卒',
    category: '起马局',
    matchKeyword: '起马',
    totalGames: 2910,
    comment: '红方八路炮平中路架起左中炮，形成经典半开放式对攻体系。',
    path: [
      [9, 7, 7, 6],
      [3, 6, 4, 6],
      [7, 1, 7, 4],
    ],
    edgeStats: { frequencyPct: 58, redWinPct: 36, drawPct: 41, blackWinPct: 23 },
  },

  // ==================== 5. 炮八平五（左中炮） ====================
  {
    openingName: '左中炮开局',
    category: '中炮体系',
    matchKeyword: '中炮',
    totalGames: 5790,
    comment: '与常规右中炮对称镜像，扰乱对手既定布局节奏，常见于快棋与奇袭对局。',
    path: [[7, 1, 7, 4]],
    edgeStats: { frequencyPct: 5, redWinPct: 38, drawPct: 37, blackWinPct: 25 },
  },
];

let cachedOpeningMap: Map<string, OpeningBookNode> | null = null;

export function getOpeningBookMap(): Map<string, OpeningBookNode> {
  if (cachedOpeningMap) return cachedOpeningMap;

  const map = new Map<string, OpeningBookNode>();
  const basePieces = createInitialPieces('even');
  const rootKey = getPositionKeyFromPieces(basePieces, 'red');

  map.set(rootKey, {
    positionKey: rootKey,
    openingName: '标准初始局面（32子整阵）',
    category: '初始布局',
    matchKeyword: '',
    plyDepth: 0,
    totalGames: 114360,
    comment: '先手第一着决定全盘基调：中炮最为凌厉，仙人指路重弹性，飞相局守中带攻。',
    nextMoves: [],
  });

  for (const def of OPENING_LINE_DEFINITIONS) {
    let currPieces = basePieces.map((p) => ({ ...p }));
    let currTurn: Camp = 'red';

    for (let i = 0; i < def.path.length; i++) {
      const [fr, fc, tr, tc] = def.path[i];
      const from = { row: fr, col: fc };
      const to = { row: tr, col: tc };
      const parentKey = getPositionKeyFromPieces(currPieces, currTurn);
      const moving = getPieceAt(currPieces, fr, fc);
      if (!moving) break;
      const notation = formatChineseMoveNotation(moving, from, to);

      const nextPieces = applyStep(currPieces, from, to);
      const nextTurn: Camp = currTurn === 'red' ? 'black' : 'red';
      const childKey = getPositionKeyFromPieces(nextPieces, nextTurn);

      const isFinalStep = i === def.path.length - 1;
      if (isFinalStep) {
        if (!map.has(childKey)) {
          map.set(childKey, {
            positionKey: childKey,
            openingName: def.openingName,
            category: def.category,
            matchKeyword: def.matchKeyword,
            plyDepth: def.path.length,
            totalGames: def.totalGames,
            comment: def.comment,
            nextMoves: [],
          });
        }

        const parentNode = map.get(parentKey);
        if (parentNode) {
          const alreadyExists = parentNode.nextMoves.some(
            (m) =>
              m.from.row === from.row &&
              m.from.col === from.col &&
              m.to.row === to.row &&
              m.to.col === to.col
          );
          if (!alreadyExists) {
            const stat: OpeningMoveStat = {
              from,
              to,
              notation,
              frequencyPct: def.edgeStats.frequencyPct,
              redWinPct: def.edgeStats.redWinPct,
              drawPct: def.edgeStats.drawPct,
              blackWinPct: def.edgeStats.blackWinPct,
              targetOpeningName: def.openingName,
              badge: def.edgeStats.badge,
            };
            parentNode.nextMoves.push(stat);
            parentNode.nextMoves.sort((a, b) => b.frequencyPct - a.frequencyPct);
          }
        }
      }

      currPieces = nextPieces;
      currTurn = nextTurn;
    }
  }

  cachedOpeningMap = map;
  return map;
}

export function lookupOpeningBookNode(pieces: Piece[], turn: Camp): OpeningBookNode | null {
  const map = getOpeningBookMap();
  const key = getPositionKeyFromPieces(pieces, turn);
  return map.get(key) || null;
}

export function countMatchingLibraryGames(games: LibraryGameItem[], keyword: string): number {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return games.length;
  return games.filter(
    (g) =>
      g.opening.toLowerCase().includes(kw) ||
      g.event.toLowerCase().includes(kw) ||
      g.redPlayer.toLowerCase().includes(kw) ||
      g.blackPlayer.toLowerCase().includes(kw)
  ).length;
}

export const OPENING_PRESETS: OpeningPresetLine[] = [
  {
    id: 'preset-zhongpao-pingfeng',
    title: '中炮过河车对屏风马',
    category: '中炮体系',
    matchKeyword: '屏风马',
    difficulty: '经典',
    summary: '现代象棋攻防最高峰（8手直达平炮兑车焦点）',
    moves: [
      { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } },
      { from: { row: 0, col: 7 }, to: { row: 2, col: 6 } },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 0, col: 8 }, to: { row: 0, col: 7 } },
      { from: { row: 9, col: 8 }, to: { row: 9, col: 7 } },
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
      { from: { row: 9, col: 7 }, to: { row: 3, col: 7 } },
      { from: { row: 2, col: 7 }, to: { row: 2, col: 8 } },
    ],
  },
  {
    id: 'preset-zhongpao-qibing',
    title: '中炮进七兵对屏风马挺7卒',
    category: '中炮体系',
    matchKeyword: '屏风马',
    difficulty: '进阶',
    summary: '柔中带刚、结构完整的现代主流阵地战（8手）',
    moves: [
      { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } },
      { from: { row: 0, col: 7 }, to: { row: 2, col: 6 } },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 0, col: 8 }, to: { row: 0, col: 7 } },
      { from: { row: 9, col: 8 }, to: { row: 9, col: 7 } },
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
      { from: { row: 6, col: 2 }, to: { row: 5, col: 2 } },
      { from: { row: 3, col: 6 }, to: { row: 4, col: 6 } },
    ],
  },
  {
    id: 'preset-shunpao',
    title: '顺炮直车对横车占肋',
    category: '中炮体系',
    matchKeyword: '顺',
    difficulty: '经典',
    summary: '《橘中秘》对攻经典，直车横车双翼交错搏杀（8手）',
    moves: [
      { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } },
      { from: { row: 2, col: 7 }, to: { row: 2, col: 4 } },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 0, col: 7 }, to: { row: 2, col: 6 } },
      { from: { row: 9, col: 8 }, to: { row: 9, col: 7 } },
      { from: { row: 0, col: 8 }, to: { row: 1, col: 8 } },
      { from: { row: 9, col: 7 }, to: { row: 3, col: 7 } },
      { from: { row: 1, col: 8 }, to: { row: 1, col: 3 } },
    ],
  },
  {
    id: 'preset-xianren',
    title: '仙人指路转中炮对卒底炮',
    category: '仙人指路',
    matchKeyword: '卒底炮',
    difficulty: '基础',
    summary: '特大慢棋第一流行试探阵式（3手定调）',
    moves: [
      { from: { row: 6, col: 2 }, to: { row: 5, col: 2 } },
      { from: { row: 2, col: 1 }, to: { row: 2, col: 2 } },
      { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } },
    ],
  },
  {
    id: 'preset-feixiang',
    title: '飞相局对左中炮',
    category: '飞相局',
    matchKeyword: '飞相',
    difficulty: '进阶',
    summary: '稳健控局与中炮反击的精细较量（6手）',
    moves: [
      { from: { row: 9, col: 6 }, to: { row: 7, col: 4 } },
      { from: { row: 2, col: 1 }, to: { row: 2, col: 4 } },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
      { from: { row: 9, col: 8 }, to: { row: 9, col: 7 } },
      { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
    ],
  },
  {
    id: 'preset-fangong',
    title: '中炮对反宫马',
    category: '中炮体系',
    matchKeyword: '反宫马',
    difficulty: '基础',
    summary: '士角炮护中反击，结构紧凑富有弹性（4手）',
    moves: [
      { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } },
      { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 2, col: 7 }, to: { row: 2, col: 5 } },
    ],
  },
  {
    id: 'preset-qima',
    title: '起马转中炮对挺卒',
    category: '起马局',
    matchKeyword: '起马',
    difficulty: '基础',
    summary: '柔性起马后发制人，转架左中炮拉开中路战线（3手）',
    moves: [
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
      { from: { row: 3, col: 6 }, to: { row: 4, col: 6 } },
      { from: { row: 7, col: 1 }, to: { row: 7, col: 4 } },
    ],
  },
];
