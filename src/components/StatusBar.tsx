import React from 'react';
import { Camp, GameTerminalState, WorkspaceMode } from '../types/xiangqi';

interface StatusBarProps {
  workspace: WorkspaceMode;
  isAnalyzing: boolean;
  compareMode?: boolean;
  primaryEngineName?: string;
  secondaryEngineName?: string;
  engineThreads?: number;
  engineHashMb?: number;
  turn: Camp;
  currentPly: number;
  totalPlies: number;
  inCheckCamp: Camp | null;
  terminalOutcome?: GameTerminalState | null;
  illegalMoveWarning?: string | null;
  isVariationActive: boolean;
  isOpeningDrillActive?: boolean;
  advantageSummary: string;
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(({
  workspace,
  isAnalyzing,
  compareMode = false,
  primaryEngineName = '皮卡鱼',
  secondaryEngineName = '旋风',
  engineThreads = 8,
  engineHashMb = 512,
  turn,
  currentPly,
  totalPlies,
  inCheckCamp,
  terminalOutcome = null,
  illegalMoveWarning = null,
  isVariationActive,
  isOpeningDrillActive = false,
  advantageSummary,
}) => {
  const getWorkspaceLabel = () => {
    if (workspace === 'opening') {
      return isOpeningDrillActive
        ? '开局研习 · 变例防剧透对练中（棋盘直接走子校验正误）'
        : '开局研习 · 定式树探索与7套主流骨架（可随时携带定式转入复盘分析）';
    }
    if (workspace === 'challenge') {
      return '残局题库 · 执红先行破局（可随时转入复盘分析）';
    }
    if (workspace === 'play') {
      return '人机对弈 · 支持让子与悔棋支招（可随时转入复盘分析）';
    }
    if (workspace === 'setup') {
      return '摆子编辑 · 点选右侧子力库布子，点击盘面已有棋子可移除';
    }
    if (isVariationActive) {
      return '分支推演中 · 可在右侧棋谱「升为主线」或返回主谱';
    }
    if (isAnalyzing) {
      if (compareMode) {
        return `双擎并行对比中 (${primaryEngineName} vs ${secondaryEngineName} · ${engineThreads}核/${engineHashMb}M) · 快捷键 C 切换`;
      }
      return `${primaryEngineName} 实时分析中 (${engineThreads}核/${engineHashMb}M) · 悬停变例可预览走法`;
    }
    return '复盘分析 · 点击「开始分析」或直接落子推演分支';
  };

  return (
    <footer className="min-h-8 py-1 px-6 border-t xq-surface flex items-center justify-between gap-3 text-xs select-none shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {illegalMoveWarning ? (
          <span className="font-semibold text-[#F59E0B] truncate">{illegalMoveWarning}</span>
        ) : (
          <span className="font-medium xq-text-secondary truncate">{getWorkspaceLabel()}</span>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0 xq-text-muted font-mono-tabular text-xs">
        <span>{advantageSummary}</span>
        <span aria-hidden="true">·</span>
        <span>{turn === 'red' ? '红方行棋' : '黑方行棋'}</span>
        <span aria-hidden="true">·</span>
        <span>
          第 {currentPly}/{totalPlies} 手
        </span>
        {terminalOutcome ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[#EF4444] font-semibold">
              {terminalOutcome.winner === 'red' ? '红胜' : '黑胜'} ·{' '}
              {terminalOutcome.kind === 'checkmate' ? '绝杀' : '困毙'}
            </span>
          </>
        ) : (
          inCheckCamp && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#EF4444] font-semibold">
                {inCheckCamp === 'red' ? '红帅受将 · 须先应将' : '黑将受将 · 须先应将'}
              </span>
            </>
          )
        )}
      </div>
    </footer>
  );
});
