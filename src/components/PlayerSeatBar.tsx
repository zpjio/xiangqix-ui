import React from 'react';
import { Clock, Pencil } from 'lucide-react';
import { Camp } from '../types/xiangqi';

interface PlayerSeatBarProps {
  camp: Camp;
  playerName: string;
  subtitle?: string;
  isTurn: boolean;
  isInCheck: boolean;
  materialDiff: number; // 该方净子力分差（大于 0.4 时显示）
  clockMs?: number | null;
  clockActive?: boolean;
  clockPaused?: boolean;
  onEditGameInfo?: () => void;
}

function formatClockMs(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 10_000) {
    const secs = Math.floor(safe / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `00:0${secs}.${tenths}`;
  }
  const totalSec = Math.ceil(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PlayerSeatBar: React.FC<PlayerSeatBarProps> = React.memo(({
  camp,
  playerName,
  subtitle,
  isTurn,
  isInCheck,
  materialDiff,
  clockMs = null,
  clockActive = false,
  clockPaused = false,
  onEditGameInfo,
}) => {
  const isRed = camp === 'red';
  const isLowClock = clockMs !== null && clockMs <= 30_000;

  return (
    <div className="w-full px-1 py-0.5 flex items-center justify-between gap-3 select-none">
      {/* 左侧：轻量红/黑标识 + 棋手姓名 + 赛事/难度副标 */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
            isRed
              ? 'bg-[var(--xq-accent-crimson)]/12 text-[var(--xq-accent-crimson)] border-[var(--xq-accent-crimson)]/40'
              : 'bg-[var(--xq-eval-black)] text-[#EFE6D8] border-[var(--xq-border-strong)]'
          }`}
        >
          {isRed ? '红' : '黑'}
        </span>

        {onEditGameInfo ? (
          <button
            type="button"
            onClick={onEditGameInfo}
            title="点击编辑对局信息（红黑棋手、赛事与开局）"
            aria-label="编辑对局信息"
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
            <Pencil
              className="w-3 h-3 shrink-0 xq-text-muted opacity-45 group-hover:opacity-100 group-hover:text-[var(--xq-accent-gold)] transition-opacity"
              aria-hidden="true"
            />
          </button>
        ) : (
          <div className="text-left min-w-0 flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{playerName}</span>
            {subtitle && (
              <span className="text-xs xq-text-muted truncate hidden sm:inline">
                · {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 右侧：行棋态 · 将军提示 · 净子力分差 · 棋钟倒计时 */}
      <div className="flex items-center gap-2.5 shrink-0 text-xs">
        {materialDiff > 0.4 && (
          <span className="font-mono-tabular text-xs font-medium xq-text-secondary">
            子力 +{materialDiff.toFixed(1)}
          </span>
        )}

        {isInCheck && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--xq-eval-red)] text-[#F4EFE2] text-xs font-semibold whitespace-nowrap">
            将军
          </span>
        )}

        {isTurn && (
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              isRed ? 'text-[var(--xq-accent-crimson)]' : 'text-[var(--xq-accent-gold)]'
            }`}
          >
            行棋中
          </span>
        )}

        {clockMs !== null && (
          <span
            title={clockPaused ? '棋钟已暂停' : clockActive ? '计时中' : '等待对方走棋'}
            className={`px-2 py-0.5 rounded border font-mono-tabular text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
              clockActive && !clockPaused
                ? isLowClock
                  ? 'border-[var(--xq-accent-crimson)]/60 bg-[var(--xq-accent-crimson)]/15 text-[var(--xq-accent-crimson)]'
                  : 'border-[var(--xq-accent-gold)]/55 bg-[var(--xq-bg-elevated)] xq-text-primary'
                : 'xq-border bg-[var(--xq-bg-surface)] xq-text-muted'
            }`}
          >
            <Clock className="w-3 h-3 shrink-0" />
            <span>{formatClockMs(clockMs)}</span>
          </span>
        )}
      </div>
    </div>
  );
});
