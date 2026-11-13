import React from 'react';
import {
  ArrowUpDown,
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
import { WorkspaceMode } from '../types/xiangqi';

interface BoardNavProps {
  workspace: WorkspaceMode;
  currentPly: number;
  totalPlies: number;
  isReplaying: boolean;
  disabled?: boolean;
  onJumpPly: (ply: number) => void;
  onToggleReplay: () => void;
  onNewGame: () => void;
  onFlipBoard: () => void;
  onUndoMove: () => void;
  onTriggerHint: () => void;
}

export const BoardNav: React.FC<BoardNavProps> = React.memo(({
  workspace,
  currentPly,
  totalPlies,
  isReplaying,
  disabled = false,
  onJumpPly,
  onToggleReplay,
  onNewGame,
  onFlipBoard,
  onUndoMove,
  onTriggerHint,
}) => {
  const showReplay = workspace === 'study' && totalPlies > 0;
  const newGameLabel =
    workspace === 'play' ? '重开' : workspace === 'challenge' ? '重摆' : '新局';
  const newGameTitle =
    workspace === 'play'
      ? '按当前让子设置重新开局'
      : workspace === 'challenge'
      ? '重摆当前残局关卡'
      : '新拆一局（恢复32子标准开局）';

  return (
    <div className="w-full px-3 py-1.5 rounded-lg border xq-surface flex items-center justify-between gap-2 select-none shadow-2xs">
      {/* 左侧步进导航（自动播放仅在复盘模式且已有着法时按需出现） */}
      <div className="flex items-center gap-0.5">
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

        {showReplay && (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleReplay}
            title={isReplaying ? '暂停自动播放' : '自动播放棋谱'}
            className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
              isReplaying
                ? 'xq-btn-primary shadow-2xs'
                : 'hover:bg-[var(--xq-bg-hover)] xq-text-secondary'
            }`}
          >
            {isReplaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>暂停</span>
              </>
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>
        )}

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

      {/* 右侧常用操作：新局/重开 · 翻转 · 悔棋 · 支招 */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onNewGame}
          title={newGameTitle}
          className="px-2.5 py-1 rounded-md xq-btn-secondary disabled:opacity-35 text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 opacity-80" />
          <span>{newGameLabel}</span>
        </button>

        <button
          type="button"
          onClick={onFlipBoard}
          title="翻转棋盘 (F)"
          className="px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <ArrowUpDown className="w-3.5 h-3.5 opacity-80" />
          <span>翻转</span>
        </button>

        <button
          type="button"
          disabled={disabled || currentPly <= 0}
          onClick={onUndoMove}
          title="悔棋"
          className="px-2.5 py-1 rounded-md xq-btn-secondary disabled:opacity-35 text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5 opacity-80" />
          <span>悔棋</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onTriggerHint}
          title="引擎推荐支招"
          className="px-2.5 py-1 rounded-md xq-btn-primary disabled:opacity-35 text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer shadow-2xs"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>支招</span>
        </button>
      </div>
    </div>
  );
});
