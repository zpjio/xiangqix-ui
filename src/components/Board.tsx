import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightCircle, RotateCcw, Scale, X } from 'lucide-react';
import {
  AppTheme,
  BoardAnnotationColor,
  BoardTheme,
  BoardUserArrow,
  BoardUserCircle,
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
  PieceType,
  Position,
  WorkspaceMode,
} from '../types/xiangqi';
import {
  BLACK_ROAD_NUMERALS,
  RED_ROAD_NUMERALS,
  buildBoardGrid,
  isCampInCheck,
  isSetupPiecePlacementAllowed,
} from '../utils/xiangqiRules';
import { XiangqiPiece } from './XiangqiPiece';

interface BoardProps {
  pieces: Piece[];
  turn?: Camp;
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
  drawClaimPrompt?: {
    kind: '60moves' | 'repetition' | 'insufficient' | 'perpetual-check';
    label: string;
    detail: string;
    isViolationAlert?: boolean;
  } | null;
  onAcceptDrawClaim?: () => void;
  onDismissDrawClaim?: () => void;
  onStepBackFromViolation?: () => void;
  boardTheme: BoardTheme;
  appTheme?: AppTheme;
  craftStyle: PieceCraftStyle;
  fontScheme: FontScheme;
  useTraditionalChar: boolean;
  showCoordinates?: boolean;
  flipped: boolean;
  workspace: WorkspaceMode;
  setupTemplate?: { camp: Camp; type: PieceType } | null;
  isVariationActive?: boolean;
  isBotThinking?: boolean;
  annotationResetKey?: string | number;
  clearAnnotationsNonce?: number;
  onUserAnnotationsChange?: (hasAnnotations: boolean) => void;
  onSelectIntersection: (row: number, col: number) => void;
  onEnsureSelectedPiece?: (pieceId: string) => void;
  onDropMove?: (from: Position, to: Position) => void;
}

const STEP = 95;
const OFFSET_X = 70;
const OFFSET_Y = 72;
// 棋盘交叉格占宽比 (STEP / 900) 与单元格宽比 (9.4%) 之比，用于 FLIP 合成器平移动画
const CELL_STEP_PCT = (STEP / (900 * 0.094)) * 100;

const USER_ANNOTATION_HEX: Record<BoardAnnotationColor, string> = {
  gold: '#E0B048',
  jade: '#2B9B74',
  crimson: '#D9483B',
  azure: '#5B8FD9',
};

function getTerminalCopy(outcome: GameTerminalState) {
  switch (outcome.kind) {
    case 'checkmate':
      return {
        seal: '絕殺',
        badge: `絕殺 · ${outcome.winner === 'red' ? '紅勝' : '黑勝'}`,
        title: outcome.winner === 'red' ? '红方获胜' : '黑方获胜',
        desc:
          outcome.reasonText ||
          `${outcome.loser === 'red' ? '红帅' : '黑将'}已无着可应，棋局告终`,
      };
    case 'stalemate':
      return {
        seal: '困斃',
        badge: `困斃 · ${outcome.winner === 'red' ? '紅勝' : '黑勝'}`,
        title: outcome.winner === 'red' ? '红方获胜' : '黑方获胜',
        desc:
          outcome.reasonText ||
          `${outcome.loser === 'red' ? '红方' : '黑方'}无子可动，按象棋规例判负`,
      };
    case 'draw-60moves':
      return {
        seal: '限著和',
        badge: '限著 · 和棋',
        title: '双方和棋',
        desc: outcome.reasonText || '连续 60 回合无吃子，按自然限着裁定和棋',
      };
    case 'draw-repetition':
      return {
        seal: '重複和',
        badge: '重複 · 和棋',
        title: '双方和棋',
        desc: outcome.reasonText || '同一局面第三次重复出现，按棋规判和',
      };
    case 'draw-agreement':
      return {
        seal: '協議和',
        badge: '議和 · 和棋',
        title: '双方和棋',
        desc: outcome.reasonText || '双方协议达成和棋',
      };
    case 'draw-insufficient':
      return {
        seal: '死和',
        badge: '死和 · 和棋',
        title: '双方和棋',
        desc: outcome.reasonText || '双方均无有效进攻子力，按死和判和',
      };
    case 'perpetual-check':
      return {
        seal: '長將負',
        badge: `長將 · ${outcome.winner === 'red' ? '紅勝' : '黑勝'}`,
        title: outcome.winner === 'red' ? '红方获胜' : '黑方获胜',
        desc:
          outcome.reasonText ||
          `${outcome.loser === 'red' ? '红方' : '黑方'}单方连续长将违例不变，判对方获胜`,
      };
    case 'resign':
      return {
        seal: '認輸',
        badge: `認輸 · ${outcome.winner === 'red' ? '紅勝' : '黑勝'}`,
        title: outcome.winner === 'red' ? '红方获胜' : '黑方获胜',
        desc:
          outcome.reasonText ||
          `${outcome.loser === 'red' ? '红方' : '黑方'}主动认输，棋局结束`,
      };
    case 'timeout':
      return {
        seal: '超時',
        badge: `超時 · ${outcome.winner === 'red' ? '紅勝' : '黑勝'}`,
        title: outcome.winner === 'red' ? '红方获胜' : '黑方获胜',
        desc:
          outcome.reasonText ||
          `${outcome.loser === 'red' ? '红方' : '黑方'}棋钟超时，判对方获胜`,
      };
  }
}

