import React from 'react';
import { Camp, WorkspaceMode } from '../types/xiangqi';

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
  isVariationActive: boolean;
  advantageSummary: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
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
  isVariationActive,
  advantageSummary,
}) => {
  const getWorkspaceLabel = () => {
    if (workspace === 'challenge') {
      return '残局题库 · 执红先行破局';
    }
    if (workspace === 'play') {
      return '人机对弈 · 支持让子与悔棋支招';
    }
    if (workspace === 'setup') {
      return '摆子编辑 · 点选右侧棋子即可在任意交点布子';
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
    return '复盘分析 · 点击任意历史手直接落子即可生成分支';
  };

  return (
    <footer className="h-8 px-6 border-t xq-surface flex items-center justify-between text-xs select-none shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium xq-text-secondary truncate">{getWorkspaceLabel()}</span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 xq-text-muted font-mono-tabular text-xs">
        <span>{advantageSummary}</span>
        <span aria-hidden="true">·</span>
        <span>{turn === 'red' ? '红方行棋' : '黑方行棋'}</span>
        <span aria-hidden="true">·</span>
        <span>
          第 {currentPly}/{totalPlies} 手
        </span>
        {inCheckCamp && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[#EF4444] font-semibold">
              {inCheckCamp === 'red' ? '红帅受将' : '黑将受将'}
            </span>
          </>
        )}
      </div>
    </footer>
  );
};
