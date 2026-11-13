import React from 'react';
import { Camp, FontScheme, Piece, PieceCraftStyle } from '../types/xiangqi';
import { PIECE_LABELS } from '../utils/xiangqiRules';

interface XiangqiPieceProps {
  piece: Piece;
  isSelected?: boolean;
  isLastMove?: boolean;
  isInCheck?: boolean;
  isAlertShaking?: boolean;
  craftStyle: PieceCraftStyle;
  fontScheme: FontScheme;
  useTraditionalChar: boolean;
  onClick?: () => void;
  onSelectIntersection?: (row: number, col: number) => void;
  sizeClass?: string;
}

export const XiangqiPiece: React.FC<XiangqiPieceProps> = React.memo(({
  piece,
  isSelected = false,
  isLastMove = false,
  isInCheck = false,
  isAlertShaking = false,
  craftStyle,
  fontScheme,
  useTraditionalChar,
  onClick,
  onSelectIntersection,
  sizeClass = 'w-full h-full',
}) => {
  const isRed = piece.camp === 'red';
  const labelObj = PIECE_LABELS[piece.camp][piece.type];
  const char = useTraditionalChar ? labelObj.traditional : labelObj.simplified;

  const getSurfaceClass = (camp: Camp, style: PieceCraftStyle) => {
    if (style === 'boxwood-ebony') {
      return camp === 'red' ? 'piece-token-red' : 'piece-token-black';
    }
    if (style === 'ebony-gilt') {
      return camp === 'red' ? 'piece-ebony-red' : 'piece-token-black';
    }
    return camp === 'red' ? 'piece-jade-red' : 'piece-jade-black';
  };

  const getCharClass = (camp: Camp, style: PieceCraftStyle) => {
    if (style === 'boxwood-ebony') {
      return camp === 'red' ? 'engraved-red-char' : 'engraved-gold-char';
    }
    if (style === 'ebony-gilt') {
      return camp === 'red' ? 'engraved-crimson-gold-char' : 'engraved-gold-char';
    }
    return camp === 'red' ? 'engraved-red-char' : 'engraved-ink-char';
  };

  const getRingStrokeColor = (camp: Camp, style: PieceCraftStyle) => {
    if (style === 'boxwood-ebony') {
      return camp === 'red' ? '#9E2A2B' : '#D4AF37';
    }
    if (style === 'ebony-gilt') {
      return camp === 'red' ? '#E05342' : '#D4AF37';
    }
    return camp === 'red' ? '#A62626' : '#292524';
  };

  const getFontClass = (scheme: FontScheme) => {
    if (scheme === 'calligraphy-brush') return 'font-calligraphy font-normal';
    if (scheme === 'seal-script') return 'font-cursive font-normal';
    return 'font-serif-sc font-black';
  };

  const ringColor = getRingStrokeColor(piece.camp, craftStyle);
  const isGeneral = piece.type === 'general';
  const octagonPoints = '50,12 77,23 88,50 77,77 50,88 23,77 12,50 23,23';

  const handleClick = () => {
    if (onSelectIntersection) {
      onSelectIntersection(piece.row, piece.col);
    } else {
      onClick?.();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${isRed ? '红方' : '黑方'}${char}`}
      className={`group relative rounded-full select-none cursor-pointer flex items-center justify-center transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[#D4AF37] ${sizeClass} ${getSurfaceClass(
        piece.camp,
        craftStyle
      )} ${
        isSelected
          ? '-translate-y-1.5 scale-110 ring-2 ring-[#D4AF37] shadow-[0_14px_24px_rgba(0,0,0,0.85)] z-30'
          : 'hover:-translate-y-0.5 active:translate-y-0 z-10'
      } ${isAlertShaking ? 'animate-illegal-shake' : ''}`}
    >
      {/* 上一步落子微光光环 */}
      {isLastMove && !isSelected && (
        <span
          className="absolute -inset-1 rounded-full border border-[#D4AF37]/80 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* 将军状态朱砂警示环 */}
      {isInCheck && (
        <span
          className="absolute -inset-1.5 rounded-full border-2 border-[#E03126] shadow-[0_0_16px_rgba(224,49,38,0.9)] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* SVG 阴刻纹饰层：红方“双弦重环·四极海棠星”，黑方“外圆内八角·玄甲虎符” */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="46.5"
          fill="none"
          stroke={
            isRed && craftStyle !== 'ebony-gilt'
              ? 'rgba(255,250,240,0.5)'
              : 'rgba(255,255,255,0.14)'
          }
          strokeWidth="1"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={ringColor}
          strokeWidth="2.2"
          strokeOpacity="0.88"
        />

        {isRed ? (
          <g>
            <circle
              cx="50"
              cy="50"
              r="37.5"
              fill="none"
              stroke={ringColor}
              strokeWidth={isGeneral ? '1.3' : '0.95'}
              strokeOpacity="0.68"
            />
            <polygon points="50,5.5 52.2,8 50,10.5 47.8,8" fill={ringColor} fillOpacity="0.85" />
            <polygon
              points="50,89.5 52.2,92 50,94.5 47.8,92"
              fill={ringColor}
              fillOpacity="0.85"
            />
            <polygon points="5.5,50 8,47.8 10.5,50 8,52.2" fill={ringColor} fillOpacity="0.85" />
            <polygon
              points="89.5,50 92,47.8 94.5,50 92,52.2"
              fill={ringColor}
              fillOpacity="0.85"
            />
          </g>
        ) : (
          <g>
            <polygon
              points={octagonPoints}
              fill="none"
              stroke={ringColor}
              strokeWidth={isGeneral ? '1.4' : '1.05'}
              strokeLinejoin="round"
              strokeOpacity="0.72"
            />
            <rect x="48.6" y="6.8" width="2.8" height="2.8" fill={ringColor} fillOpacity="0.8" />
            <rect x="48.6" y="90.4" width="2.8" height="2.8" fill={ringColor} fillOpacity="0.8" />
            <rect x="6.8" y="48.6" width="2.8" height="2.8" fill={ringColor} fillOpacity="0.8" />
            <rect x="90.4" y="48.6" width="2.8" height="2.8" fill={ringColor} fillOpacity="0.8" />
          </g>
        )}

        {isGeneral && (
          <circle
            cx="50"
            cy="50"
            r="31"
            fill="none"
            stroke={ringColor}
            strokeWidth="0.6"
            strokeDasharray="2 3"
            strokeOpacity="0.45"
          />
        )}
      </svg>

      {/* 核心汉字阴刻层 */}
      <span
        className={`relative z-10 leading-none tracking-tight select-none pointer-events-none ${getFontClass(
          fontScheme
        )} ${getCharClass(piece.camp, craftStyle)} text-[1.35rem] sm:text-[1.6rem] xl:text-[1.8rem]`}
      >
        {char}
      </span>
    </button>
  );
});
