import React from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Undo2,
} from 'lucide-react';

interface BoardNavProps {
  currentPly: number;
  totalPlies: number;
  isReplaying: boolean;
  disabled?: boolean;
  onJumpPly: (ply: number) => void;
  onToggleReplay: () => void;
  onFlipBoard: () => void;
  onUndoMove: () => void;
  onTriggerHint: () => void;
}

export const BoardNav: React.FC<BoardNavProps> = ({
  currentPly,
  totalPlies,
  isReplaying,
  disabled = false,
  onJumpPly,
  onToggleReplay,
  onFlipBoard,
  onUndoMove,
  onTriggerHint,
}) => {
  return (
    <div className="w-full px-3.5 py-1.5 rounded-lg border xq-surface flex items-center justify-between gap-2 select-none shadow-2xs">
      {/* 左侧步进导航 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || currentPly <= 0}
          onClick={() => onJumpPly(0)}
          title="开局 (Home)"
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 transition-colors cursor-pointer"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={disabled || currentPly <= 0}
          onClick={() => onJumpPly(Math.max(0, currentPly - 1))}
          title="上一步 (←)"
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={disabled || totalPlies === 0}
          onClick={onToggleReplay}
          className={`px-3 py-1 rounded-md text-[13px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-35 ${
            isReplaying ? 'xq-btn-primary shadow-2xs' : 'xq-btn-secondary'
          }`}
        >
          {isReplaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>暂停</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>自动播放</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={disabled || currentPly >= totalPlies}
          onClick={() => onJumpPly(Math.min(totalPlies, currentPly + 1))}
          title="下一步 (→)"
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={disabled || currentPly >= totalPlies}
          onClick={() => onJumpPly(totalPlies)}
          title="末步 (End)"
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 transition-colors cursor-pointer"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧常用操作：翻转 · 悔棋 · 支招 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onFlipBoard}
          title="翻转棋盘"
          className="px-3 py-1 rounded-md xq-btn-secondary text-[13px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 opacity-80" />
          <span>翻转</span>
        </button>

        <button
          type="button"
          disabled={disabled || currentPly <= 0}
          onClick={onUndoMove}
          title="悔棋"
          className="px-3 py-1 rounded-md xq-btn-secondary disabled:opacity-35 text-[13px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5 opacity-80" />
          <span>悔棋</span>
        </button>

        <button
          type="button"
          onClick={onTriggerHint}
          title="引擎推荐支招"
          className="px-3 py-1 rounded-md xq-btn-primary text-[13px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>支招</span>
        </button>
      </div>
    </div>
  );
};
