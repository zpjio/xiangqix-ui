import React from 'react';
import { Camp, DrawRuleStatus, GameTerminalState, PlayOpponentMode, WorkspaceMode } from '../types/xiangqi';

interface StatusBarProps {
  workspace: WorkspaceMode;
  playOpponentMode?: PlayOpponentMode;
  playHumanCamp?: Camp;
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
  drawRuleStatus?: DrawRuleStatus | null;
  illegalMoveWarning?: string | null;
  isVariationActive: boolean;
  isOpeningDrillActive?: boolean;
  advantageSummary: string;
}

function formatTerminalLabel(outcome: GameTerminalState): string {
  switch (outcome.kind) {
    case 'checkmate':
      return `${outcome.winner === 'red' ? '红胜' : '黑胜'} · 绝杀`;
    case 'stalemate':
      return `${outcome.winner === 'red' ? '红胜' : '黑胜'} · 困毙`;
    case 'resign':
      return `${outcome.winner === 'red' ? '红胜' : '黑胜'} · 认输`;
    case 'timeout':
      return `${outcome.winner === 'red' ? '红胜' : '黑胜'} · 超时`;
    case 'draw-60moves':
      return '和棋 · 60回合限着';
    case 'draw-repetition':
      return '和棋 · 三次重复';
    case 'draw-agreement':
      return '和棋 · 双方议和';
    case 'draw-insufficient':
      return '和棋 · 死和';
    case 'perpetual-check':
      return `${outcome.winner === 'red' ? '红胜' : '黑胜'} · 长将判负`;
  }
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(({
  workspace,
  playOpponentMode = 'ai',
  playHumanCamp = 'red',
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
  drawRuleStatus = null,
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
      if (playOpponentMode === 'local-pvp') {
        return '本地双人对弈 · 支持面对面轮流落子、棋钟加秒与悔棋';
      }
      return `人机对弈（我方${playHumanCamp === 'red' ? '执红先手' : '执黑后手'}）· 支持开局变例、低时提醒与认输提和`;
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
    return '复盘分析 · 支持拖拽走子、右键画战术箭头与单步批注编辑';
  };

  return (
    <footer className="min-h-8 py-1.5 px-3 min-[900px]:px-6 border-t xq-surface flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs select-none shrink-0">
      <div className="flex items-center gap-3 min-w-0 max-w-full">
        {illegalMoveWarning ? (
          <span className="font-semibold text-[var(--xq-accent-amber)] truncate">
            {illegalMoveWarning}
          </span>
        ) : (
          <span className="font-medium xq-text-secondary truncate">{getWorkspaceLabel()}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 min-[900px]:gap-2.5 shrink-0 xq-text-muted font-mono-tabular text-xs">
        <span>{advantageSummary}</span>
        <span aria-hidden="true">·</span>
        <span>{turn === 'red' ? '红方行棋' : '黑方行棋'}</span>
        <span aria-hidden="true">·</span>
        <span>
          第 {currentPly}/{totalPlies} 手
        </span>
        {drawRuleStatus && drawRuleStatus.noCaptureRounds >= 10 && !terminalOutcome && (
          <>
            <span aria-hidden="true">·</span>
            <span
              className={
                drawRuleStatus.canClaim60MoveDraw
                  ? 'text-[var(--xq-accent-amber)] font-semibold'
                  : ''
              }
            >
              无吃子 {drawRuleStatus.noCaptureRounds}/60
            </span>
          </>
        )}
        {drawRuleStatus && drawRuleStatus.repetitionCount >= 2 && !terminalOutcome && (
          <>
            <span aria-hidden="true">·</span>
            <span
              className={
                drawRuleStatus.perpetualCheckCamp
                  ? 'text-[var(--xq-accent-crimson)] font-semibold'
                  : drawRuleStatus.canClaimRepetitionDraw
                  ? 'text-[var(--xq-accent-amber)] font-semibold'
                  : ''
              }
            >
              {drawRuleStatus.perpetualCheckCamp
                ? `${drawRuleStatus.perpetualCheckCamp === 'red' ? '红方' : '黑方'}长将禁止`
                : `重复 ${drawRuleStatus.repetitionCount}/3`}
            </span>
          </>
        )}
        {drawRuleStatus?.canClaimInsufficientDraw && !terminalOutcome && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--xq-accent-amber)] font-semibold">双方无进攻子力</span>
          </>
        )}
        {terminalOutcome ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--xq-accent-crimson)] font-semibold">
              {formatTerminalLabel(terminalOutcome)}
            </span>
          </>
        ) : (
          inCheckCamp && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--xq-accent-crimson)] font-semibold">
                {inCheckCamp === 'red' ? '红帅受将 · 须先应将' : '黑将受将 · 须先应将'}
              </span>
            </>
          )
        )}
      </div>
    </footer>
  );
});
