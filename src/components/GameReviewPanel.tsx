import React, { useMemo } from 'react';
import { FileCode2, RotateCcw, Sparkles, Target } from 'lucide-react';
import { MoveQuality, MoveRecord, Position } from '../types/xiangqi';
import { EvalGraph } from './EvalGraph';

interface GameReviewPanelProps {
  moves: MoveRecord[];
  currentPly: number;
  retryMistakePly: number | null;
  retryFeedback: string | null;
  onJumpPly: (ply: number) => void;
  onStartRetryMistake: (mistakeMove: MoveRecord) => void;
  onPlayBestAlternative: (from: Position, to: Position) => void;
  onLoadSampleGame: () => void;
  onOpenImportModal: () => void;
}

const QUALITY_SCORE_MAP: Record<MoveQuality, number> = {
  妙: 99,
  优: 95,
  良: 88,
  缓: 74,
  败: 48,
};

function calcCampAccuracy(list: MoveRecord[]): string {
  if (list.length === 0) return '—';
  const total = list.reduce(
    (sum, m) => sum + (m.quality ? QUALITY_SCORE_MAP[m.quality] : 90),
    0
  );
  return `${(total / list.length).toFixed(1)}%`;
}

export const GameReviewPanel: React.FC<GameReviewPanelProps> = React.memo(({
  moves,
  currentPly,
  retryMistakePly,
  retryFeedback,
  onJumpPly,
  onStartRetryMistake,
  onPlayBestAlternative,
  onLoadSampleGame,
  onOpenImportModal,
}) => {
  const countQuality = (list: MoveRecord[], q: MoveRecord['quality']) =>
    list.filter((m) => m.quality === q).length;

  const { redMoves, blackMoves, criticalMistakes, redAcc, blackAcc, redErrors } = useMemo(() => {
    const rMoves = moves.filter((m) => m.piece.camp === 'red');
    const bMoves = moves.filter((m) => m.piece.camp === 'black');
    const mistakes = moves.filter((m) => m.quality === '缓' || m.quality === '败');
    const rErr =
      rMoves.filter((m) => m.quality === '缓' || m.quality === '败').length;
    return {
      redMoves: rMoves,
      blackMoves: bMoves,
      criticalMistakes: mistakes,
      redAcc: calcCampAccuracy(rMoves),
      blackAcc: calcCampAccuracy(bMoves),
      redErrors: rErr,
    };
  }, [moves]);

  if (moves.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col justify-center items-center text-center space-y-3 text-xs">
        <div className="w-10 h-10 rounded-full border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-center text-[var(--xq-accent-gold)]">
          <Target className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-[280px]">
          <div className="font-semibold text-sm xq-text-primary">暂无对局着法记录</div>
          <p className="xq-text-muted leading-relaxed">
            在棋盘走子、导入 FEN/PGN 棋谱，或载入名局后，即可生成双边精准度、胜率走势图与败着重练报告。
          </p>
        </div>
        <div className="flex flex-col w-full max-w-[260px] gap-2 pt-1">
          <button
            type="button"
            onClick={onLoadSampleGame}
            className="w-full px-3 py-1.5 rounded-md xq-btn-primary text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>载入示范名局（体验复盘与重练）</span>
          </button>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="w-full px-3 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 opacity-80" />
            <span>导入 FEN / PGN 棋谱</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 text-xs">
      {/* 1. 红黑双方整局精准度对比 (Accuracy %) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="xq-text-secondary font-medium">红方精准度</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#C8372D]/15 text-[#E04F44]">
              {redErrors === 0 ? '主控全局' : `失误 ${redErrors}`}
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold text-[#C8372D]">{redAcc}</div>
          <div className="text-[11px] xq-text-muted flex items-center gap-2 font-mono-tabular">
            <span>妙 {countQuality(redMoves, '妙')}</span>
            <span>·</span>
            <span>优 {countQuality(redMoves, '优')}</span>
            <span>·</span>
            <span>失误 {redErrors}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="xq-text-secondary font-medium">黑方精准度</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#D06228]/20 text-[#E8834A]">
              {countQuality(blackMoves, '败') > 0 ? '中局受挫' : '稳健应对'}
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold xq-text-primary">{blackAcc}</div>
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

        {criticalMistakes.length === 0 ? (
          <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] text-xs xq-text-muted text-center">
            当前着法中暂未发现明显「缓着」或「败着」，双方应对稳健。
          </div>
        ) : (
          criticalMistakes.map((m) => {
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
                      (评分 {m.evalScore >= 0 ? `+${m.evalScore.toFixed(2)}` : m.evalScore.toFixed(2)})
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

                {m.comment && (
                  <p className="text-[11px] xq-text-secondary leading-relaxed">{m.comment}</p>
                )}

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
          })
        )}
      </div>
    </div>
  );
});
