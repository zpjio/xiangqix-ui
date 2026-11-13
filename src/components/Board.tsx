import React, { useMemo } from 'react';
import { ArrowRightCircle, RotateCcw, X } from 'lucide-react';
import {
  BoardTheme,
  Camp,
  CheckAttackLine,
  CheckSealEffect,
  FontScheme,
  GameTerminalState,
  ImpactEffect,
  MoveRecord,
  MultiPVArrow,
  Piece,
  PieceCraftStyle,
  Position,
  WorkspaceMode,
} from '../types/xiangqi';
import {
  BLACK_ROAD_NUMERALS,
  RED_ROAD_NUMERALS,
  buildBoardGrid,
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
  redCheckPos?: Position | null;
  blackCheckPos?: Position | null;
  checkAttackLines?: CheckAttackLine[];
  checkSealEffect?: CheckSealEffect | null;
  illegalCheckCamp?: Camp | null;
  terminalOutcome?: GameTerminalState | null;
  terminalDismissed?: boolean;
  onDismissTerminal?: () => void;
  onRestoreTerminal?: () => void;
  onTerminalPrimaryAction?: () => void;
  terminalPrimaryLabel?: string;
  onTerminalRestartAction?: () => void;
  terminalRestartLabel?: string;
  boardTheme: BoardTheme;
  craftStyle: PieceCraftStyle;
  fontScheme: FontScheme;
  useTraditionalChar: boolean;
  flipped: boolean;
  workspace: WorkspaceMode;
  isVariationActive?: boolean;
  onSelectIntersection: (row: number, col: number) => void;
}

const STEP = 95;
const OFFSET_X = 70;
const OFFSET_Y = 72;

const THEME_PALETTES: Record<
  BoardTheme,
  {
    surfaceStart: string;
    surfaceMid: string;
    surfaceEnd: string;
    inkLine: string;
    riverText: string;
    sealRed: string;
    coordText: string;
    frameClass: string;
  }
> = {
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
};

const FIDUCIAL_POSITIONS: [number, number][] = [
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

/* ==================== 第 1 层：静态盘面纹理与网格 SVG（独立缓存，隔离 feTurbulence 重栅格化） ==================== */
const StaticBoardSurface: React.FC<{ boardTheme: BoardTheme; flipped: boolean }> = React.memo(
  ({ boardTheme, flipped }) => {
    const themeColors = THEME_PALETTES[boardTheme];
    const topNumerals = flipped ? [...RED_ROAD_NUMERALS].reverse() : BLACK_ROAD_NUMERALS;
    const bottomNumerals = flipped ? [...BLACK_ROAD_NUMERALS].reverse() : RED_ROAD_NUMERALS;

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

    return (
      <svg
        viewBox="0 0 900 1000"
        className="w-full h-full block pointer-events-none"
        style={{ contain: 'layout paint style' }}
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
        {FIDUCIAL_POSITIONS.map(([r, c]) => renderFiducialMark(r, c))}

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
      </svg>
    );
  }
);

/* ==================== 第 2 层：动态指示箭头层（悬停预览/主变/威胁变化时仅重绘本层） ==================== */
const DynamicArrowLayer: React.FC<{
  flipped: boolean;
  lastMove: MoveRecord | null;
  checkAttackLines: CheckAttackLine[];
  multiPvArrows: MultiPVArrow[];
  secondaryPvArrow: MultiPVArrow | null;
  threatArrow: MultiPVArrow | null;
  hoveredArrow: MultiPVArrow | null;
  hintArrow: MultiPVArrow | null;
}> = React.memo(
  ({
    flipped,
    lastMove,
    checkAttackLines,
    multiPvArrows,
    secondaryPvArrow,
    threatArrow,
    hoveredArrow,
    hintArrow,
  }) => {
    const toVisualCoord = (row: number, col: number) => ({
      vRow: flipped ? 9 - row : row,
      vCol: flipped ? 8 - col : col,
    });

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
      <svg
        viewBox="0 0 900 1000"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
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

        {/* 照将（将军）攻击线脉动：从照将子连向受将帅/将 */}
        {checkAttackLines.map((ray, idx) => {
          const vf = toVisualCoord(ray.from.row, ray.from.col);
          const vt = toVisualCoord(ray.to.row, ray.to.col);
          const x1 = OFFSET_X + vf.vCol * STEP;
          const y1 = OFFSET_Y + vf.vRow * STEP;
          const x2 = OFFSET_X + vt.vCol * STEP;
          const y2 = OFFSET_Y + vt.vRow * STEP;
          return (
            <g key={`check-ray-${idx}-${ray.from.row}-${ray.from.col}`} className="pointer-events-none">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#E03126"
                strokeWidth="7"
                strokeLinecap="round"
                strokeOpacity="0.24"
              />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#F59E0B"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="10 8"
                markerEnd="url(#arrow-threat)"
                className="animate-check-ray"
              />
              <circle
                cx={x1}
                cy={y1}
                r="40"
                fill="none"
                stroke="#E03126"
                strokeWidth="2.4"
                strokeDasharray="6 5"
                strokeOpacity="0.72"
              />
            </g>
          );
        })}

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

        {/* MultiPV 引擎主变/次变箭头层 */}
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

        {/* 双擎对比模式：副引擎首推着法天青蓝箭头 */}
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

        {/* 对手威胁雷达箭头 */}
        {threatArrow &&
          renderSvgArrow(threatArrow, 'threat-arrow', '#D93829', 'arrow-threat', true, '10')}

        {/* 锦囊提示箭头 */}
        {hintArrow &&
          renderSvgArrow(hintArrow, 'hint-arrow', '#D4AF37', 'arrow-ghost', false, '14')}

        {/* 悬停幽灵预览箭头 */}
        {hoveredArrow &&
          renderSvgArrow(hoveredArrow, 'hovered-arrow', '#D4AF37', 'arrow-ghost', false, '14')}
      </svg>
    );
  }
);