interface BoardSurfacePalette {
  surfaceStart: string;
  surfaceMid: string;
  surfaceEnd: string;
  inkLine: string;
  riverText: string;
  sealRed: string;
  frameClass: string;
}

function getBoardSurfacePalette(
  boardTheme: BoardTheme,
  appTheme: AppTheme
): BoardSurfacePalette {
  if (boardTheme === 'xuan-rosewood') {
    if (appTheme === 'eyecare') {
      return {
        surfaceStart: '#D2BA91',
        surfaceMid: '#C8AF84',
        surfaceEnd: '#B89C6D',
        inkLine: '#2D2821',
        riverText: '#3A3126',
        sealRed: '#962B28',
        frameClass: 'zitan-board-frame border-[#614737]',
      };
    }
    if (appTheme === 'dark') {
      return {
        surfaceStart: '#D2BA91',
        surfaceMid: '#C6AB7D',
        surfaceEnd: '#B49565',
        inkLine: '#28201B',
        riverText: '#372920',
        sealRed: '#962B28',
        frameClass: 'zitan-board-frame border-[#543828]',
      };
    }
    return {
      surfaceStart: '#DEC8A1',
      surfaceMid: '#D3B88B',
      surfaceEnd: '#C2A271',
      inkLine: '#2B221C',
      riverText: '#3A2B21',
      sealRed: '#962B28',
      frameClass: 'zitan-board-frame border-[#5B3E2D]',
    };
  }

  if (boardTheme === 'imperial-lacquer') {
    if (appTheme === 'eyecare' || appTheme === 'light') {
      return {
        surfaceStart: '#2A1D19',
        surfaceMid: '#211613',
        surfaceEnd: '#19100E',
        inkLine: '#C6A358',
        riverText: '#CFA952',
        sealRed: '#A3332C',
        frameClass:
          'bg-[#1D1310] border-[#6B5129] shadow-[var(--xq-frame-shadow)]',
      };
    }
    return {
      surfaceStart: '#231715',
      surfaceMid: '#1B110F',
      surfaceEnd: '#140C0B',
      inkLine: '#C49F52',
      riverText: '#CFA952',
      sealRed: '#A8332B',
      frameClass:
        'bg-[#160E0C] border-[#664C24] shadow-[var(--xq-frame-shadow)]',
    };
  }

  // 'song-celadon'
  if (appTheme === 'eyecare') {
    return {
      surfaceStart: '#C9CEBE',
      surfaceMid: '#BCC3B1',
      surfaceEnd: '#AAB39E',
      inkLine: '#2A3126',
      riverText: '#313B2C',
      sealRed: '#962B28',
      frameClass:
        'bg-[#293129] border-[#526052] shadow-[var(--xq-frame-shadow)]',
    };
  }
  if (appTheme === 'dark') {
    return {
      surfaceStart: '#C2CDC3',
      surfaceMid: '#B4C1B5',
      surfaceEnd: '#A1B0A3',
      inkLine: '#243028',
      riverText: '#2C3B31',
      sealRed: '#962B28',
      frameClass:
        'bg-[#1E2621] border-[#425247] shadow-[var(--xq-frame-shadow)]',
    };
  }
  return {
    surfaceStart: '#CFD8CF',
    surfaceMid: '#C2CEC3',
    surfaceEnd: '#B0BEB2',
    inkLine: '#243028',
    riverText: '#2C3B31',
    sealRed: '#962B28',
    frameClass:
      'bg-[#242D27] border-[#4B5C50] shadow-[var(--xq-frame-shadow)]',
  };
}

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

