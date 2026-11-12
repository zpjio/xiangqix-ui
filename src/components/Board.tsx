import React from 'react';
import {
  BoardTheme,
  Camp,
  FontScheme,
  ImpactEffect,
  MoveRecord,
  MultiPVArrow,
  Piece,
  PieceCraftStyle,
  PieceType,
  Position,
  WorkspaceMode,
} from '../types/xiangqi';
import {
  BLACK_ROAD_NUMERALS,
  PIECE_LABELS,
  RED_ROAD_NUMERALS,
  getPieceAt,
  isCampInCheck,
} from '../utils/xiangqiRules';
import { XiangqiPiece } from './XiangqiPiece';

interface BoardProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  legalMoves: Position[];
  lastMove: MoveRecord | null;
  multiPvArrows?: MultiPVArrow[];
  secondaryPvArrow?: MultiPVArrow | null;
  threatArrow?: MultiPVArrow | null;
  hoveredArrow?: MultiPVArrow | null;
  hintArrow?: MultiPVArrow | null;
  impactEffect?: ImpactEffect | null;
  boardTheme: BoardTheme;
  craftStyle: PieceCraftStyle;
  fontScheme: FontScheme;
  useTraditionalChar: boolean;
  flipped: boolean;
  workspace: WorkspaceMode;
  isVariationActive?: boolean;
  onSelectIntersection: (row: number, col: number) => void;
  // 摆子工坊专属 props
  setupSelectedTemplate?: { camp: Camp; type: PieceType } | null;
  onSelectSetupTemplate?: (template: { camp: Camp; type: PieceType } | null) => void;
  setupTurn?: Camp;
  onChangeSetupTurn?: (camp: Camp) => void;
  onClearSetupToKings?: () => void;
  onResetSetupInitial?: () => void;
  onFinishSetup?: () => void;
}

const STEP = 95;
const OFFSET_X = 70;
const OFFSET_Y = 72;

const ImpactDustBurst: React.FC<{ camp: Camp; isCapture: boolean; effectId: number }> = ({
  camp,
  isCapture,
  effectId,
}) => {
  const count = isCapture ? 16 : 10;
  const particles = Array.from({ length: count }).map((_, idx) => {
    const seed = ((effectId * 31 + idx * 17) % 97) / 97;
    const baseAngle = (idx / count) * Math.PI * 2 + (seed - 0.5) * 0.42;
    const minRadius = isCapture ? 22 : 18;
    const maxRadius = isCapture ? 48 : 34;
    const dist = minRadius + seed * (maxRadius - minRadius);

    const tx = `${Math.round(Math.cos(baseAngle) * dist)}px`;
    const ty = `${Math.round(Math.sin(baseAngle) * dist)}px`;
    const rot = `${Math.round((seed - 0.5) * 260)}deg`;
    const dur = `${Math.round((isCapture ? 500 : 420) + seed * 160)}ms`;
    const scale = (0.75 + seed * 0.6).toFixed(2);

    const isWoodSplinter = idx % 3 === 0;
    let colorClass = 'bg-[#C8372D]';
    if (isWoodSplinter) {
      colorClass = idx % 2 === 0 ? 'bg-[#DFC196]' : 'bg-[#8C5A36]';
    } else if (camp === 'black' && idx % 2 === 1) {
      colorClass = 'bg-[#D4AF37]';
    }

    return {
      key: `dust-${effectId}-${idx}`,
      isWoodSplinter,
      colorClass,
      style: {
        '--tx': tx,
        '--ty': ty,
        '--rot': rot,
        '--dur': dur,
        '--scale': scale,
        animationDelay: `${(idx % 4) * 12}ms`,
      } as React.CSSProperties,
    };
  });

  return (
    <div
      key={`burst-${effectId}`}
      className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
      aria-hidden="true"
    >
      <span
        className={`absolute w-10 h-10 rounded-full border animate-impact-ring ${
          isCapture
            ? 'border-[#C8372D]/85 shadow-[0_0_10px_rgba(200,55,45,0.45)]'
            : camp === 'red'
            ? 'border-[#A62626]/65'
            : 'border-[#D4AF37]/65'
        }`}
      />
      {particles.map((p) => (
        <span
          key={p.key}
          style={p.style}
          className={`absolute animate-dust-particle ${p.colorClass} ${
            p.isWoodSplinter ? 'w-1.5 h-0.5 rounded-[1px]' : 'w-1 h-1 rounded-full'
          }`}
        />
      ))}
    </div>
  );
};

