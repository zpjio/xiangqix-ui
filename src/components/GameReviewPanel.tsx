import React, { useMemo } from 'react';
import { FileCode2, Play, RotateCcw, Sparkles, Square, Target } from 'lucide-react';
import { getMoveQualityAccuracyScore } from '../constants/xiangqiConstants';
import {
  BatchReviewPreset,
  BatchReviewProgressEvent,
  MoveRecord,
} from '../types/xiangqi';
import { EvalGraph } from './EvalGraph';

interface GameReviewPanelProps {
  moves: MoveRecord[];
  currentPly: number;
  retryMistakePly: number | null;
  retryFeedback: string | null;
  batchReviewPreset: BatchReviewPreset;
  batchReviewProgress: BatchReviewProgressEvent | null;
  hasScannedCurrentGame: boolean;
  onChangeBatchReviewPreset: (preset: BatchReviewPreset) => void;
  onStartBatchReview: () => void;
  onCancelBatchReview: () => void;
  onJumpPly: (ply: number) => void;
  onStartRetryMistake: (mistakeMove: MoveRecord) => void;
  onDemoBestAlternative: (mistakeMove: MoveRecord) => void;
  onLoadSampleGame: () => void;
  onOpenImportModal: () => void;
}

function calcCampAccuracy(list: MoveRecord[]): string {
  if (list.length === 0) return '—';
  const total = list.reduce(
    (sum, m) => sum + getMoveQualityAccuracyScore(m.quality),
    0
  );
  return `${(total / list.length).toFixed(1)}%`;
}

