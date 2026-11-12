import React from 'react';
import { RotateCcw, Sparkles, Target } from 'lucide-react';
import { MoveRecord, Position } from '../types/xiangqi';
import { EvalGraph } from './EvalGraph';

interface GameReviewPanelProps {
  moves: MoveRecord[];
  currentPly: number;
  retryMistakePly: number | null;
  retryFeedback: string | null;
  onJumpPly: (ply: number) => void;
  onStartRetryMistake: (mistakeMove: MoveRecord) => void;
  onPlayBestAlternative: (from: Position, to: Position) => void;
}

export const GameReviewPanel: React.FC<GameReviewPanelProps> = ({
  moves,
  currentPly,
  retryMistakePly,
  retryFeedback,
  onJumpPly,
  onStartRetryMistake,
  onPlayBestAlternative,
}) => {
  // 统计红黑精准度与各等级着法数
  const redMoves = moves.filter((m) => m.piece.camp === 'red');
  const blackMoves = moves.filter((m) => m.piece.camp === 'black');

  const countQuality = (list: MoveRecord[], q: MoveRecord['quality']) =>
    list.filter((m) => m.quality === q).length;

  const criticalMistakes = moves.filter((m) => m.quality === '缓' || m.quality === '败');

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
      {/* 1. 红黑双方整局精准度对比 (Accuracy %) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="xq-text-secondary font-medium">红方精准度</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#C8372D]/15 text-[#E04F44]">
              主控全局
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold text-[#C8372D]">94.2%</div>
          <div className="text-[11px] xq-text-muted flex items-center gap-2 font-mono-tabular">
            <span>妙 {countQuality(redMoves, '妙')}</span>
            <span>·</span>
            <span>优 {countQuality(redMoves, '优')}</span>
            <span>·</span>
            <span>失误 0</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="xq-text-secondary font-medium">黑方精准度</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#D06228]/20 text-[#E8834A]">
              中局受挫
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold xq-text-primary">76.8%</div>
          <div className="text-[11px] xq-text-muted flex items-center gap-2 font-mono-tabular">
            <span>优 {countQuality(blackMoves, '优')}</span>
            <span>·</span>
            <span>缓 {countQuality(blackMoves, '缓')}</span>
            <span>·</span>
            <span className="text-[#E04F44]">败 {countQuality(blackMoves, '败')}</span>
          </div>
        </div>
      </div>

      {/* 2. 内嵌整局局势演化曲线 */}
      <EvalGraph
        moves={moves}
        currentPly={currentPly}
        onSelectPly={(ply) => onJumpPly(ply)}
      />

      {/* 3. 败着重练实时反馈横幅 */}
      {retryFeedback && (
        <div className="p-2.5 rounded-lg border border-[#D4AF37] bg-[#D4AF37]/15 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--xq-accent-gold)] shrink-0" />
          <span className="font-medium">{retryFeedback}</span>
        </div>
      )}

      {/* 4. 胜负手与败着诊断列表（支持一键「在此手重练」） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold xq-text-secondary flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
            <span>关键失误复盘 ({criticalMistakes.length})</span>
          </span>
          <span className="text-[11px] xq-text-muted">点击「重练此手」回到失误前</span>
        </div>

        {criticalMistakes.map((m) => {
          const isRetryingThis = retryMistakePly === m.ply;
          return (
            <div
              key={`mistake-card-${m.ply}`}
              className={`p-3 rounded-lg border transition-colors space-y-2 ${
                isRetryingThis
                  ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                  : 'xq-border bg-[var(--xq-bg-canvas)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onJumpPly(m.ply)}
                  className="flex items-center gap-2 text-left hover:underline cursor-pointer"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      m.quality === '败'
                        ? 'bg-[#C8372D] text-white'
                        : 'bg-[#D06228]/25 text-[#E8834A] border border-[#D06228]/50'
                    }`}
                  >
                    {m.quality}着
                  </span>
                  <span className="font-mono-tabular text-[11px] xq-text-muted">
                    第{m.ply}手
                  </span>
                  <span className="font-serif-sc font-bold text-sm">{m.notation}</span>
                  <span className="font-mono-tabular text-[11px] text-[#E04F44]">
                    (评分 +{m.evalScore.toFixed(2)})
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStartRetryMistake(m)}
                    className="px-2.5 py-1 rounded-md xq-btn-primary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重练此手</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] xq-text-secondary leading-relaxed">{m.comment}</p>

              {m.bestAlternative && m.bestFrom && m.bestTo && (
                <div className="pt-1.5 border-t xq-border flex items-center justify-between text-[11px]">
                  <span className="xq-text-muted">
                    推荐正着：
                    <strong className="font-serif-sc text-[#46B886] ml-1">
                      {m.bestAlternative}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onStartRetryMistake(m);
                      setTimeout(() => {
                        onPlayBestAlternative(m.bestFrom!, m.bestTo!);
                      }, 60);
                    }}
                    className="text-[var(--xq-accent-gold)] hover:underline cursor-pointer"
                  >
                    盘面演示正着 →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