const ImpactDustBurst: React.FC<{ camp: Camp; isCapture: boolean; effectId: number }> = React.memo(({
  camp,
  isCapture,
  effectId,
}) => {
  const particles = useMemo(() => {
    const count = isCapture ? 16 : 10;
    return Array.from({ length: count }).map((_, idx) => {
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
  }, [effectId, isCapture, camp]);

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
});

/* ==================== 第 1 层：静态盘面纹理与网格 SVG（独立缓存，隔离 feTurbulence 重栅格化） ==================== */
const StaticBoardSurface: React.FC<{
  boardTheme: BoardTheme;
  appTheme: AppTheme;
  flipped: boolean;
  showCoordinates: boolean;
}> = React.memo(({ boardTheme, appTheme, flipped, showCoordinates }) => {
  const themeColors = getBoardSurfacePalette(boardTheme, appTheme);
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

        {/* 盘内顶部与底部路数坐标（可在设置中心开关） */}
        {showCoordinates && (
          <g className="font-serif-sc text-[22px] font-bold select-none" opacity="0.78">
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
        )}

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
  userArrows: BoardUserArrow[];
  userCircles: BoardUserCircle[];
  previewUserArrow: { from: Position; to: Position; color: BoardAnnotationColor } | null;
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
    userArrows,
    userCircles,
    previewUserArrow,
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
              fill="#F4EFE2"
              className="font-mono-tabular text-[13px] font-semibold"
            >
              {arrow.scoreText}
            </text>
          </g>
        </g>
      );
    };

    const renderUserArrow = (
      from: Position,
      to: Position,
      color: BoardAnnotationColor,
      key: string,
      isPreview = false
    ) => {
      if (from.row === to.row && from.col === to.col) return null;
      const vf = toVisualCoord(from.row, from.col);
      const vt = toVisualCoord(to.row, to.col);
      const x1 = OFFSET_X + vf.vCol * STEP;
      const y1 = OFFSET_Y + vf.vRow * STEP;
      const x2 = OFFSET_X + vt.vCol * STEP;
      const y2 = OFFSET_Y + vt.vRow * STEP;
      return (
        <line
          key={key}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={USER_ANNOTATION_HEX[color]}
          strokeWidth="11"
          strokeLinecap="round"
          strokeOpacity={isPreview ? '0.52' : '0.84'}
          strokeDasharray={isPreview ? '10 6' : undefined}
          markerEnd={`url(#user-arrow-${color})`}
          className="pointer-events-none"
        />
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
            <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="var(--xq-accent-jade)" fillOpacity="0.92" />
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
            <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#C93A2E" fillOpacity="0.92" />
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
            <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#CFA952" fillOpacity="0.92" />
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
            <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="var(--xq-accent-azure)" fillOpacity="0.92" />
          </marker>
          {(['gold', 'jade', 'crimson', 'azure'] as BoardAnnotationColor[]).map((c) => (
            <marker
              key={c}
              id={`user-arrow-${c}`}
              viewBox="0 0 10 10"
              refX="6.5"
              refY="5"
              markerWidth="4.6"
              markerHeight="4.6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.2 L 8.8 5 L 0 8.8 z" fill={USER_ANNOTATION_HEX[c]} fillOpacity="0.92" />
            </marker>
          ))}
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
            arrow.rank === 1 ? 'var(--xq-accent-jade)' : '#B87D1E',
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
            'var(--xq-accent-azure)',
            'arrow-compare-secondary',
            false,
            '11.5',
            0.64
          )}

        {/* 对手威胁雷达箭头 */}
        {threatArrow &&
          renderSvgArrow(threatArrow, 'threat-arrow', '#C93A2E', 'arrow-threat', true, '10')}

        {/* 锦囊提示箭头 */}
        {hintArrow &&
          renderSvgArrow(hintArrow, 'hint-arrow', '#CFA952', 'arrow-ghost', false, '14')}

        {/* 悬停幽灵预览箭头 */}
        {hoveredArrow &&
          renderSvgArrow(hoveredArrow, 'hovered-arrow', '#CFA952', 'arrow-ghost', false, '14')}

        {/* 右键手绘交点标注圆环 */}
        {userCircles.map((circle) => {
          const vc = toVisualCoord(circle.pos.row, circle.pos.col);
          const cx = OFFSET_X + vc.vCol * STEP;
          const cy = OFFSET_Y + vc.vRow * STEP;
          return (
            <circle
              key={circle.id}
              cx={cx}
              cy={cy}
              r="43"
              fill="none"
              stroke={USER_ANNOTATION_HEX[circle.color]}
              strokeWidth="4.5"
              strokeOpacity="0.88"
              className="pointer-events-none"
            />
          );
        })}

        {/* 右键手绘战术箭头与拖动预览 */}
        {userArrows.map((ua) => renderUserArrow(ua.from, ua.to, ua.color, ua.id, false))}
        {previewUserArrow &&
          renderUserArrow(
            previewUserArrow.from,
            previewUserArrow.to,
            previewUserArrow.color,
            'user-arrow-preview',
            true
          )}
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
  isDragTargetHover: boolean;
  isBeingDragged: boolean;
  isDraggablePiece: boolean;
  glideOffset?: { dxPct: number; dyPct: number };
  glideSettling?: boolean;
  isLastMoveDest: boolean;
  impactCamp: Camp | null;
  impactIsCapture: boolean;
  impactId: number | null;
  isPieceInCheck: boolean;
  isAlertShaking: boolean;
  setupValidEmpty?: boolean;
  setupInvalidEmpty?: boolean;
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
    isDragTargetHover,
    isBeingDragged,
    isDraggablePiece,
    glideOffset,
    glideSettling = false,
    isLastMoveDest,
    impactCamp,
    impactIsCapture,
    impactId,
    isPieceInCheck,
    isAlertShaking,
    setupValidEmpty = false,
    setupInvalidEmpty = false,
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
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center ${
          glideOffset ? 'z-30' : ''
        }`}
      >
        {impactId !== null && impactCamp && (
          <ImpactDustBurst
            camp={impactCamp}
            isCapture={impactIsCapture}
            effectId={impactId}
          />
        )}

        {isDragTargetHover && (
          <span
            aria-hidden="true"
            className="absolute -inset-1.5 rounded-full border-2 border-[#CFA952] bg-[#CFA952]/18 shadow-[0_0_12px_rgba(207,169,82,0.55)] pointer-events-none z-20"
          />
        )}

        {!piece && (
          <button
            type="button"
            onClick={() => onSelectIntersection(row, col)}
            aria-label={`交叉点 第${row + 1}横 第${col + 1}路`}
            className={`w-full h-full rounded-full flex items-center justify-center group focus:outline-none ${
              setupInvalidEmpty ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {isLegalTarget ? (
              <span className="relative flex items-center justify-center w-5 h-5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#3A684F] border border-[#CFA952] shadow-[0_0_6px_rgba(58,104,79,0.68)] transition-transform group-hover:scale-125" />
              </span>
            ) : setupValidEmpty ? (
              <span className="w-3 h-3 rounded-full bg-[#2B9B74]/35 border border-[#2B9B74]/75 transition-transform group-hover:scale-125" />
            ) : setupInvalidEmpty ? (
              <span className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-[#C8372D]/35 transition-colors" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[#962B28]/25 transition-colors" />
            )}
          </button>
        )}

        {piece && (
          <div
            style={
              glideOffset
                ? {
                    transform: glideSettling
                      ? 'translate3d(0, 0, 0)'
                      : `translate3d(${glideOffset.dxPct}%, ${glideOffset.dyPct}%, 0)`,
                    transition: glideSettling
                      ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'none',
                    willChange: 'transform',
                  }
                : undefined
            }
            className={`relative w-full h-full flex items-center justify-center ${
              isBeingDragged ? 'opacity-25' : ''
            } ${isDraggablePiece ? 'touch-none' : ''}`}
          >
            <div
              key={impactId !== null && !glideOffset ? `piece-land-${impactId}` : piece.id}
              className={`relative w-full h-full flex items-center justify-center ${
                impactId !== null && !glideOffset ? 'animate-piece-land' : ''
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
          </div>
        )}
      </div>
    );
  }
);

export const Board: React.FC<BoardProps> = React.memo(
  ({
    pieces,
    turn,
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
    drawClaimPrompt = null,
    onAcceptDrawClaim,
    onDismissDrawClaim,
    onStepBackFromViolation,
    boardTheme,
    appTheme = 'dark',
    craftStyle,
    fontScheme,
    useTraditionalChar,
    showCoordinates = true,
    flipped,
    workspace,
    setupTemplate = null,
    isVariationActive = false,
    isBotThinking = false,
    annotationResetKey,
    clearAnnotationsNonce = 0,
    onUserAnnotationsChange,
    onSelectIntersection,
    onEnsureSelectedPiece,
    onDropMove,
  }) => {
    const themeColors = getBoardSurfacePalette(boardTheme, appTheme);
    const canvasRef = useRef<HTMLDivElement | null>(null);

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
    const terminalCopy = terminalOutcome ? getTerminalCopy(terminalOutcome) : null;

    // ==================== FLIP 平滑滑移状态 ====================
    const prevPositionsRef = useRef<Map<string, Position>>(new Map());
    const prevFlippedRef = useRef<boolean>(flipped);
    const justDraggedRef = useRef<{ id: string; at: number } | null>(null);
    const [glideOffsets, setGlideOffsets] = useState<
      Record<string, { dxPct: number; dyPct: number }>
    >({});
    const [glideSettling, setGlideSettling] = useState(false);

    useLayoutEffect(() => {
      const nextMap = new Map<string, Position>();
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        nextMap.set(p.id, { row: p.row, col: p.col });
      }

      const flippedChanged = prevFlippedRef.current !== flipped;
      const hadPrev = prevPositionsRef.current.size > 0;
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const computed: Record<string, { dxPct: number; dyPct: number }> = {};

      if (hadPrev && !flippedChanged && !reducedMotion) {
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i];
          const prev = prevPositionsRef.current.get(p.id);
          if (!prev || (prev.row === p.row && prev.col === p.col)) continue;
          if (
            justDraggedRef.current &&
            justDraggedRef.current.id === p.id &&
            Date.now() - justDraggedRef.current.at < 320
          ) {
            continue;
          }
          const vPrevRow = flipped ? 9 - prev.row : prev.row;
          const vPrevCol = flipped ? 8 - prev.col : prev.col;
          const vCurrRow = flipped ? 9 - p.row : p.row;
          const vCurrCol = flipped ? 8 - p.col : p.col;
          computed[p.id] = {
            dxPct: (vPrevCol - vCurrCol) * CELL_STEP_PCT,
            dyPct: (vPrevRow - vCurrRow) * CELL_STEP_PCT,
          };
        }
      }

      prevPositionsRef.current = nextMap;
      prevFlippedRef.current = flipped;

      if (Object.keys(computed).length === 0) {
        setGlideOffsets({});
        setGlideSettling(false);
        return;
      }

      setGlideOffsets(computed);
      setGlideSettling(false);

      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setGlideSettling(true);
        });
      });
      const clearTimer = window.setTimeout(() => {
        setGlideOffsets({});
        setGlideSettling(false);
      }, 210);

      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
        window.clearTimeout(clearTimer);
      };
    }, [pieces, flipped]);

    // ==================== 右键战术标注（箭头 & 圆环） ====================
    const [userArrows, setUserArrows] = useState<BoardUserArrow[]>([]);
    const [userCircles, setUserCircles] = useState<BoardUserCircle[]>([]);
    const [previewUserArrow, setPreviewUserArrow] = useState<{
      from: Position;
      to: Position;
      color: BoardAnnotationColor;
    } | null>(null);

    useEffect(() => {
      setUserArrows([]);
      setUserCircles([]);
      setPreviewUserArrow(null);
    }, [annotationResetKey, clearAnnotationsNonce]);

    const clearUserAnnotations = useCallback(() => {
      setUserArrows([]);
      setUserCircles([]);
      setPreviewUserArrow(null);
    }, []);

    // ==================== 拖拽走子 & 右键绘制 Pointer 状态机 ====================
    const canDragPieces =
      workspace !== 'setup' && !terminalOutcome && !isBotThinking && !!turn;

    const dragCandidateRef = useRef<{
      pointerId: number;
      piece: Piece;
      startX: number;
      startY: number;
      active: boolean;
    } | null>(null);

    const rightDrawRef = useRef<{
      pointerId: number;
      startRow: number;
      startCol: number;
      color: BoardAnnotationColor;
    } | null>(null);

    const suppressNextClickRef = useRef(false);
    const [dragVisual, setDragVisual] = useState<{
      piece: Piece;
      xPct: number;
      yPct: number;
      hoverRow: number;
      hoverCol: number;
    } | null>(null);

    const getBoardCoordsFromClient = useCallback(
      (clientX: number, clientY: number) => {
        const el = canvasRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const relX = (clientX - rect.left) / rect.width;
        const relY = (clientY - rect.top) / rect.height;
        const xNorm = relX * 900;
        const yNorm = relY * 1000;
        const vCol = Math.max(0, Math.min(8, Math.round((xNorm - OFFSET_X) / STEP)));
        const vRow = Math.max(0, Math.min(9, Math.round((yNorm - OFFSET_Y) / STEP)));
        const row = flipped ? 9 - vRow : vRow;
        const col = flipped ? 8 - vCol : vCol;
        return {
          row,
          col,
          xPct: Math.max(0, Math.min(100, relX * 100)),
          yPct: Math.max(0, Math.min(100, relY * 100)),
        };
      },
      [flipped]
    );

    const handleCanvasPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const coords = getBoardCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;

        if (e.button === 2) {
          e.preventDefault();
          const color: BoardAnnotationColor =
            e.altKey && e.shiftKey
              ? 'azure'
              : e.altKey
              ? 'jade'
              : e.shiftKey
              ? 'crimson'
              : 'gold';
          rightDrawRef.current = {
            pointerId: e.pointerId,
            startRow: coords.row,
            startCol: coords.col,
            color,
          };
          setPreviewUserArrow({
            from: { row: coords.row, col: coords.col },
            to: { row: coords.row, col: coords.col },
            color,
          });
          try {
            canvasRef.current?.setPointerCapture(e.pointerId);
          } catch {
            // Ignore pointer capture restriction
          }
          return;
        }

        if (e.button === 0 && canDragPieces) {
          const piece = boardGrid[coords.row * 9 + coords.col];
          if (piece && piece.camp === turn) {
            dragCandidateRef.current = {
              pointerId: e.pointerId,
              piece,
              startX: e.clientX,
              startY: e.clientY,
              active: false,
            };
          }
        }
      },
      [getBoardCoordsFromClient, canDragPieces, boardGrid, turn]
    );

    const handleCanvasPointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (rightDrawRef.current && rightDrawRef.current.pointerId === e.pointerId) {
          const coords = getBoardCoordsFromClient(e.clientX, e.clientY);
          if (coords) {
            const { startRow, startCol, color } = rightDrawRef.current;
            setPreviewUserArrow((prev) =>
              prev && prev.to.row === coords.row && prev.to.col === coords.col
                ? prev
                : {
                    from: { row: startRow, col: startCol },
                    to: { row: coords.row, col: coords.col },
                    color,
                  }
            );
          }
          return;
        }

        const cand = dragCandidateRef.current;
        if (cand && cand.pointerId === e.pointerId) {
          if (!cand.active) {
            const dist = Math.hypot(e.clientX - cand.startX, e.clientY - cand.startY);
            if (dist < 6) return;
            cand.active = true;
            try {
              canvasRef.current?.setPointerCapture(e.pointerId);
            } catch {
              // Ignore pointer capture restriction
            }
            onEnsureSelectedPiece?.(cand.piece.id);
          }
          const coords = getBoardCoordsFromClient(e.clientX, e.clientY);
          if (coords) {
            setDragVisual({
              piece: cand.piece,
              xPct: coords.xPct,
              yPct: coords.yPct,
              hoverRow: coords.row,
              hoverCol: coords.col,
            });
          }
        }
      },
      [getBoardCoordsFromClient, onEnsureSelectedPiece]
    );

    const handleCanvasPointerEnd = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (rightDrawRef.current && rightDrawRef.current.pointerId === e.pointerId) {
          const { startRow, startCol, color } = rightDrawRef.current;
          rightDrawRef.current = null;
          setPreviewUserArrow(null);
          try {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
          } catch {
            // Ignore release error
          }

          if (e.type === 'pointerup') {
            const coords = getBoardCoordsFromClient(e.clientX, e.clientY);
            if (coords) {
              if (coords.row === startRow && coords.col === startCol) {
                setUserCircles((prev) => {
                  const idx = prev.findIndex(
                    (c) => c.pos.row === startRow && c.pos.col === startCol
                  );
                  if (idx >= 0) {
                    if (prev[idx].color === color) {
                      return prev.filter((_, i) => i !== idx);
                    }
                    return prev.map((c, i) => (i === idx ? { ...c, color } : c));
                  }
                  return [
                    ...prev,
                    {
                      id: `uc-${startRow}-${startCol}-${Date.now()}`,
                      pos: { row: startRow, col: startCol },
                      color,
                    },
                  ];
                });
              } else {
                setUserArrows((prev) => {
                  const idx = prev.findIndex(
                    (a) =>
                      a.from.row === startRow &&
                      a.from.col === startCol &&
                      a.to.row === coords.row &&
                      a.to.col === coords.col
                  );
                  if (idx >= 0) {
                    if (prev[idx].color === color) {
                      return prev.filter((_, i) => i !== idx);
                    }
                    return prev.map((a, i) => (i === idx ? { ...a, color } : a));
                  }
                  return [
                    ...prev,
                    {
                      id: `ua-${startRow}-${startCol}-${coords.row}-${coords.col}-${Date.now()}`,
                      from: { row: startRow, col: startCol },
                      to: { row: coords.row, col: coords.col },
                      color,
                    },
                  ];
                });
              }
            }
          }
          return;
        }

        const cand = dragCandidateRef.current;
        if (cand && cand.pointerId === e.pointerId) {
          const wasActive = cand.active;
          const dragPiece = cand.piece;
          dragCandidateRef.current = null;
          setDragVisual(null);
          try {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
          } catch {
            // Ignore release error
          }

          if (wasActive) {
            suppressNextClickRef.current = true;
            window.setTimeout(() => {
              suppressNextClickRef.current = false;
            }, 60);

            if (e.type === 'pointerup') {
              const coords = getBoardCoordsFromClient(e.clientX, e.clientY);
              if (
                coords &&
                (coords.row !== dragPiece.row || coords.col !== dragPiece.col)
              ) {
                justDraggedRef.current = { id: dragPiece.id, at: Date.now() };
                onDropMove?.(
                  { row: dragPiece.row, col: dragPiece.col },
                  { row: coords.row, col: coords.col }
                );
              }
            }
          }
        }
      },
      [getBoardCoordsFromClient, onDropMove]
    );

    const handleIntersectionSelectWrapped = useCallback(
      (row: number, col: number) => {
        if (suppressNextClickRef.current) return;
        const targetPiece = boardGrid[row * 9 + col];
        if (
          !targetPiece &&
          !legalTargetSet.has(row * 9 + col) &&
          (userArrows.length > 0 || userCircles.length > 0)
        ) {
          clearUserAnnotations();
        }
        onSelectIntersection(row, col);
      },
      [
        boardGrid,
        legalTargetSet,
        userArrows.length,
        userCircles.length,
        clearUserAnnotations,
        onSelectIntersection,
      ]
    );

    const modeRimClass = isVariationActive
      ? 'ring-2 ring-[#CFA952] shadow-[0_0_18px_rgba(207,169,82,0.22)]'
      : workspace === 'challenge'
      ? 'ring-1 ring-[#B83A32]/50'
      : workspace === 'setup'
      ? 'ring-2 ring-[#BD7738]'
      : '';

    const verticalReserve = workspace === 'setup' ? '4.75rem' : '8.5rem';
    const horizontalReserve = workspace === 'study' ? '5.75rem' : '2.25rem';
    const hasUserAnnotations = userArrows.length > 0 || userCircles.length > 0;

    useEffect(() => {
      onUserAnnotationsChange?.(hasUserAnnotations);
    }, [hasUserAnnotations, onUserAnnotationsChange]);

    return (
      <div className="relative flex items-center justify-center gap-3 select-none">
        {/* 棋盘主体容器：基于左侧舞台尺寸容器 (cqh/cqw) 自适应放大至高宽极限并保留微距呼吸边 */}
        <div
          className="relative transition-all"
          style={{
            width: `clamp(280px, min(calc((100cqh - ${verticalReserve}) * 0.89), calc(100cqw - ${horizontalReserve})), 820px)`,
          }}
        >
          <div
            className={`relative rounded-xl p-2 sm:p-2.5 border-2 transition-all duration-200 ${themeColors.frameClass} ${modeRimClass}`}
          >
            {/* 四个传统黄铜回纹包角 */}
            <span className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#CFA952]/45 pointer-events-none" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#CFA952]/45 pointer-events-none" />
            <span className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#CFA952]/45 pointer-events-none" />
            <span className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#CFA952]/45 pointer-events-none" />

            {/* 终局或将军角标（终局印章收起后可点按再现） */}
            {terminalCopy ? (
              <button
                type="button"
                onClick={onRestoreTerminal}
                title="点击查看终局结果卡片"
                className="absolute top-3 right-4 z-40 px-2.5 py-0.5 rounded bg-[#962B28] text-[#F4EFE2] text-xs font-serif-sc font-bold tracking-widest shadow-md border border-[#CFA952]/65 cursor-pointer hover:bg-[#AA332E] transition-colors"
              >
                {terminalCopy.badge}
              </button>
            ) : (
              anyCheckPos && (
                <div className="absolute top-3 right-4 z-40 px-2.5 py-0.5 rounded bg-[#B83A32] text-[#F4EFE2] text-xs font-serif-sc font-bold tracking-widest shadow-md border border-[#CFA952]/55 pointer-events-none">
                  將軍
                </div>
              )
            )}

            {/* 内联推演支线激活提示角标 */}
            {isVariationActive && (
              <div className="absolute top-3 left-4 z-40 px-2 py-0.5 rounded bg-[#CFA952] text-[#18120E] text-xs font-semibold shadow pointer-events-none">
                推演分支中
              </div>
            )}

            {/* 内部盘面画布 (宽高比 9:10) */}
            <div
              ref={canvasRef}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerEnd}
              onPointerCancel={handleCanvasPointerEnd}
              className={`relative w-full aspect-[9/10] rounded-lg overflow-hidden shadow-inner ${
                canDragPieces ? 'touch-none' : ''
              }`}
            >
              <StaticBoardSurface
                boardTheme={boardTheme}
                appTheme={appTheme}
                flipped={flipped}
                showCoordinates={showCoordinates}
              />

              <DynamicArrowLayer
                flipped={flipped}
                lastMove={lastMove}
                checkAttackLines={checkAttackLines}
                multiPvArrows={multiPvArrows}
                secondaryPvArrow={secondaryPvArrow}
                threatArrow={threatArrow}
                hoveredArrow={hoveredArrow}
                hintArrow={hintArrow}
                userArrows={userArrows}
                userCircles={userCircles}
                previewUserArrow={previewUserArrow}
              />

              {/* 60 回合自然限着 / 三次重复 / 死和 / 单方长将违例 提示卡 */}
              {drawClaimPrompt && !terminalOutcome && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-[min(94%,25rem)] pointer-events-auto"
                >
                  <div
                    className={`rounded-lg border px-3.5 py-2.5 shadow-[0_12px_28px_rgba(12,10,8,0.62)] flex items-center justify-between gap-2.5 ${
                      drawClaimPrompt.isViolationAlert
                        ? 'border-[#C8372D]/85 bg-[#241312]/95'
                        : 'border-[#CFA952]/70 bg-[#1B1613]/94'
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold ${
                          drawClaimPrompt.isViolationAlert
                            ? 'text-[#F5B0A8]'
                            : 'text-[#EED38A]'
                        }`}
                      >
                        {drawClaimPrompt.isViolationAlert ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#E05347]" />
                        ) : (
                          <Scale className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{drawClaimPrompt.label}</span>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          drawClaimPrompt.isViolationAlert
                            ? 'text-[#D99B94]'
                            : 'text-[#C5A880]'
                        }`}
                      >
                        {drawClaimPrompt.detail}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {drawClaimPrompt.isViolationAlert ? (
                        onStepBackFromViolation && (
                          <button
                            type="button"
                            onClick={onStepBackFromViolation}
                            className="px-2.5 py-1 rounded xq-btn-primary text-xs whitespace-nowrap cursor-pointer"
                          >
                            退回变着
                          </button>
                        )
                      ) : (
                        onAcceptDrawClaim && (
                          <button
                            type="button"
                            onClick={onAcceptDrawClaim}
                            className="px-2.5 py-1 rounded xq-btn-primary text-xs whitespace-nowrap cursor-pointer"
                          >
                            判和
                          </button>
                        )
                      )}
                      {onDismissDrawClaim && (
                        <button
                          type="button"
                          onClick={onDismissDrawClaim}
                          className="px-2 py-1 rounded xq-btn-secondary text-xs whitespace-nowrap cursor-pointer"
                        >
                          {drawClaimPrompt.isViolationAlert ? '忽略' : '继续'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 将军瞬态书法朱印（全穿透点击，不遮挡落子） */}
              {checkSealEffect && !terminalOutcome && (
                <div
                  key={`check-seal-${checkSealEffect.id}`}
                  aria-hidden="true"
                  className="absolute top-[15%] left-1/2 -translate-x-1/2 z-40 pointer-events-none"
                >
                  <div className="animate-check-seal px-5 py-2 rounded-lg border-2 border-[#CFA952]/75 bg-[#8B2420]/92 shadow-[0_10px_24px_rgba(16,12,8,0.52)] flex flex-col items-center gap-0.5">
                    <span className="font-calligraphy text-3xl sm:text-4xl leading-none tracking-[0.22em] text-[#F4EFE2] drop-shadow">
                      將軍
                    </span>
                    <span className="text-xs font-serif-sc tracking-widest text-[#EED38A]">
                      {checkSealEffect.camp === 'red' ? '紅帥受將 · 須應將' : '黑將受將 · 須應將'}
                    </span>
                  </div>
                </div>
              )}

              {/* 将死 / 绝杀 / 困毙 / 限着重复和棋 / 认输 / 超时 终局印章 */}
              {terminalOutcome && terminalCopy && !terminalDismissed && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[min(90%,21rem)] pointer-events-auto"
                >
                  <div className="animate-endgame-seal relative rounded-xl border-2 border-[#CFA952]/75 bg-[#1B1613]/94 px-5 py-4 text-center shadow-[0_18px_42px_rgba(12,10,8,0.68)]">
                    {onDismissTerminal && (
                      <button
                        type="button"
                        onClick={onDismissTerminal}
                        title="收起印章继续查看棋盘"
                        className="absolute top-2.5 right-2.5 p-1 rounded-md text-[#C5A880] hover:text-[#F4EFE2] hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="inline-flex items-center justify-center px-3 py-0.5 rounded border border-[#CFA952]/50 bg-[#962B28]/90 font-calligraphy text-2xl tracking-[0.25em] text-[#F4EFE2] mb-2">
                      {terminalCopy.seal}
                    </div>

                    <div className="text-base font-serif-sc font-bold text-[#F4EFE2]">
                      {terminalCopy.title}
                    </div>
                    <p className="mt-1 text-[0.8125rem] text-[#C5A880]">{terminalCopy.desc}</p>

                    <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
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
                    const isSelected = piece
                      ? piece.id === selectedPieceId ||
                        (workspace === 'setup' &&
                          setupTemplate?.type === 'general' &&
                          piece.type === 'general' &&
                          piece.camp === setupTemplate.camp)
                      : false;
                    const isLegalTarget = legalTargetSet.has(idx);
                    const isDragTargetHover =
                      dragVisual !== null &&
                      dragVisual.hoverRow === row &&
                      dragVisual.hoverCol === col &&
                      isLegalTarget;
                    const isBeingDragged =
                      dragVisual !== null && piece !== null && dragVisual.piece.id === piece.id;
                    const isDraggablePiece =
                      canDragPieces && piece !== null && piece.camp === turn;
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
                    const isRestrictedSetupPiece =
                      workspace === 'setup' &&
                      !piece &&
                      setupTemplate !== null &&
                      (setupTemplate.type === 'general' ||
                        setupTemplate.type === 'advisor' ||
                        setupTemplate.type === 'elephant' ||
                        setupTemplate.type === 'soldier');
                    const setupAllowed = isRestrictedSetupPiece
                      ? isSetupPiecePlacementAllowed(
                          setupTemplate.camp,
                          setupTemplate.type,
                          row,
                          col
                        ).allowed
                      : true;

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
                        isDragTargetHover={isDragTargetHover}
                        isBeingDragged={isBeingDragged}
                        isDraggablePiece={isDraggablePiece}
                        glideOffset={piece ? glideOffsets[piece.id] : undefined}
                        glideSettling={glideSettling}
                        isLastMoveDest={isLastMoveDest}
                        impactCamp={isImpactHere ? impactEffect.camp : null}
                        impactIsCapture={isImpactHere ? impactEffect.isCapture : false}
                        impactId={isImpactHere ? impactEffect.id : null}
                        isPieceInCheck={isPieceInCheck}
                        isAlertShaking={isAlertShaking}
                        setupValidEmpty={isRestrictedSetupPiece && setupAllowed}
                        setupInvalidEmpty={isRestrictedSetupPiece && !setupAllowed}
                        craftStyle={craftStyle}
                        fontScheme={fontScheme}
                        useTraditionalChar={useTraditionalChar}
                        onSelectIntersection={handleIntersectionSelectWrapped}
                      />
                    );
                  })
                )}
              </div>

              {/* 第四层：拖拽中的悬浮实体棋子（跟随指针零延迟） */}
              {dragVisual && (
                <div
                  aria-hidden="true"
                  style={{
                    left: `${dragVisual.xPct}%`,
                    top: `${dragVisual.yPct}%`,
                    width: '9.4%',
                    height: '8.46%',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 scale-110 drop-shadow-[0_14px_20px_rgba(0,0,0,0.55)]"
                >
                  <XiangqiPiece
                    piece={dragVisual.piece}
                    isSelected
                    craftStyle={craftStyle}
                    fontScheme={fontScheme}
                    useTraditionalChar={useTraditionalChar}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
