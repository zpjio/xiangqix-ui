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

export const PlayerSeatBar: React.FC<PlayerSeatBarProps> = React.memo(({
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
    <div className="w-full px-1 py-0.5 flex items-center justify-between gap-3 select-none">
      {/* 左侧：轻量红/黑标识 + 棋手姓名 + 赛事/难度副标 */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
            isRed
              ? 'bg-[#C8372D]/12 text-[#EF4444] border-[#C8372D]/40'
              : 'bg-zinc-800/80 text-zinc-200 border-zinc-600/50'
          }`}
        >
          {isRed ? '红' : '黑'}
        </span>

        <button
          type="button"
          onClick={onEditGameInfo}
          className="text-left min-w-0 group cursor-pointer flex items-center gap-1.5"
        >
          <span className="text-sm font-semibold truncate group-hover:underline">
            {playerName}
          </span>
          {subtitle && (
            <span className="text-xs xq-text-muted truncate hidden sm:inline">
              · {subtitle}
            </span>
          )}
        </button>
      </div>

      {/* 右侧：行棋态 · 将军提示 · 净子力分差（去重胶囊化） */}
      <div className="flex items-center gap-2.5 shrink-0 text-xs">
        {materialDiff > 0.4 && (
          <span className="font-mono-tabular text-xs font-medium xq-text-secondary">
            子力 +{materialDiff.toFixed(1)}
          </span>
        )}

        {isInCheck && (
          <span className="px-1.5 py-0.5 rounded bg-[#C8372D] text-white text-xs font-semibold whitespace-nowrap">
            将军
          </span>
        )}

        {isTurn && (
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              isRed ? 'text-[#EF4444]' : 'text-[var(--xq-accent-gold)]'
            }`}
          >
            行棋中
          </span>
        )}
      </div>
    </div>
  );
});