/* ==================== 第 3 层：记忆化 90 交点与立体棋子单元格 ==================== */
const IntersectionCell: React.FC<{
  row: number;
  col: number;
  leftPct: number;
  topPct: number;
  piece: Piece | null;
  isSelected: boolean;
  isLegalTarget: boolean;
  isLastMoveDest: boolean;
  impactCamp: Camp | null;
  impactIsCapture: boolean;
  impactId: number | null;
  isPieceInCheck: boolean;
  isAlertShaking: boolean;
  craftStyle: PieceCraftStyle;
  fontScheme: FontScheme;
  useTraditionalChar: boolean;
  onSelectIntersection: (row: number, col: number) => void;
}> = React.memo(
  ({
    row,
    col,
    leftPct,
    topPct,
    piece,
    isSelected,
    isLegalTarget,
    isLastMoveDest,
    impactCamp,
    impactIsCapture,
    impactId,
    isPieceInCheck,
    isAlertShaking,
    craftStyle,
    fontScheme,
    useTraditionalChar,
    onSelectIntersection,
  }) => {
    return (
      <div
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: '9.4%',
          height: '8.46%',
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
      >
        {impactId !== null && impactCamp && (
          <ImpactDustBurst
            camp={impactCamp}
            isCapture={impactIsCapture}
            effectId={impactId}
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
            key={impactId !== null ? `piece-land-${impactId}` : piece.id}
            className={`relative w-full h-full flex items-center justify-center ${
              impactId !== null ? 'animate-piece-land' : ''
            }`}
          >
            <XiangqiPiece
              piece={piece}
              isSelected={isSelected}
              isLastMove={isLastMoveDest}
              isInCheck={isPieceInCheck}
              isAlertShaking={isAlertShaking}
              craftStyle={craftStyle}
              fontScheme={fontScheme}
              useTraditionalChar={useTraditionalChar}
              onSelectIntersection={onSelectIntersection}
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
  }
);

export const Board: React.FC<BoardProps> = React.memo(
  ({
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
    redCheckPos: propRedCheckPos,
    blackCheckPos: propBlackCheckPos,
    checkAttackLines = [],
    checkSealEffect = null,
    illegalCheckCamp = null,
    terminalOutcome = null,
    terminalDismissed = false,
    onDismissTerminal,
    onRestoreTerminal,
    onTerminalPrimaryAction,
    terminalPrimaryLabel = '复盘分析',
    onTerminalRestartAction,
    terminalRestartLabel = '重开一局',
    boardTheme,
    craftStyle,
    fontScheme,
    useTraditionalChar,
    flipped,
    workspace,
    isVariationActive = false,
    onSelectIntersection,
  }) => {
    const themeColors = THEME_PALETTES[boardTheme];

    const boardGrid = useMemo(() => buildBoardGrid(pieces), [pieces]);

    const legalTargetSet = useMemo(() => {
      const set = new Set<number>();
      for (let i = 0; i < legalMoves.length; i++) {
        set.add(legalMoves[i].row * 9 + legalMoves[i].col);
      }
      return set;
    }, [legalMoves]);

    const { redCheckPos, blackCheckPos } = useMemo(() => {
      if (propRedCheckPos !== undefined || propBlackCheckPos !== undefined) {
        return {
          redCheckPos: propRedCheckPos ?? null,
          blackCheckPos: propBlackCheckPos ?? null,
        };
      }
      return {
        redCheckPos: isCampInCheck(pieces, 'red', boardGrid),
        blackCheckPos: isCampInCheck(pieces, 'black', boardGrid),
      };
    }, [propRedCheckPos, propBlackCheckPos, pieces, boardGrid]);

    const anyCheckPos = redCheckPos || blackCheckPos;

    const modeRimClass = isVariationActive
      ? 'ring-2 ring-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.28)]'
      : workspace === 'challenge'
      ? 'ring-1 ring-[#C8372D]/60'
      : workspace === 'setup'
      ? 'ring-2 ring-[#C87D3B]'
      : '';

    return (
      <div className="relative flex items-center justify-center gap-3 select-none">
        {/* 棋盘主体容器：随视口高度自适应缩放，确保与上下棋手栏、操控栏在一屏内完整容纳不产生滚动条 */}
        <div className="relative w-[clamp(280px,calc((100vh-226px)*0.86),590px)] transition-all">
          <div
            className={`relative rounded-xl p-2 sm:p-2.5 border-2 transition-all duration-200 ${themeColors.frameClass} ${modeRimClass}`}
          >
            {/* 四个传统黄铜回纹包角 */}
            <span className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#D4AF37]/50 pointer-events-none" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#D4AF37]/50 pointer-events-none" />
            <span className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#D4AF37]/50 pointer-events-none" />
            <span className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#D4AF37]/50 pointer-events-none" />

            {/* 终局或将军角标（绝杀收起后可点按再现） */}
            {terminalOutcome ? (
              <button
                type="button"
                onClick={onRestoreTerminal}
                title="点击查看终局结果卡片"
                className="absolute top-3 right-4 z-40 px-2.5 py-0.5 rounded bg-[#9E2A2B] text-[#FAF5EB] text-xs font-serif-sc font-bold tracking-widest shadow-lg border border-[#D4AF37]/75 cursor-pointer hover:bg-[#B83227] transition-colors"
              >
                {terminalOutcome.kind === 'checkmate' ? '絕殺' : '困斃'} ·{' '}
                {terminalOutcome.winner === 'red' ? '紅勝' : '黑勝'}
              </button>
            ) : (
              anyCheckPos && (
                <div className="absolute top-3 right-4 z-40 px-2.5 py-0.5 rounded bg-[#C8372D] text-[#FAF5EB] text-xs font-serif-sc font-bold tracking-widest shadow-lg border border-[#D4AF37]/60 pointer-events-none">
                  將軍
                </div>
              )
            )}

            {/* 内联推演支线激活提示角标 */}
            {isVariationActive && (
              <div className="absolute top-3 left-4 z-40 px-2 py-0.5 rounded bg-[#D4AF37] text-[#18120E] text-[11px] font-semibold shadow pointer-events-none">
                推演分支中
              </div>
            )}

            {/* 内部盘面画布 (宽高比 9:10) */}
            <div className="relative w-full aspect-[9/10] rounded-lg overflow-hidden shadow-inner">
              <StaticBoardSurface boardTheme={boardTheme} flipped={flipped} />

              <DynamicArrowLayer
                flipped={flipped}
                lastMove={lastMove}
                checkAttackLines={checkAttackLines}
                multiPvArrows={multiPvArrows}
                secondaryPvArrow={secondaryPvArrow}
                threatArrow={threatArrow}
                hoveredArrow={hoveredArrow}
                hintArrow={hintArrow}
              />

              {/* 将军瞬态书法朱印（全穿透点击，不遮挡落子） */}
              {checkSealEffect && !terminalOutcome && (
                <div
                  key={`check-seal-${checkSealEffect.id}`}
                  aria-hidden="true"
                  className="absolute top-[15%] left-1/2 -translate-x-1/2 z-40 pointer-events-none"
                >
                  <div className="animate-check-seal px-5 py-2 rounded-lg border-2 border-[#D4AF37]/80 bg-[#8F1D19]/92 shadow-[0_12px_28px_rgba(0,0,0,0.65)] flex flex-col items-center gap-0.5">
                    <span className="font-calligraphy text-3xl sm:text-4xl leading-none tracking-[0.22em] text-[#FAF5EB] drop-shadow">
                      將軍
                    </span>
                    <span className="text-[10px] font-serif-sc tracking-widest text-[#F5D68A]">
                      {checkSealEffect.camp === 'red' ? '紅帥受將 · 須應將' : '黑將受將 · 須應將'}
                    </span>
                  </div>
                </div>
              )}

              {/* 将死 / 绝杀 / 困毙 终局印章（支持自由收起查看棋盘与一键复盘/重开） */}
              {terminalOutcome && !terminalDismissed && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[min(86%,312px)] pointer-events-auto">
                  <div className="animate-endgame-seal relative rounded-xl border-2 border-[#D4AF37]/80 bg-[#17110F]/94 px-5 py-4 text-center shadow-[0_22px_50px_rgba(0,0,0,0.82)]">
                    {onDismissTerminal && (
                      <button
                        type="button"
                        onClick={onDismissTerminal}
                        title="收起印章继续查看棋盘"
                        className="absolute top-2.5 right-2.5 p-1 rounded-md text-[#C5A880] hover:text-[#FAF5EB] hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="inline-flex items-center justify-center px-3 py-0.5 rounded border border-[#D4AF37]/50 bg-[#9E2A2B]/90 font-calligraphy text-2xl tracking-[0.25em] text-[#FAF5EB] mb-2">
                      {terminalOutcome.kind === 'checkmate' ? '絕殺' : '困斃'}
                    </div>

                    <div className="text-base font-serif-sc font-bold text-[#FAF5EB]">
                      {terminalOutcome.winner === 'red' ? '红方获胜' : '黑方获胜'}
                    </div>
                    <p className="mt-1 text-xs text-[#C5A880]">
                      {terminalOutcome.kind === 'checkmate'
                        ? `${terminalOutcome.loser === 'red' ? '红帅' : '黑将'}已无着可应，棋局告终`
                        : `${terminalOutcome.loser === 'red' ? '红方' : '黑方'}无子可动，按象棋规例判负`}
                    </p>

                    <div className="mt-3.5 flex items-center justify-center gap-2">
                      {onTerminalPrimaryAction && (
                        <button
                          type="button"
                          onClick={onTerminalPrimaryAction}
                          className="px-3 py-1.5 rounded-md xq-btn-primary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>{terminalPrimaryLabel}</span>
                        </button>
                      )}
                      {onTerminalRestartAction && (
                        <button
                          type="button"
                          onClick={onTerminalRestartAction}
                          className="px-3 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5 opacity-80" />
                          <span>{terminalRestartLabel}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 第三层：90 个记忆化交叉点与立体棋子 */}
              <div className="absolute inset-0">
                {Array.from({ length: 10 }).map((_, row) =>
                  Array.from({ length: 9 }).map((__, col) => {
                    const vRow = flipped ? 9 - row : row;
                    const vCol = flipped ? 8 - col : col;
                    const leftPct = ((OFFSET_X + vCol * STEP) / 900) * 100;
                    const topPct = ((OFFSET_Y + vRow * STEP) / 1000) * 100;

                    const idx = row * 9 + col;
                    const piece = boardGrid[idx];
                    const isSelected = piece ? piece.id === selectedPieceId : false;
                    const isLegalTarget = legalTargetSet.has(idx);
                    const isLastMoveDest =
                      lastMove?.to.row === row && lastMove?.to.col === col;
                    const isImpactHere =
                      impactEffect !== null &&
                      impactEffect.row === row &&
                      impactEffect.col === col;
                    const isPieceInCheck =
                      piece !== null &&
                      piece.type === 'general' &&
                      ((piece.camp === 'red' && redCheckPos !== null) ||
                        (piece.camp === 'black' && blackCheckPos !== null));
                    const isAlertShaking =
                      piece !== null &&
                      piece.type === 'general' &&
                      illegalCheckCamp === piece.camp;

                    return (
                      <IntersectionCell
                        key={`intersection-${row}-${col}`}
                        row={row}
                        col={col}
                        leftPct={leftPct}
                        topPct={topPct}
                        piece={piece}
                        isSelected={isSelected}
                        isLegalTarget={isLegalTarget}
                        isLastMoveDest={isLastMoveDest}
                        impactCamp={isImpactHere ? impactEffect.camp : null}
                        impactIsCapture={isImpactHere ? impactEffect.isCapture : false}
                        impactId={isImpactHere ? impactEffect.id : null}
                        isPieceInCheck={isPieceInCheck}
                        isAlertShaking={isAlertShaking}
                        craftStyle={craftStyle}
                        fontScheme={fontScheme}
                        useTraditionalChar={useTraditionalChar}
                        onSelectIntersection={onSelectIntersection}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
