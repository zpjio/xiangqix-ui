import React from 'react';
import { BookMarked, Compass, CornerDownLeft, GitFork, Sparkles } from 'lucide-react';
import {
  Camp,
  MultiPVArrow,
  OpeningBookNode,
  OpeningPresetLine,
  Position,
} from '../types/xiangqi';
import { OPENING_PRESETS } from '../data/openingBook';

interface OpeningBookPanelProps {
  turn: Camp;
  currentPly: number;
  matchedNode: OpeningBookNode | null;
  lastMatchedInfo: {
    ply: number;
    openingName: string;
    category: string;
  } | null;
  onSelectOpeningMove: (from: Position, to: Position) => void;
  onHoverOpeningMove: (arrow: MultiPVArrow | null) => void;
  onJumpToPly: (ply: number) => void;
  onApplyOpeningPreset: (preset: OpeningPresetLine) => void;
}

export const OpeningBookPanel: React.FC<OpeningBookPanelProps> = React.memo(({
  turn,
  currentPly,
  matchedNode,
  lastMatchedInfo,
  onSelectOpeningMove,
  onHoverOpeningMove,
  onJumpToPly,
  onApplyOpeningPreset,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
      {/* 顶部定式识别状态栏 */}
      <div className="px-3.5 py-2.5 border-b xq-border bg-[var(--xq-bg-canvas)] space-y-1.5 shrink-0">
        {matchedNode ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <BookMarked className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                <span className="font-serif-sc font-bold text-sm xq-text-primary truncate">
                  {matchedNode.openingName}
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular xq-text-muted shrink-0">
                第 {matchedNode.plyDepth} 手定式
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] xq-text-secondary">
              <span>{matchedNode.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                样本 {matchedNode.totalGames.toLocaleString()} 局
              </span>
              <span aria-hidden="true">·</span>
              <span>轮到{turn === 'red' ? '红方' : '黑方'}行棋</span>
            </div>

            <p className="text-[11px] xq-text-muted leading-relaxed">
              {matchedNode.comment}
            </p>
          </>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 xq-text-secondary font-semibold">
                <Compass className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                <span>当前局面已脱离标准开局定式</span>
              </div>
              <span className="text-[11px] font-mono-tabular xq-text-muted">
                第 {currentPly} 手
              </span>
            </div>
            <p className="text-[11px] xq-text-muted leading-relaxed">
              {lastMatchedInfo
                ? `已进入自由中盘较量（本谱最后命中定式：${lastMatchedInfo.openingName} · 第 ${lastMatchedInfo.ply} 手）。`
                : '当前局面非标准开局或已超出预设开局深度，可回退定式节点或点选下方经典开局骨架重新研习。'}
            </p>
            {lastMatchedInfo && (
              <button
                type="button"
                onClick={() => onJumpToPly(lastMatchedInfo.ply)}
                className="px-2.5 py-1 rounded-md xq-btn-secondary text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CornerDownLeft className="w-3 h-3 text-[var(--xq-accent-gold)]" />
                <span>
                  退回至「{lastMatchedInfo.openingName}」（第 {lastMatchedInfo.ply} 手）
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 主体：后续热门定式变例 OR 经典开局骨架快选 */}
      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--xq-border-subtle)]">
        {matchedNode && matchedNode.nextMoves.length > 0 ? (
          <>
            <div className="px-3.5 py-1.5 bg-[var(--xq-bg-surface)] flex items-center justify-between text-[11px] xq-text-muted">
              <span>流行后续着法（悬停预览 · 点击走入）</span>
              <span className="font-mono-tabular">红胜 / 和 / 黑胜</span>
            </div>

            {matchedNode.nextMoves.map((mv, idx) => (
              <button
                key={`${mv.from.row}-${mv.from.col}-${mv.to.row}-${mv.to.col}`}
                type="button"
                onMouseEnter={() =>
                  onHoverOpeningMove({
                    rank: idx + 1,
                    from: mv.from,
                    to: mv.to,
                    scoreText: `${mv.frequencyPct}%`,
                    notation: mv.notation,
                    isGhostPreview: true,
                  })
                }
                onMouseLeave={() => onHoverOpeningMove(null)}
                onClick={() => {
                  onHoverOpeningMove(null);
                  onSelectOpeningMove(mv.from, mv.to);
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--xq-bg-hover)] transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-serif-sc font-bold text-sm ${
                        turn === 'red' ? 'text-[#EF4444]' : 'xq-text-primary'
                      }`}
                    >
                      {mv.notation}
                    </span>
                    <span className="text-[11px] xq-text-secondary truncate">
                      {mv.targetOpeningName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                    {mv.badge && (
                      <span className="text-[var(--xq-accent-gold)] font-medium">
                        {mv.badge}
                      </span>
                    )}
                    <span className="font-mono-tabular font-semibold xq-text-primary w-9 text-right">
                      {mv.frequencyPct}%
                    </span>
                  </div>
                </div>

                {/* 红胜 / 和棋 / 黑胜 比例分布条 + 明文百分比 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-[var(--xq-bg-canvas)] border border-[var(--xq-border-subtle)]">
                    <div
                      style={{ width: `${mv.redWinPct}%` }}
                      className="h-full bg-[#C8372D]"
                    />
                    <div
                      style={{ width: `${mv.drawPct}%` }}
                      className="h-full bg-[#64748B]"
                    />
                    <div
                      style={{ width: `${mv.blackWinPct}%` }}
                      className="h-full bg-[#27272A]"
                    />
                  </div>
                  <span className="text-[10px] font-mono-tabular xq-text-muted shrink-0">
                    红{mv.redWinPct}% · 和{mv.drawPct}% · 黑{mv.blackWinPct}%
                  </span>
                </div>
              </button>
            ))}
          </>
        ) : matchedNode ? (
          <div className="p-4 space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 font-medium xq-text-secondary">
              <GitFork className="w-4 h-4 text-[var(--xq-accent-gold)]" />
              <span>已达当前定式末梢节点</span>
            </div>
            <p className="text-[11px] xq-text-muted leading-relaxed">
              后续已全面转入中局战略争夺，可直接使用上方引擎分析主变或直接在左侧棋盘试走推演。
            </p>
          </div>
        ) : null}

        {/* 五大常见开局体系快速演练入口 */}
        <div className="p-3.5 space-y-2 bg-[var(--xq-bg-canvas)]/40">
          <div className="flex items-center justify-between text-[11px] font-medium xq-text-secondary">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
              <span>经典开局定式骨架一键演练</span>
            </span>
            <span className="font-mono-tabular xq-text-muted">
              {OPENING_PRESETS.length} 套体系
            </span>
          </div>

          <div className="space-y-1.5">
            {OPENING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyOpeningPreset(preset)}
                className="w-full p-2 rounded-lg text-left xq-btn-option flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="font-serif-sc font-semibold text-xs xq-text-primary truncate">
                    {preset.title}
                  </div>
                  <div className="text-[11px] xq-text-muted truncate mt-0.5 font-normal">
                    {preset.category} · {preset.summary}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--xq-accent-gold)] font-mono-tabular shrink-0">
                  载入 {preset.moves.length} 手
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
