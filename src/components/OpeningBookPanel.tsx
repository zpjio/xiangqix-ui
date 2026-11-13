import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightCircle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Compass,
  CornerDownLeft,
  Eye,
  GitFork,
  GraduationCap,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  Camp,
  MoveRecord,
  MultiPVArrow,
  OpeningBookCategory,
  OpeningBookNode,
  OpeningDrillProgress,
  OpeningDrillRuntime,
  OpeningPanelSubMode,
  OpeningPresetLine,
  Position,
} from '../types/xiangqi';
import { OPENING_PRESETS } from '../data/openingBook';

interface OpeningBookPanelProps {
  mode?: 'full' | 'compact';
  turn: Camp;
  currentPly: number;
  activeMoves: MoveRecord[];
  matchedNode: OpeningBookNode | null;
  lastMatchedInfo: {
    ply: number;
    openingName: string;
    category: string;
    matchKeyword: string;
  } | null;
  matchedLibraryCount: number;
  activeMatchKeyword: string;
  subMode: OpeningPanelSubMode;
  drillState: OpeningDrillRuntime;
  drillProgressMap: Record<string, OpeningDrillProgress>;
  onChangeSubMode: (mode: OpeningPanelSubMode) => void;
  onSelectOpeningMove: (from: Position, to: Position) => void;
  onHoverOpeningMove: (arrow: MultiPVArrow | null) => void;
  onJumpToPly: (ply: number) => void;
  onApplyOpeningPreset: (preset: OpeningPresetLine) => void;
  onOpenMatchingLibrary: (keyword: string) => void;
  onStartDrill: (preset: OpeningPresetLine, camp: Camp) => void;
  onShowDrillHint: () => void;
  onExitDrill: () => void;
  onTransferOpeningToStudy?: () => void;
  onGoToOpeningWorkspace?: () => void;
}

type CategoryFilter = 'all' | Exclude<OpeningBookCategory, '初始布局'>;