export const GameReviewPanel: React.FC<GameReviewPanelProps> = React.memo(({
  moves,
  currentPly,
  retryMistakePly,
  retryFeedback,
  batchReviewPreset,
  batchReviewProgress,
  hasScannedCurrentGame,
  onChangeBatchReviewPreset,
  onStartBatchReview,
  onCancelBatchReview,
  onJumpPly,
  onStartRetryMistake,
  onDemoBestAlternative,
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
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col justify-center items-center text-center space-y-3 text-[0.8125rem]">
        <div className="w-10 h-10 rounded-full border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-center text-[var(--xq-accent-gold)]">
          <Target className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-[18rem]">
          <div className="font-semibold text-[0.9375rem] xq-text-primary">暂无对局着法记录</div>
          <p className="text-xs xq-text-muted leading-relaxed">
            在棋盘走子、导入 FEN/PGN/XQF 棋谱，或载入名局后，即可一键整局自动复盘并生成双边精准度与败着重练报告。
          </p>
        </div>
        <div className="flex flex-col w-full max-w-[17rem] gap-2 pt-1">
          <button
            type="button"
            onClick={onLoadSampleGame}
            className="w-full px-3 py-1.5 rounded-md xq-btn-primary text-[0.8125rem] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>载入示范名局（体验复盘与重练）</span>
          </button>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="w-full px-3 py-1.5 rounded-md xq-btn-secondary text-[0.8125rem] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 opacity-80" />
            <span>导入 PGN / XQF / FEN 棋谱</span>
          </button>
        </div>
      </div>
    );
  }

  const isScanning = batchReviewProgress?.status === 'running';
  const scanPercent =
    batchReviewProgress && batchReviewProgress.totalPlies > 0
      ? Math.round(
          (batchReviewProgress.completedPlies / batchReviewProgress.totalPlies) * 100
        )
      : 0;

  return (
    <div className="min-[900px]:flex-1 min-[900px]:overflow-y-auto no-scrollbar p-3 space-y-3 text-[0.8125rem]">
      {/* 0. 一键整局自动复盘操作栏与扫描进度条 */}
      <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isScanning}
              onClick={() => onChangeBatchReviewPreset('fast')}
              className={`min-h-[36px] min-[900px]:min-h-0 px-2.5 min-[900px]:px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-55 ${
                batchReviewPreset === 'fast'
                  ? 'xq-btn-option-active font-semibold'
                  : 'xq-btn-option'
              }`}
            >
              快析 (12层)
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => onChangeBatchReviewPreset('deep')}
              className={`min-h-[36px] min-[900px]:min-h-0 px-2.5 min-[900px]:px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-55 ${
                batchReviewPreset === 'deep'
                  ? 'xq-btn-option-active font-semibold'
                  : 'xq-btn-option'
              }`}
            >
              精析 (18层)
            </button>
          </div>

          {isScanning ? (
            <button
              type="button"
              onClick={onCancelBatchReview}
              className="min-h-[36px] min-[900px]:min-h-0 px-2.5 py-1 rounded-md xq-btn-danger text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>停止扫描</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartBatchReview}
              className="min-h-[36px] min-[900px]:min-h-0 px-3 py-1 rounded-md xq-btn-primary text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{hasScannedCurrentGame ? '重新整局复盘' : '一键整局复盘'}</span>
            </button>
          )}
        </div>

        {isScanning && batchReviewProgress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono-tabular">
              <span className="text-[var(--xq-accent-gold)] font-medium">
                正在{batchReviewProgress.preset === 'deep' ? '精析' : '快析'}扫描第{' '}
                {batchReviewProgress.completedPlies}/{batchReviewProgress.totalPlies} 手…
              </span>
              <span className="xq-text-muted">
                {scanPercent}% · 余{' '}
                {(batchReviewProgress.estimatedRemainingMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--xq-bg-elevated)] border xq-border overflow-hidden">
              <div
                className="h-full bg-[var(--xq-accent-gold)] transition-all duration-150"
                style={{ width: `${scanPercent}%` }}
              />
            </div>
          </div>
        )}

        {!isScanning && hasScannedCurrentGame && (
          <div className="text-xs text-[var(--xq-accent-jade)] font-mono-tabular flex items-center justify-between gap-2">
            <span>
              已完成{batchReviewPreset === 'deep' ? '精析' : '快析'}扫描 · 共 {moves.length} 手
            </span>
            <span className="xq-text-muted">按胜率差自动评级</span>
          </div>
        )}
      </div>

      {/* 1. 红黑双方整局精准度对比 (Accuracy %) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="xq-text-secondary font-medium">红方精准度</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--xq-accent-crimson)]/12 text-[var(--xq-accent-crimson)]">
              {redErrors === 0 ? '主控全局' : `失误 ${redErrors}`}
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold text-[var(--xq-accent-crimson)]">
            {redAcc}
          </div>
          <div className="text-xs xq-text-muted flex items-center gap-1.5 flex-wrap font-mono-tabular">
            <span>妙 {countQuality(redMoves, '妙')}</span>
            <span>·</span>
            <span>优 {countQuality(redMoves, '优')}</span>
            <span>·</span>
            <span>失误 {redErrors}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="xq-text-secondary font-medium">黑方精准度</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--xq-accent-amber)]/15 text-[var(--xq-accent-amber)]">
              {countQuality(blackMoves, '败') > 0 ? '中局受挫' : '稳健应对'}
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-bold xq-text-primary">{blackAcc}</div>
          <div className="text-xs xq-text-muted flex items-center gap-1.5 flex-wrap font-mono-tabular">
            <span>优 {countQuality(blackMoves, '优')}</span>
            <span>·</span>
            <span>缓 {countQuality(blackMoves, '缓')}</span>
            <span>·</span>
            <span className="text-[var(--xq-accent-crimson)]">败 {countQuality(blackMoves, '败')}</span>
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
        <div className="p-2.5 rounded-lg border border-[var(--xq-accent-gold)] bg-[var(--xq-accent-gold)]/15 text-[0.8125rem] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--xq-accent-gold)] shrink-0" />
          <span className="font-medium">{retryFeedback}</span>
        </div>
      )}

      {/* 4. 胜负手与败着诊断列表（支持一键「在此手重练」） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-sm xq-text-secondary flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
            <span>关键失误复盘 ({criticalMistakes.length})</span>
          </span>
          <span className="text-xs xq-text-muted">点击「重练此手」回到失误前</span>
        </div>

        {criticalMistakes.length === 0 ? (
          <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] text-[0.8125rem] xq-text-muted text-center">
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
                    ? 'border-[var(--xq-accent-gold)] bg-[var(--xq-accent-gold)]/10'
                    : 'xq-border bg-[var(--xq-bg-canvas)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onJumpPly(m.ply)}
                    className="flex items-center gap-2 text-left hover:underline cursor-pointer flex-wrap"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                        m.quality === '败'
                          ? 'bg-[var(--xq-eval-red)] text-[#F4EFE2]'
                          : 'bg-[var(--xq-accent-amber)]/20 text-[var(--xq-accent-amber)] border border-[var(--xq-accent-amber)]/45'
                      }`}
                    >
                      {m.quality}着
                    </span>
                    <span className="font-mono-tabular text-xs xq-text-muted">
                      第{m.ply}手
                    </span>
                    <span className="font-serif-sc font-bold text-[0.9375rem]">{m.notation}</span>
                    <span className="font-mono-tabular text-xs text-[var(--xq-accent-crimson)]">
                      (评分 {m.evalScore >= 0 ? `+${m.evalScore.toFixed(2)}` : m.evalScore.toFixed(2)})
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
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
                  <p className="text-[0.8125rem] xq-text-secondary leading-relaxed">{m.comment}</p>
                )}

                {m.bestAlternative && m.bestFrom && m.bestTo && (
                  <div className="pt-1.5 border-t xq-border flex items-center justify-between gap-2 text-xs flex-wrap">
                    <span className="xq-text-muted">
                      推荐正着：
                      <strong className="font-serif-sc text-[var(--xq-accent-jade)] ml-1">
                        {m.bestAlternative}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onDemoBestAlternative(m)}
                      className="text-[var(--xq-accent-gold)] hover:underline cursor-pointer py-1 min-[900px]:py-0"
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
