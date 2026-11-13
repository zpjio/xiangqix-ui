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
  hideReplay?: boolean;
  canNewGame?: boolean;
  newGameDisabledReason?: string;
  canUndo?: boolean;
  undoDisabledReason?: string;
  canHint?: boolean;
  hintDisabledReason?: string;
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
  hideReplay = false,
  canNewGame,
  newGameDisabledReason,
  canUndo,
  undoDisabledReason,
  canHint,
  hintDisabledReason,
  onJumpPly,
  onToggleReplay,
  onNewGame,
  onFlipBoard,
  onUndoMove,
  onTriggerHint,
}) => {
  const showReplay =
    !hideReplay && (workspace === 'study' || workspace === 'opening') && totalPlies > 0;
  const newGameLabel =
    workspace === 'play' || workspace === 'opening'
      ? '重开'
      : workspace === 'challenge'
      ? '重摆'
      : '新局';
  const defaultNewGameTitle =
    workspace === 'play'
      ? '按当前让子设置重新开局'
      : workspace === 'challenge'
      ? '重摆当前残局关卡'
      : workspace === 'opening'
      ? '重置至32子标准开局或重开当前对练'
      : '新拆一局（恢复32子标准开局）';

  const isPrevDisabled = disabled || currentPly <= 0;
  const isNextDisabled = disabled || currentPly >= totalPlies;
  const isNewGameDisabled = disabled || (canNewGame !== undefined ? !canNewGame : false);
  const isUndoDisabled = disabled || (canUndo !== undefined ? !canUndo : currentPly <= 0);
  const isHintDisabled = disabled || (canHint !== undefined ? !canHint : false);

  return (
    <div className="w-full px-3 py-1.5 rounded-lg border xq-surface flex items-center justify-between gap-2 select-none shadow-2xs">
      {/* 左侧步进导航（自动播放仅在复盘模式且已有着法时按需出现） */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={isPrevDisabled}
          onClick={() => onJumpPly(0)}
          title={isPrevDisabled ? '已位于开局起点' : '开局 (Home)'}
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={isPrevDisabled}
          onClick={() => onJumpPly(Math.max(0, currentPly - 1))}
          title={isPrevDisabled ? '已位于首步之前' : '上一步 (←)'}
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {showReplay && (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleReplay}
            title={isReplaying ? '暂停自动播放' : '自动播放棋谱'}
            className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap transition-colors ${
              disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
            } ${
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
          disabled={isNextDisabled}
          onClick={() => onJumpPly(Math.min(totalPlies, currentPly + 1))}
          title={isNextDisabled ? '已位于末步' : '下一步 (→)'}
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={isNextDisabled}
          onClick={() => onJumpPly(totalPlies)}
          title={isNextDisabled ? '已位于末步' : '末步 (End)'}
          className="p-1.5 rounded hover:bg-[var(--xq-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧常用操作：新局/重开 · 翻转 · 悔棋 · 支招 */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isNewGameDisabled}
          onClick={onNewGame}
          title={isNewGameDisabled ? newGameDisabledReason || '当前已是初始局面，无需重开' : defaultNewGameTitle}
          className={`px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 whitespace-nowrap ${
            isNewGameDisabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
          }`}
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
          disabled={isUndoDisabled}
          onClick={onUndoMove}
          title={isUndoDisabled ? undoDisabledReason || '当前暂无可悔着法' : '悔棋'}
          className={`px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 whitespace-nowrap ${
            isUndoDisabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <Undo2 className="w-3.5 h-3.5 opacity-80" />
          <span>悔棋</span>
        </button>

        <button
          type="button"
          disabled={isHintDisabled}
          onClick={onTriggerHint}
          title={isHintDisabled ? hintDisabledReason || '当前局面不可支招' : '引擎推荐支招'}
          className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap ${
            isHintDisabled
              ? 'xq-btn-secondary opacity-35 cursor-not-allowed'
              : 'xq-btn-primary cursor-pointer shadow-2xs'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>支招</span>
        </button>
      </div>
    </div>
  );
});
