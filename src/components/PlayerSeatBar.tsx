import React from 'react';
import { Camp } from '../types/xiangqi';

interface PlayerSeatBarProps {
  camp: Camp;
  playerName: string;
  subtitle?: string;
  isTurn: boolean;
  isInCheck: boolean;
  materialDiff: number; // 该方净子力分差（大于 0.4 时显示）
  onEditGameInfo?: () => void;
}

export const PlayerSeatBar: React.FC<PlayerSeatBarProps> = ({
  camp,
  playerName,
  subtitle,
  isTurn,
  isInCheck,
  materialDiff,
  onEditGameInfo,
}) => {
  const isRed = camp === 'red';

  return (
    <div className="w-full px-3.5 py-2 rounded-lg border xq-surface flex items-center justify-between gap-3 select-none">
      {/* 左侧：红/黑标识 + 棋手姓名 + 赛事/难度副标 */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
            isRed
              ? 'bg-[#C8372D]/15 text-[#EF4444] border-[#C8372D]/45'
              : 'bg-zinc-800 text-zinc-200 border-zinc-600/60'
          }`}
        >
          {isRed ? '红' : '黑'}
        </span>

        <button
          type="button"
          onClick={onEditGameInfo}
          className="text-left min-w-0 group cursor-pointer flex items-center gap-2"
        >
          <span className="text-[13px] font-semibold truncate group-hover:underline">
            {playerName}
          </span>
          {subtitle && (
            <span className="text-xs xq-text-muted truncate hidden sm:inline">
              · {subtitle}
            </span>
          )}
        </button>
      </div>

      {/* 右侧：行棋态 · 将军提示 · 净子力分差 */}
      <div className="flex items-center gap-2 shrink-0 text-xs">
        {materialDiff > 0.4 && (
          <span className="font-mono-tabular text-xs font-medium xq-text-secondary">
            子力 +{materialDiff.toFixed(1)}
          </span>
        )}

        {isInCheck && (
          <span className="px-2 py-0.5 rounded bg-[#C8372D] text-white text-xs font-semibold whitespace-nowrap">
            将军
          </span>
        )}

        {isTurn && (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
              isRed
                ? 'bg-[#C8372D]/15 text-[#EF4444]'
                : 'bg-[var(--xq-accent-gold)]/15 text-[var(--xq-accent-gold)]'
            }`}
          >
            行棋
          </span>
        )}
      </div>
    </div>
  );
};