export const OpeningBookPanel: React.FC<OpeningBookPanelProps> = React.memo(({
  mode = 'full',
  turn,
  currentPly,
  activeMoves,
  matchedNode,
  lastMatchedInfo,
  matchedLibraryCount,
  activeMatchKeyword,
  subMode,
  drillState,
  drillProgressMap,
  onChangeSubMode,
  onSelectOpeningMove,
  onHoverOpeningMove,
  onJumpToPly,
  onApplyOpeningPreset,
  onOpenMatchingLibrary,
  onStartDrill,
  onShowDrillHint,
  onExitDrill,
  onTransferOpeningToStudy,
  onGoToOpeningWorkspace,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [drillCampChoice, setDrillCampChoice] = useState<Camp>(drillState.playerCamp);

  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'all') return OPENING_PRESETS;
    return OPENING_PRESETS.filter((p) => p.category === categoryFilter);
  }, [categoryFilter]);

  const completedPresetCount = useMemo(
    () =>
      OPENING_PRESETS.filter((p) => (drillProgressMap[p.id]?.completedCount || 0) > 0).length,
    [drillProgressMap]
  );

  const activeDrillPreset = useMemo(
    () => OPENING_PRESETS.find((p) => p.id === drillState.presetId) || OPENING_PRESETS[0],
    [drillState.presetId]
  );

  const visibleBreadcrumbs = useMemo(() => {
    const limit = Math.min(currentPly, activeMoves.length, 10);
    return activeMoves.slice(0, limit);
  }, [activeMoves, currentPly]);

  const getBadgeTextStyle = (badge?: string) => {
    switch (badge) {
      case '陷阱':
        return 'text-[var(--xq-accent-crimson)] font-semibold';
      case '激烈':
        return 'text-[var(--xq-accent-amber)] font-medium';
      case '主流':
        return 'text-[var(--xq-accent-jade)] font-medium';
      case '古谱':
        return 'text-[var(--xq-accent-gold)] font-medium';
      case '稳健':
      default:
        return 'xq-text-secondary';
    }
  };

  const drillTotalSteps = activeDrillPreset.moves.length;
  const drillProgressPct =
    drillTotalSteps > 0
      ? Math.min(100, Math.round((drillState.stepIndex / drillTotalSteps) * 100))
      : 0;
  const liveDrillAccuracy =
    drillState.attempts + drillState.mistakes > 0
      ? Math.max(
          0,
          Math.round(
            (drillState.attempts / (drillState.attempts + drillState.mistakes)) * 100
          )
        )
      : 100;

  const effectiveSubMode: OpeningPanelSubMode = mode === 'compact' ? 'explorer' : subMode;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-[0.8125rem]">
      {/* 顶部栏：独立工作台显示「定式树 / 变例对练」双态切换；复盘轻查询仅显示精简头部 */}
      {mode === 'full' ? (
        <div className="px-3.5 py-2 border-b xq-border bg-[var(--xq-bg-surface)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 p-0.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)]">
            <button
              type="button"
              onClick={() => onChangeSubMode('explorer')}
              className={`px-2.5 py-1 rounded-md text-[0.8125rem] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                effectiveSubMode === 'explorer'
                  ? 'xq-btn-option-active font-semibold'
                  : 'xq-text-secondary hover:text-[var(--xq-text-primary)]'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>定式树</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeSubMode('drill')}
              className={`px-2.5 py-1 rounded-md text-[0.8125rem] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                effectiveSubMode === 'drill'
                  ? 'xq-btn-option-active font-semibold'
                  : 'xq-text-secondary hover:text-[var(--xq-text-primary)]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>变例对练</span>
            </button>
          </div>

          {effectiveSubMode === 'explorer' ? (
            <button
              type="button"
              onClick={() => onOpenMatchingLibrary(activeMatchKeyword)}
              className="text-xs text-[var(--xq-accent-gold)] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 font-mono-tabular"
              title="前往棋谱库查阅同开局整局名局"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>同开局名局 ({matchedLibraryCount})</span>
            </button>
          ) : (
            <span className="text-xs font-mono-tabular xq-text-muted whitespace-nowrap shrink-0">
              已练通 {completedPresetCount} / {OPENING_PRESETS.length} 套
            </span>
          )}
        </div>
      ) : null}

      {effectiveSubMode === 'explorer' ? (
        <>
          {/* 着法路径面包屑（支持点击任意历史节点瞬间跳转） */}
          {visibleBreadcrumbs.length > 0 && (
            <div className="px-3.5 py-1.5 border-b xq-border bg-[var(--xq-bg-canvas)] flex items-center gap-1 overflow-x-auto no-scrollbar text-xs shrink-0">
              <button
                type="button"
                onClick={() => onJumpToPly(0)}
                className={`px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                  currentPly === 0
                    ? 'text-[var(--xq-accent-gold)] font-semibold'
                    : 'xq-text-muted hover:text-[var(--xq-text-primary)]'
                }`}
              >
                初始
              </button>
              {visibleBreadcrumbs.map((mv) => (
                <React.Fragment key={mv.ply}>
                  <span className="xq-text-muted shrink-0">›</span>
                  <button
                    type="button"
                    onClick={() => onJumpToPly(mv.ply)}
                    className={`px-1.5 py-0.5 rounded font-serif-sc cursor-pointer whitespace-nowrap shrink-0 ${
                      currentPly === mv.ply
                        ? 'bg-[var(--xq-bg-active)] text-[var(--xq-accent-gold)] font-semibold'
                        : 'xq-text-secondary hover:text-[var(--xq-text-primary)]'
                    }`}
                  >
                    {mv.ply}.{mv.notation}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* 当前盘面定式识别状态区 */}
          <div className="px-3.5 py-2.5 border-b xq-border bg-[var(--xq-bg-canvas)]/70 space-y-1.5 shrink-0">
            {matchedNode ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif-sc font-bold text-[0.9375rem] xq-text-primary truncate">
                    {matchedNode.openingName}
                  </span>
                  <span className="text-xs font-mono-tabular xq-text-muted shrink-0">
                    第 {matchedNode.plyDepth} 手定式
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs xq-text-secondary flex-wrap">
                  <span>{matchedNode.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    样本 {matchedNode.totalGames.toLocaleString()} 局
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>轮到{turn === 'red' ? '红方' : '黑方'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onOpenMatchingLibrary(matchedNode.matchKeyword)}
                    className="text-[var(--xq-accent-gold)] hover:underline cursor-pointer"
                  >
                    查同局谱 ({matchedLibraryCount}) →
                  </button>
                </div>

                <p className="text-[0.8125rem] xq-text-muted leading-relaxed">
                  {matchedNode.comment}
                </p>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm xq-text-secondary font-semibold">
                    <Compass className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                    <span>当前局面已脱离标准开局定式</span>
                  </div>
                  <span className="text-xs font-mono-tabular xq-text-muted shrink-0">
                    第 {currentPly} 手
                  </span>
                </div>
                <p className="text-[0.8125rem] xq-text-muted leading-relaxed">
                  {lastMatchedInfo
                    ? `已步入自由中盘较量（本谱最后命中定式：${lastMatchedInfo.openingName} · 第 ${lastMatchedInfo.ply} 手）。`
                    : '当前盘面非标准开局或已超出预设开局深度，可回退定式节点或点选下方开局体系重新研习。'}
                </p>
                {lastMatchedInfo && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onJumpToPly(lastMatchedInfo.ply)}
                      className="px-2.5 py-1 rounded-md xq-btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <CornerDownLeft className="w-3 h-3 text-[var(--xq-accent-gold)]" />
                      <span>
                        退回「{lastMatchedInfo.openingName}」（第 {lastMatchedInfo.ply} 手）
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenMatchingLibrary(lastMatchedInfo.matchKeyword)}
                      className="text-xs text-[var(--xq-accent-gold)] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      查棋谱库同体系 ({matchedLibraryCount}) →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 主体滚动区：流行后续着法表 + 体系骨架快速加载/对练入口 */}
          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--xq-border-subtle)]">
            {matchedNode && matchedNode.nextMoves.length > 0 ? (
              <>
                <div className="px-3.5 py-1.5 bg-[var(--xq-bg-surface)] flex items-center justify-between text-xs xq-text-muted">
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
                    className="w-full px-3.5 py-2 text-left hover:bg-[var(--xq-bg-hover)] transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-serif-sc font-bold text-sm shrink-0 ${
                            turn === 'red' ? 'text-[var(--xq-accent-crimson)]' : 'xq-text-primary'
                          }`}
                        >
                          {mv.notation}
                        </span>
                        <span className="text-[0.8125rem] xq-text-secondary truncate">
                          {mv.targetOpeningName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        {mv.badge && (
                          <span className={getBadgeTextStyle(mv.badge)}>{mv.badge}</span>
                        )}
                        <span className="font-mono-tabular font-semibold xq-text-primary min-w-[2.4rem] text-right">
                          {mv.frequencyPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[6rem] h-1.5 rounded-full overflow-hidden flex bg-[var(--xq-bg-canvas)] border border-[var(--xq-border-subtle)]">
                        <div
                          style={{ width: `${mv.redWinPct}%` }}
                          className="h-full bg-[var(--xq-eval-red)]"
                        />
                        <div
                          style={{ width: `${mv.drawPct}%` }}
                          className="h-full bg-[#7A756D]"
                        />
                        <div
                          style={{ width: `${mv.blackWinPct}%` }}
                          className="h-full bg-[var(--xq-eval-black)]"
                        />
                      </div>
                      <span className="text-xs font-mono-tabular xq-text-muted shrink-0">
                        红{mv.redWinPct}% · 和{mv.drawPct}% · 黑{mv.blackWinPct}%
                      </span>
                    </div>
                  </button>
                ))}
              </>
            ) : matchedNode ? (
              <div className="p-3.5 space-y-1.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium xq-text-secondary">
                  <GitFork className="w-4 h-4 text-[var(--xq-accent-gold)]" />
                  <span>已达当前定式末梢节点</span>
                </div>
                <p className="text-[0.8125rem] xq-text-muted leading-relaxed">
                  后续已全面转入中局争夺，可结合上方引擎推荐主变或查阅棋谱库同类实战继续深研。
                </p>
              </div>
            ) : null}

            {/* 完整模式显示 7 套主流骨架；复盘轻查询模式收敛为跳转「开局研习」引导 */}
            {mode === 'full' ? (
              <div className="p-3.5 space-y-2.5 bg-[var(--xq-bg-canvas)]/40">
                <div className="flex items-center justify-between text-[0.8125rem] font-medium xq-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                    <span>主流开局定式骨架</span>
                  </span>
                  <span className="text-xs font-mono-tabular xq-text-muted">
                    {filteredPresets.length} / {OPENING_PRESETS.length} 套
                  </span>
                </div>

                {/* 体系过滤按钮组 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: '全部' },
                      { id: '中炮体系', label: '中炮' },
                      { id: '仙人指路', label: '仙人指路' },
                      { id: '飞相局', label: '飞相局' },
                      { id: '起马局', label: '起马局' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer whitespace-nowrap shrink-0 ${
                        categoryFilter === cat.id ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {filteredPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-2.5 rounded-lg xq-btn-option flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyOpeningPreset(preset)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className="font-serif-sc font-semibold text-sm xq-text-primary truncate">
                          {preset.title}
                        </div>
                        <div className="text-xs xq-text-muted truncate mt-0.5 font-normal">
                          {preset.category} · {preset.difficulty} · {preset.moves.length} 手
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onApplyOpeningPreset(preset)}
                          className="px-2.5 py-1 rounded text-xs xq-btn-secondary cursor-pointer whitespace-nowrap"
                        >
                          载入
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartDrill(preset, drillCampChoice)}
                          className="px-2.5 py-1 rounded text-xs xq-btn-primary cursor-pointer whitespace-nowrap"
                        >
                          对练
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              onGoToOpeningWorkspace && (
                <div className="p-3.5 bg-[var(--xq-bg-canvas)]/40 space-y-2">
                  <div className="text-[0.8125rem] xq-text-secondary leading-relaxed">
                    复盘侧栏提供实时盘面定式查询与支线试走；如需浏览 7 套体系骨架或进行防剧透变例记忆对练，可前往专属「开局研习」工作台。
                  </div>
                  <button
                    type="button"
                    onClick={onGoToOpeningWorkspace}
                    className="w-full py-2 rounded-md xq-btn-secondary text-[0.8125rem] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                    <span>前往「开局研习」精练本体系 →</span>
                  </button>
                </div>
              )
            )}
          </div>
        </>
      ) : (
        /* ==================== 双态视图 B：变例对练模式 (Opening Drill) ==================== */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {drillState.status === 'idle' ? (
            <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3">
              {/* 执红/执黑选择 + 规则提示 */}
              <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[0.8125rem] xq-text-primary">选择对练执方</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDrillCampChoice('red')}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap ${
                        drillCampChoice === 'red' ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      执红先手练
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrillCampChoice('black')}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer whitespace-nowrap ${
                        drillCampChoice === 'black' ? 'xq-btn-option-active' : 'xq-btn-option'
                      }`}
                    >
                      执黑后手练
                    </button>
                  </div>
                </div>
                <p className="text-xs xq-text-muted leading-relaxed">
                  进入对练后自动隐藏棋盘引擎剧透箭头，系统模拟对手自动应招，请在左侧棋盘走出正确的定式回应。
                </p>
              </div>

              {/* 可对练定式路线列表 */}
              <div className="space-y-2">
                {OPENING_PRESETS.map((preset) => {
                  const prog = drillProgressMap[preset.id];
                  return (
                    <div
                      key={preset.id}
                      className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif-sc font-bold text-[0.9375rem] xq-text-primary truncate">
                          {preset.title}
                        </span>
                        {prog && prog.completedCount > 0 && (
                          <span className="text-xs text-[var(--xq-accent-jade)] font-mono-tabular font-semibold shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            最佳 {prog.bestAccuracyPct}%
                          </span>
                        )}
                      </div>

                      <div className="text-xs xq-text-secondary flex items-center gap-1.5 flex-wrap">
                        <span>{preset.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{preset.difficulty}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">全线 {preset.moves.length} 手</span>
                      </div>

                      <p className="text-[0.8125rem] xq-text-muted leading-relaxed">
                        {preset.summary}
                      </p>

                      <div className="pt-1 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenMatchingLibrary(preset.matchKeyword)}
                          className="text-xs xq-text-secondary hover:underline cursor-pointer whitespace-nowrap"
                        >
                          看同局名谱
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartDrill(preset, drillCampChoice)}
                          className="px-3 py-1 rounded-md xq-btn-primary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Play className="w-3 h-3" />
                          <span>开始对练</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 正在进行定式对练 / 错步提示 / 完成态 */
            <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3">
              {/* 当前对练进度面板 */}
              <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif-sc font-bold text-[0.9375rem] xq-text-primary truncate">
                    {activeDrillPreset.title}
                  </span>
                  <button
                    type="button"
                    onClick={onExitDrill}
                    className="text-xs xq-text-secondary hover:text-[var(--xq-text-primary)] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    切换定式
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs xq-text-secondary font-mono-tabular">
                  <span>
                    {drillState.playerCamp === 'red' ? '执红先手' : '执黑后手'} · 步序{' '}
                    {drillState.stepIndex} / {drillTotalSteps}
                  </span>
                  <span>一次命中率 {liveDrillAccuracy}%</span>
                </div>

                <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--xq-bg-surface)] border border-[var(--xq-border-subtle)]">
                  <div
                    style={{ width: `${drillProgressPct}%` }}
                    className="h-full bg-[var(--xq-accent-jade)] transition-[width] duration-200"
                  />
                </div>
              </div>

              {/* 实时对练反馈卡片 */}
              {drillState.status === 'completed' ? (
                <div className="p-3.5 rounded-lg border border-[var(--xq-accent-jade)]/50 bg-[var(--xq-accent-jade)]/10 space-y-2.5">
                  <div className="flex items-center gap-2 text-[var(--xq-accent-jade)] font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>定式通关！</span>
                  </div>
                  <p className="text-[0.8125rem] xq-text-primary leading-relaxed">
                    您已完整走出「{activeDrillPreset.title}」全线 {drillTotalSteps} 手变例，本次一次命中率{' '}
                    <span className="font-mono-tabular font-semibold">{liveDrillAccuracy}%</span>
                    {drillState.mistakes === 0 ? '（零失误完美掌握）' : `（期间修正 ${drillState.mistakes} 处）`}
                    。
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onStartDrill(activeDrillPreset, drillState.playerCamp)}
                      className="px-3 py-1.5 rounded-md xq-btn-primary text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>再练一遍</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExitDrill}
                      className="px-3 py-1.5 rounded-md xq-btn-secondary text-xs cursor-pointer whitespace-nowrap"
                    >
                      返回目录 / 自由拆棋
                    </button>
                  </div>
                </div>
              ) : drillState.status === 'mistake' ? (
                <div className="p-3 rounded-lg border border-[var(--xq-accent-crimson)]/50 bg-[var(--xq-accent-crimson)]/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-[var(--xq-accent-crimson)] text-sm font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>偏离定式主线</span>
                  </div>
                  <p className="text-[0.8125rem] leading-relaxed xq-text-primary">
                    {drillState.feedback}
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={onShowDrillHint}
                      className="px-2.5 py-1 rounded-md xq-btn-primary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3 h-3" />
                      <span>在棋盘提示正着</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartDrill(activeDrillPreset, drillState.playerCamp)}
                      className="px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>重开本线</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/8 space-y-1.5">
                  <div className="font-semibold text-sm text-[var(--xq-accent-gold)]">
                    {turn === drillState.playerCamp
                      ? `轮到您走棋（第 ${drillState.stepIndex + 1} 步）`
                      : '对方正在走出定式应手…'}
                  </div>
                  <p className="text-[0.8125rem] leading-relaxed xq-text-secondary">
                    {drillState.feedback ||
                      `请在左侧棋盘直接走子，延续「${activeDrillPreset.title}」定式。`}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onShowDrillHint}
                      className="px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3 h-3 text-[var(--xq-accent-gold)]" />
                      <span>提示此步</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartDrill(activeDrillPreset, drillState.playerCamp)}
                      className="px-2.5 py-1 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>重开</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 本线参考手数概览（仅揭示已走出手数，未走手数以「？」遮罩防剧透） */}
              <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-1.5">
                <div className="text-xs font-medium xq-text-secondary">
                  本定式进度轨迹（已走实着 / 待回忆步数）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeDrillPreset.moves.map((_, idx) => {
                    const playedMove = activeMoves[idx];
                    const isCurrent = idx === drillState.stepIndex && drillState.status !== 'completed';
                    return (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded border text-xs font-serif-sc ${
                          playedMove
                            ? 'border-[var(--xq-accent-jade)]/40 bg-[var(--xq-accent-jade)]/10 text-[var(--xq-accent-jade)]'
                            : isCurrent
                            ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                            : 'xq-border xq-text-muted'
                        }`}
                      >
                        {idx + 1}.{playedMove ? playedMove.notation : isCurrent ? '待走' : '···'}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 独立工作台底部固定交接 CTA：携带当前定式转入复盘分析（与残局/人机/摆子保持同一交接契约） */}
      {mode === 'full' && onTransferOpeningToStudy && (
        <div className="p-3.5 border-t xq-border bg-[var(--xq-bg-surface)] shrink-0">
          <button
            type="button"
            onClick={onTransferOpeningToStudy}
            className="w-full py-2.5 px-4 rounded-lg xq-btn-primary text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>
              {activeMoves.length > 0
                ? `携带 ${activeMoves.length} 手定式转入复盘分析`
                : '转入复盘分析（开启引擎深度算分）'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
});