export const Board: React.FC<BoardProps> = ({
  pieces,
  selectedPieceId,
  legalMoves,
  lastMove,
  multiPvArrows = [],
  secondaryPvArrow = null,
  threatArrow = null,
  hoveredArrow = null,
  hintArrow = null,
  impactEffect = null,
  boardTheme,
  craftStyle,
  fontScheme,
  useTraditionalChar,
  flipped,
  workspace,
  isVariationActive = false,
  onSelectIntersection,
  setupSelectedTemplate = null,
  onSelectSetupTemplate,
  setupTurn = 'red',
  onChangeSetupTurn,
  onClearSetupToKings,
  onResetSetupInitial,
  onFinishSetup,
}) => {
  const themeColors = {
    'xuan-rosewood': {
      surfaceStart: '#E6D2B0',
      surfaceMid: '#DBC299',
      surfaceEnd: '#C8AA7A',
      inkLine: '#2B221C',
      riverText: '#3A2B21',
      sealRed: '#9E2A2B',
      coordText: '#C5A880',
      frameClass: 'zitan-board-frame border-[#543828]',
    },
    'imperial-lacquer': {
      surfaceStart: '#231614',
      surfaceMid: '#1A100E',
      surfaceEnd: '#120A09',
      inkLine: '#C8A252',
      riverText: '#D4AF37',
      sealRed: '#B83227',
      coordText: '#D4AF37',
      frameClass: 'bg-[#140B09] border-[#6E5225] shadow-[0_18px_36px_rgba(0,0,0,0.85)]',
    },
    'song-celadon': {
      surfaceStart: '#DCE3DC',
      surfaceMid: '#CBD5CC',
      surfaceEnd: '#B5C3B7',
      inkLine: '#243028',
      riverText: '#2C3B31',
      sealRed: '#9E2A2B',
      coordText: '#BCC7BE',
      frameClass: 'bg-[#1E2621] border-[#425247] shadow-[0_18px_36px_rgba(0,0,0,0.8)]',
    },
  }[boardTheme];

  const toVisualCoord = (row: number, col: number) => ({
    vRow: flipped ? 9 - row : row,
    vCol: flipped ? 8 - col : col,
  });

  const redCheckPos = isCampInCheck(pieces, 'red');
  const blackCheckPos = isCampInCheck(pieces, 'black');
  const anyCheckPos = redCheckPos || blackCheckPos;

  const renderFiducialMark = (row: number, col: number) => {
    const cx = OFFSET_X + col * STEP;
    const cy = OFFSET_Y + row * STEP;
    const gap = 7;
    const len = 16;
    const paths: string[] = [];

    if (col > 0) {
      paths.push(
        `M ${cx - gap - len} ${cy - gap} L ${cx - gap} ${cy - gap} L ${cx - gap} ${cy - gap - len}`
      );
      paths.push(
        `M ${cx - gap - len} ${cy + gap} L ${cx - gap} ${cy + gap} L ${cx - gap} ${cy + gap + len}`
      );
    }
    if (col < 8) {
      paths.push(
        `M ${cx + gap + len} ${cy - gap} L ${cx + gap} ${cy - gap} L ${cx + gap} ${cy - gap - len}`
      );
      paths.push(
        `M ${cx + gap + len} ${cy + gap} L ${cx + gap} ${cy + gap} L ${cx + gap} ${cy + gap + len}`
      );
    }

    return (
      <path
        key={`mark-${row}-${col}`}
        d={paths.join(' ')}
        fill="none"
        stroke={themeColors.inkLine}
        strokeWidth="2"
        strokeLinecap="square"
        strokeOpacity="0.82"
      />
    );
  };

  const fiducialPositions: [number, number][] = [
    [2, 1],
    [2, 7],
    [7, 1],
    [7, 7],
    [3, 0],
    [3, 2],
    [3, 4],
    [3, 6],
    [3, 8],
    [6, 0],
    [6, 2],
    [6, 4],
    [6, 6],
    [6, 8],
  ];

  // 推演支线激活或特殊模式时的外缘光晕
  const modeRimClass = isVariationActive
    ? 'ring-2 ring-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.28)]'
    : workspace === 'challenge'
    ? 'ring-1 ring-[#C8372D]/60'
    : workspace === 'setup'
    ? 'ring-2 ring-[#C87D3B]'
    : '';

  const maxPieceQuota: { type: PieceType; max: number }[] = [
    { type: 'chariot', max: 2 },
    { type: 'horse', max: 2 },
    { type: 'cannon', max: 2 },
    { type: 'advisor', max: 2 },
    { type: 'elephant', max: 2 },
    { type: 'soldier', max: 5 },
    { type: 'general', max: 1 },
  ];

  const getRemainingCount = (camp: Camp, type: PieceType, max: number) => {
    const onBoard = pieces.filter((p) => p.camp === camp && p.type === type).length;
    return Math.max(0, max - onBoard);
  };

  const topNumerals = flipped ? [...RED_ROAD_NUMERALS].reverse() : BLACK_ROAD_NUMERALS;
  const bottomNumerals = flipped ? [...BLACK_ROAD_NUMERALS].reverse() : RED_ROAD_NUMERALS;

  const renderSvgArrow = (
    arrow: MultiPVArrow,
    key: string,
    color: string,
    markerId: string,
    isDashed = false,
    strokeW = '12',
    labelRatio = 0.5
  ) => {
    const vf = toVisualCoord(arrow.from.row, arrow.from.col);
    const vt = toVisualCoord(arrow.to.row, arrow.to.col);
    const x1 = OFFSET_X + vf.vCol * STEP;
    const y1 = OFFSET_Y + vf.vRow * STEP;
    const x2 = OFFSET_X + vt.vCol * STEP;
    const y2 = OFFSET_Y + vt.vRow * STEP;
    const midX = x1 + (x2 - x1) * labelRatio;
    const midY = y1 + (y2 - y1) * labelRatio;
    const boxWidth = Math.max(76, arrow.scoreText.length * 10 + 18);

    return (
      <g key={key} className="pointer-events-none">
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={isDashed ? '12 8' : undefined}
          strokeOpacity="0.88"
          markerEnd={`url(#${markerId})`}
        />
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-boxWidth / 2}
            y="-13"
            width={boxWidth}
            height="26"
            rx="6"
            fill="#1A1412"
            fillOpacity="0.92"
            stroke={color}
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fill="#FAF5EB"
            className="font-mono-tabular text-[13px] font-semibold"
          >
            {arrow.scoreText}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="relative flex items-center justify-center gap-3 select-none">
      {/* 棋盘主体容器：随视口高度自适应放大（最高可达 620px 宽），同时确保一屏完整容纳不产生纵向滚动 */}
      <div className="relative w-[clamp(430px,calc((100vh-228px)*0.89),620px)] transition-all">
        <div
          className={`relative rounded-xl p-2.5 sm:p-3 border-2 transition-all duration-200 ${themeColors.frameClass} ${modeRimClass}`}
        >
          {/* 四个传统黄铜回纹包角 */}
          <span className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#D4AF37]/50 pointer-events-none" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#D4AF37]/50 pointer-events-none" />
          <span className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#D4AF37]/50 pointer-events-none" />
          <span className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#D4AF37]/50 pointer-events-none" />

          {/* 将军浮层徽章 */}
          {anyCheckPos && (
            <div className="absolute top-3 right-4 z-40 px-2.5 py-0.5 rounded bg-[#C8372D] text-[#FAF5EB] text-xs font-serif-sc font-bold tracking-widest shadow-lg border border-[#D4AF37]/60 pointer-events-none">
              將軍
            </div>
          )}

          {/* 内联推演支线激活提示角标 */}
          {isVariationActive && (
            <div className="absolute top-3 left-4 z-40 px-2 py-0.5 rounded bg-[#D4AF37] text-[#18120E] text-[11px] font-semibold shadow pointer-events-none">
              推演分支中
            </div>
          )}

          {/* 内部盘面画布 (宽高比 9:10) */}
          <div className="relative w-full aspect-[9/10] rounded-lg overflow-hidden shadow-inner">
            <svg
              viewBox="0 0 900 1000"
              className="w-full h-full block"
              aria-label="中国象棋九路十线传统棋盘"
            >
              <defs>
                <radialGradient id="xuanSurfaceGrad" cx="50%" cy="48%" r="65%">
                  <stop offset="0%" stopColor={themeColors.surfaceStart} />
                  <stop offset="65%" stopColor={themeColors.surfaceMid} />
                  <stop offset="100%" stopColor={themeColors.surfaceEnd} />
                </radialGradient>

                <filter id="xuanPaperNoise" x="0%" y="0%" width="100%" height="100%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.04"
                    numOctaves="4"
                    result="noise"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.045 0"
                    in="noise"
                    result="softNoise"
                  />
                  <feBlend in="SourceGraphic" in2="softNoise" mode="multiply" />
                </filter>

                <marker
                  id="arrow-primary"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#10B981" fillOpacity="0.95" />
                </marker>
                <marker
                  id="arrow-secondary"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#B87D1E" fillOpacity="0.82" />
                </marker>
                <marker
                  id="arrow-threat"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D93829" fillOpacity="0.95" />
                </marker>
                <marker
                  id="arrow-ghost"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D4AF37" fillOpacity="0.95" />
                </marker>
                <marker
                  id="arrow-compare-secondary"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#3B82F6" fillOpacity="0.95" />
                </marker>
              </defs>

              {/* 棋盘底板 */}
              <rect
                x="0"
                y="0"
                width="900"
                height="1000"
                fill="url(#xuanSurfaceGrad)"
                filter="url(#xuanPaperNoise)"
              />

              {/* 盘内顶部与底部路数坐标 */}
              <g className="font-serif-sc text-[22px] font-bold select-none" opacity="0.72">
                {Array.from({ length: 9 }).map((_, col) => {
                  const x = OFFSET_X + col * STEP;
                  return (
                    <React.Fragment key={`coord-${col}`}>
                      <text
                        x={x}
                        y={38}
                        textAnchor="middle"
                        fill={themeColors.inkLine}
                        className="font-mono-tabular"
                      >
                        {topNumerals[col]}
                      </text>
                      <text x={x} y={978} textAnchor="middle" fill={themeColors.inkLine}>
                        {bottomNumerals[col]}
                      </text>
                    </React.Fragment>
                  );
                })}
              </g>

              {/* 外围双层重框 */}
              <rect
                x={OFFSET_X - 12}
                y={OFFSET_Y - 12}
                width={8 * STEP + 24}
                height={9 * STEP + 24}
                fill="none"
                stroke={themeColors.inkLine}
                strokeWidth="5"
                strokeOpacity="0.9"
              />
              <rect
                x={OFFSET_X}
                y={OFFSET_Y}
                width={8 * STEP}
                height={9 * STEP}
                fill="none"
                stroke={themeColors.inkLine}
                strokeWidth="2.4"
                strokeOpacity="0.9"
              />

              {/* 十条横线 */}
              {Array.from({ length: 10 }).map((_, r) => {
                const y = OFFSET_Y + r * STEP;
                return (
                  <line
                    key={`h-line-${r}`}
                    x1={OFFSET_X}
                    y1={y}
                    x2={OFFSET_X + 8 * STEP}
                    y2={y}
                    stroke={themeColors.inkLine}
                    strokeWidth={r === 0 || r === 4 || r === 5 || r === 9 ? '2.6' : '2'}
                    strokeOpacity="0.86"
                  />
                );
              })}

              {/* 内部七条纵线 */}
              {Array.from({ length: 7 }).map((_, idx) => {
                const c = idx + 1;
                const x = OFFSET_X + c * STEP;
                return (
                  <g key={`v-line-${c}`}>
                    <line
                      x1={x}
                      y1={OFFSET_Y}
                      x2={x}
                      y2={OFFSET_Y + 4 * STEP}
                      stroke={themeColors.inkLine}
                      strokeWidth="2"
                      strokeOpacity="0.85"
                    />
                    <line
                      x1={x}
                      y1={OFFSET_Y + 5 * STEP}
                      x2={x}
                      y2={OFFSET_Y + 9 * STEP}
                      stroke={themeColors.inkLine}
                      strokeWidth="2"
                      strokeOpacity="0.85"
                    />
                  </g>
                );
              })}

              {/* 南北九宫米字斜线 */}
              <g
                stroke={themeColors.inkLine}
                strokeWidth="2"
                strokeOpacity="0.82"
                strokeDasharray="6 3"
              >
                <line
                  x1={OFFSET_X + 3 * STEP}
                  y1={OFFSET_Y}
                  x2={OFFSET_X + 5 * STEP}
                  y2={OFFSET_Y + 2 * STEP}
                />
                <line
                  x1={OFFSET_X + 5 * STEP}
                  y1={OFFSET_Y}
                  x2={OFFSET_X + 3 * STEP}
                  y2={OFFSET_Y + 2 * STEP}
                />
                <line
                  x1={OFFSET_X + 3 * STEP}
                  y1={OFFSET_Y + 7 * STEP}
                  x2={OFFSET_X + 5 * STEP}
                  y2={OFFSET_Y + 9 * STEP}
                />
                <line
                  x1={OFFSET_X + 5 * STEP}
                  y1={OFFSET_Y + 7 * STEP}
                  x2={OFFSET_X + 3 * STEP}
                  y2={OFFSET_Y + 9 * STEP}
                />
              </g>

              {/* 九宫中心中军宝座菱形花饰 */}
              {[1, 8].map((centerRow) => {
                const cx = OFFSET_X + 4 * STEP;
                const cy = OFFSET_Y + centerRow * STEP;
                return (
                  <polygon
                    key={`palace-gem-${centerRow}`}
                    points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
                    fill={themeColors.inkLine}
                    fillOpacity="0.32"
                  />
                );
              })}

              {/* 14个炮位与兵卒位传统直角折角标 */}
              {fiducialPositions.map(([r, c]) => renderFiducialMark(r, c))}

              {/* 楚河汉界书法榜书与闲章 */}
              <g className="select-none pointer-events-none">
                <text
                  x={OFFSET_X + 1.85 * STEP}
                  y={OFFSET_Y + 4.64 * STEP}
                  textAnchor="middle"
                  fill={themeColors.riverText}
                  fillOpacity="0.86"
                  className="font-calligraphy text-[52px] tracking-[0.28em]"
                >
                  楚河
                </text>
                <g
                  transform={`translate(${OFFSET_X + 4 * STEP - 18}, ${
                    OFFSET_Y + 4.5 * STEP - 18
                  })`}
                >
                  <rect
                    width="36"
                    height="36"
                    rx="3"
                    fill={themeColors.sealRed}
                    fillOpacity="0.82"
                  />
                  <rect
                    x="2.5"
                    y="2.5"
                    width="31"
                    height="31"
                    fill="none"
                    stroke="#F4EFE6"
                    strokeWidth="1"
                    strokeOpacity="0.7"
                  />
                  <text
                    x="18"
                    y="15"
                    textAnchor="middle"
                    fill="#F4EFE6"
                    className="font-serif-sc text-[10px] font-bold"
                  >
                    觀棋
                  </text>
                  <text
                    x="18"
                    y="28"
                    textAnchor="middle"
                    fill="#F4EFE6"
                    className="font-serif-sc text-[10px] font-bold"
                  >
                    不語
                  </text>
                </g>
                <text
                  x={OFFSET_X + 6.25 * STEP}
                  y={OFFSET_Y + 4.64 * STEP}
                  textAnchor="middle"
                  fill={themeColors.riverText}
                  fillOpacity="0.86"
                  className="font-calligraphy text-[52px] tracking-[0.28em]"
                >
                  漢界
                </text>
              </g>

              {/* 上一步起止轨迹虚线指示 */}
              {lastMove &&
                (() => {
                  const vf = toVisualCoord(lastMove.from.row, lastMove.from.col);
                  const vt = toVisualCoord(lastMove.to.row, lastMove.to.col);
                  return (
                    <g className="pointer-events-none">
                      <line
                        x1={OFFSET_X + vf.vCol * STEP}
                        y1={OFFSET_Y + vf.vRow * STEP}
                        x2={OFFSET_X + vt.vCol * STEP}
                        y2={OFFSET_Y + vt.vRow * STEP}
                        stroke="#9E2A2B"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                        strokeOpacity="0.7"
                      />
                      <circle
                        cx={OFFSET_X + vf.vCol * STEP}
                        cy={OFFSET_Y + vf.vRow * STEP}
                        r="7"
                        fill="#9E2A2B"
                        fillOpacity="0.75"
                      />
                    </g>
                  );
                })()}

              {/* MultiPV 引擎主变/次变箭头层 (错位排布标签比例以防同起点走法遮挡) */}
              {multiPvArrows.map((arrow) =>
                renderSvgArrow(
                  arrow,
                  `pv-arrow-${arrow.rank}`,
                  arrow.rank === 1 ? '#10B981' : '#B87D1E',
                  arrow.rank === 1 ? 'arrow-primary' : 'arrow-secondary',
                  arrow.rank !== 1,
                  arrow.isConsensus ? '14' : arrow.rank === 1 ? '13' : '7.5',
                  arrow.rank === 1 ? 0.46 : arrow.rank === 2 ? 0.64 : 0.34
                )
              )}

              {/* 双擎对比模式：副引擎首推着法天青蓝箭头 (当与主引擎分歧时独立显示，标签置于 0.64 处避免与主擎交叉重叠) */}
              {secondaryPvArrow &&
                renderSvgArrow(
                  secondaryPvArrow,
                  'secondary-engine-arrow',
                  '#3B82F6',
                  'arrow-compare-secondary',
                  false,
                  '11.5',
                  0.64
                )}

              {/* 对手威胁雷达箭头 (Threat Radar) */}
              {threatArrow &&
                renderSvgArrow(
                  threatArrow,
                  'threat-arrow',
                  '#D93829',
                  'arrow-threat',
                  true,
                  '10'
                )}

              {/* 锦囊提示箭头 (Hint Move) */}
              {hintArrow &&
                renderSvgArrow(hintArrow, 'hint-arrow', '#D4AF37', 'arrow-ghost', false, '14')}

              {/* 悬停幽灵预览箭头 (Hover Ghost Preview) */}
              {hoveredArrow &&
                renderSvgArrow(
                  hoveredArrow,
                  'hovered-arrow',
                  '#D4AF37',
                  'arrow-ghost',
                  false,
                  '14'
                )}
            </svg>

            {/* 第二层：DOM + CSS 九路十线 90 个交叉点与立体棋子层 */}
            <div className="absolute inset-0">
              {Array.from({ length: 10 }).map((_, row) =>
                Array.from({ length: 9 }).map((__, col) => {
                  const { vRow, vCol } = toVisualCoord(row, col);
                  const leftPct = ((OFFSET_X + vCol * STEP) / 900) * 100;
                  const topPct = ((OFFSET_Y + vRow * STEP) / 1000) * 100;

                  const piece = getPieceAt(pieces, row, col);
                  const isSelected = piece ? piece.id === selectedPieceId : false;
                  const isLegalTarget = legalMoves.some((m) => m.row === row && m.col === col);
                  const isLastMoveDest =
                    lastMove?.to.row === row && lastMove?.to.col === col;
                  const isImpactHere =
                    impactEffect && impactEffect.row === row && impactEffect.col === col;
                  const isPieceInCheck =
                    piece?.type === 'general' &&
                    ((piece.camp === 'red' && !!redCheckPos) ||
                      (piece.camp === 'black' && !!blackCheckPos));

                  return (
                    <div
                      key={`intersection-${row}-${col}`}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: '9.4%',
                        height: '8.46%',
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                    >
                      {isImpactHere && (
                        <ImpactDustBurst
                          camp={impactEffect.camp}
                          isCapture={impactEffect.isCapture}
                          effectId={impactEffect.id}
                        />
                      )}

                      {!piece && (
                        <button
                          type="button"
                          onClick={() => onSelectIntersection(row, col)}
                          aria-label={`交叉点 第${row + 1}横 第${col + 1}路`}
                          className="w-full h-full rounded-full flex items-center justify-center cursor-pointer group focus:outline-none"
                        >
                          {isLegalTarget ? (
                            <span className="relative flex items-center justify-center w-5 h-5">
                              <span className="w-3.5 h-3.5 rounded-full bg-[#3E6B52] border border-[#D4AF37] shadow-[0_0_8px_rgba(62,107,82,0.85)] transition-transform group-hover:scale-125" />
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[#9E2A2B]/25 transition-colors" />
                          )}
                        </button>
                      )}

                      {piece && (
                        <div
                          key={isImpactHere ? `piece-land-${impactEffect.id}` : piece.id}
                          className={`relative w-full h-full flex items-center justify-center ${
                            isImpactHere ? 'animate-piece-land' : ''
                          }`}
                        >
                          <XiangqiPiece
                            piece={piece}
                            isSelected={isSelected}
                            isLastMove={isLastMoveDest}
                            isInCheck={isPieceInCheck}
                            craftStyle={craftStyle}
                            fontScheme={fontScheme}
                            useTraditionalChar={useTraditionalChar}
                            onClick={() => onSelectIntersection(row, col)}
                          />

                          {isLegalTarget && (
                            <button
                              type="button"
                              onClick={() => onSelectIntersection(row, col)}
                              aria-label={`吃掉${piece.camp === 'red' ? '红' : '黑'}子`}
                              className="absolute -inset-1 z-40 cursor-pointer pointer-events-auto flex items-center justify-center"
                            >
                              <span className="w-full h-full rounded-full border-2 border-[#C8372D] shadow-[0_0_12px_rgba(200,55,45,0.85)]" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 摆子编辑右侧子力库 */}
      {workspace === 'setup' && (
        <aside className="w-56 rounded-xl border xq-elevated p-3.5 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between border-b xq-border pb-2">
            <span className="text-xs font-semibold">摆子子力库</span>
            <span className="text-[11px] xq-text-muted">选子后点交点</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 黑方列 */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-medium xq-text-secondary text-center pb-0.5 border-b xq-border">
                黑方棋子
              </div>
              {maxPieceQuota.map(({ type, max }) => {
                const remain = getRemainingCount('black', type, max);
                const isSelected =
                  setupSelectedTemplate?.camp === 'black' &&
                  setupSelectedTemplate?.type === type;
                return (
                  <button
                    key={`setup-b-${type}`}
                    type="button"
                    onClick={() =>
                      onSelectSetupTemplate?.(
                        isSelected ? null : { camp: 'black', type }
                      )
                    }
                    className={`flex items-center justify-between px-2 py-1 rounded border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15'
                        : 'xq-border hover:bg-[var(--xq-bg-hover)]'
                    }`}
                  >
                    <span className="font-serif-sc font-bold text-[#DFB654] bg-[#241E1B] w-6 h-6 rounded-full flex items-center justify-center border border-[#D4AF37]/40">
                      {useTraditionalChar
                        ? PIECE_LABELS.black[type].traditional
                        : PIECE_LABELS.black[type].simplified}
                    </span>
                    <span className="font-mono-tabular text-[11px] xq-text-secondary">
                      ×{remain}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 红方列 */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-medium xq-text-secondary text-center pb-0.5 border-b xq-border">
                红方棋子
              </div>
              {maxPieceQuota.map(({ type, max }) => {
                const remain = getRemainingCount('red', type, max);
                const isSelected =
                  setupSelectedTemplate?.camp === 'red' &&
                  setupSelectedTemplate?.type === type;
                return (
                  <button
                    key={`setup-r-${type}`}
                    type="button"
                    onClick={() =>
                      onSelectSetupTemplate?.(
                        isSelected ? null : { camp: 'red', type }
                      )
                    }
                    className={`flex items-center justify-between px-2 py-1 rounded border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#C8372D] bg-[#C8372D]/15'
                        : 'xq-border hover:bg-[var(--xq-bg-hover)]'
                    }`}
                  >
                    <span className="font-serif-sc font-bold text-[#A62222] bg-[#EAD2B0] w-6 h-6 rounded-full flex items-center justify-center border border-[#9E2A2B]/50">
                      {useTraditionalChar
                        ? PIECE_LABELS.red[type].traditional
                        : PIECE_LABELS.red[type].simplified}
                    </span>
                    <span className="font-mono-tabular text-[11px] xq-text-secondary">
                      ×{remain}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1 border-t xq-border flex flex-col gap-1.5">
            <span className="text-xs xq-text-secondary">先行方</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeSetupTurn?.('red')}
                className={`py-1 text-xs rounded-md cursor-pointer ${
                  setupTurn === 'red' ? 'xq-btn-option-active' : 'xq-btn-option'
                }`}
              >
                红先
              </button>
              <button
                type="button"
                onClick={() => onChangeSetupTurn?.('black')}
                className={`py-1 text-xs rounded-md cursor-pointer ${
                  setupTurn === 'black' ? 'xq-btn-option-active' : 'xq-btn-option'
                }`}
              >
                黑先
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={onClearSetupToKings}
              className="px-2 py-1.5 rounded-md xq-btn-secondary text-xs whitespace-nowrap cursor-pointer"
            >
              仅留将帅
            </button>
            <button
              type="button"
              onClick={onResetSetupInitial}
              className="px-2 py-1.5 rounded-md xq-btn-secondary text-xs whitespace-nowrap cursor-pointer"
            >
              初始棋盘
            </button>
          </div>

          <button
            type="button"
            onClick={onFinishSetup}
            className="w-full py-2 rounded-md xq-btn-primary text-xs whitespace-nowrap cursor-pointer"
          >
            完成摆子
          </button>
        </aside>
      )}
    </div>
  );
};
