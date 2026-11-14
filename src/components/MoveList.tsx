import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookmarkPlus,
  BookMarked,
  BookOpen,
  Check,
  GitBranch,
  Pencil,
  RefreshCw,
  Sparkles,
  Star,
  Unplug,
  X,
} from 'lucide-react';
import { ExternalConnectState, GameMetadata, MoveQuality, MoveRecord } from '../types/xiangqi';

interface MoveListProps {
  mainMoves: MoveRecord[];
  variationMoves: MoveRecord[] | null;
  branchOriginPly: number | null;
  currentPly: number;
  metadata: GameMetadata;
  connectState?: ExternalConnectState;
  onSelectPly: (ply: number, useVariation?: boolean) => void;
  onPromoteVariationToMain: () => void;
  onDiscardVariation: () => void;
  onOpenGameInfo: () => void;
  onToggleFavorite: () => void;
  onSaveToLibrary?: () => void;
  canSaveToLibrary?: boolean;
  isExistingUserSave?: boolean;
  isLibraryLinked?: boolean;
  onOpenOpeningTab?: () => void;
  onLoadSampleGame: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: () => void;
  onOpenLibraryModal: () => void;
  onSyncNextExternalMove?: () => void;
  onDisconnectExternal?: () => void;
}

function getQualityBadgeStyle(q?: MoveQuality): string {
  switch (q) {
    case '妙':
      return 'text-[var(--xq-badge-best)] border-[var(--xq-badge-best)]/45 bg-[var(--xq-badge-best)]/12 font-semibold';
    case '优':
      return 'text-[var(--xq-badge-best)] border-[var(--xq-badge-best)]/30 bg-[var(--xq-badge-best)]/8';
    case '良':
      return 'xq-text-secondary border-[var(--xq-border-subtle)] bg-[var(--xq-bg-elevated)]';
    case '缓':
      return 'text-[var(--xq-badge-inaccuracy)] border-[var(--xq-badge-inaccuracy)]/40 bg-[var(--xq-badge-inaccuracy)]/12 font-medium';
    case '败':
      return 'text-[var(--xq-badge-blunder)] border-[var(--xq-badge-blunder)]/50 bg-[var(--xq-badge-blunder)]/15 font-semibold';
    default:
      return '';
  }
}

interface MoveRoundRowProps {
  roundNumber: number;
  isOddRow: boolean;
  redMove?: MoveRecord;
  blackMove?: MoveRecord;
  isRedSelected: boolean;
  isBlackSelected: boolean;
  activeRowRef?: React.RefObject<HTMLDivElement | null>;
  onSelectPly: (ply: number, useVariation?: boolean) => void;
}

const MoveRoundRow: React.FC<MoveRoundRowProps> = React.memo(({
  roundNumber,
  isOddRow,
  redMove,
  blackMove,
  isRedSelected,
  isBlackSelected,
  activeRowRef,
  onSelectPly,
}) => (
  <div
    ref={isRedSelected || isBlackSelected ? activeRowRef : undefined}
    className={`grid grid-cols-12 items-center px-2 ${
      isOddRow ? 'bg-[var(--xq-bg-canvas)]/45' : ''
    }`}
  >
    {/* 回合序号 */}
    <div className="col-span-2 py-1 text-center font-mono-tabular text-xs xq-text-muted">
      {roundNumber}.
    </div>

    {/* 红方着法单元格 */}
    <div className="col-span-5">
      {redMove && (
        <button
          type="button"
          onClick={() => onSelectPly(redMove.ply, false)}
          className={`w-full px-2 py-1 rounded-md text-left flex items-center justify-between gap-1 transition-colors cursor-pointer ${
            isRedSelected
              ? 'bg-[var(--xq-bg-active)] ring-1 ring-inset ring-[var(--xq-accent-gold)]'
              : 'hover:bg-[var(--xq-bg-hover)]'
          }`}
        >
          <span className="font-serif-sc font-bold text-sm text-[var(--xq-accent-crimson)] whitespace-nowrap">
            {redMove.notation}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {redMove.quality && (
              <span
                className={`px-1 py-0.5 text-xs leading-none rounded border ${getQualityBadgeStyle(
                  redMove.quality
                )}`}
              >
                {redMove.quality}
              </span>
            )}
            <span className="font-mono-tabular text-xs xq-text-secondary min-w-[2.4rem] text-right">
              {redMove.evalScore >= 0
                ? `+${redMove.evalScore.toFixed(1)}`
                : redMove.evalScore.toFixed(1)}
            </span>
          </div>
        </button>
      )}
    </div>

    {/* 黑方着法单元格 */}
    <div className="col-span-5">
      {blackMove ? (
        <button
          type="button"
          onClick={() => onSelectPly(blackMove.ply, false)}
          className={`w-full px-2 py-1 rounded-md text-left flex items-center justify-between gap-1 transition-colors cursor-pointer ${
            isBlackSelected
              ? 'bg-[var(--xq-bg-active)] ring-1 ring-inset ring-[var(--xq-accent-gold)]'
              : 'hover:bg-[var(--xq-bg-hover)]'
          }`}
        >
          <span className="font-serif-sc font-bold text-sm xq-text-primary whitespace-nowrap">
            {blackMove.notation}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {blackMove.quality && (
              <span
                className={`px-1 py-0.5 text-xs leading-none rounded border ${getQualityBadgeStyle(
                  blackMove.quality
                )}`}
              >
                {blackMove.quality}
              </span>
            )}
            <span className="font-mono-tabular text-xs xq-text-secondary min-w-[2.4rem] text-right">
              {blackMove.evalScore >= 0
                ? `+${blackMove.evalScore.toFixed(1)}`
                : blackMove.evalScore.toFixed(1)}
            </span>
          </div>
        </button>
      ) : (
        <div className="px-2 py-1 text-xs xq-text-muted">—</div>
      )}
    </div>
  </div>
));

export const MoveList: React.FC<MoveListProps> = React.memo(({
  mainMoves,
  variationMoves,
  branchOriginPly,
  currentPly,
  metadata,
  connectState,
  onSelectPly,
  onPromoteVariationToMain,
  onDiscardVariation,
  onOpenGameInfo,
  onToggleFavorite,
  onSaveToLibrary,
  canSaveToLibrary = true,
  isExistingUserSave = false,
  isLibraryLinked = false,
  onOpenOpeningTab,
  onLoadSampleGame,
  onOpenImportModal,
  onOpenExportModal,
  onOpenLibraryModal,
  onSyncNextExternalMove,
  onDisconnectExternal,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);

  // 将单列手数配对为「红黑双栏回合行」(Round 1: ply 1 Red + ply 2 Black)
  const rounds = useMemo(() => {
    const list: {
      roundNumber: number;
      redMove?: MoveRecord;
      blackMove?: MoveRecord;
    }[] = [];
    for (let i = 0; i < mainMoves.length; i += 2) {
      list.push({
        roundNumber: Math.floor(i / 2) + 1,
        redMove: mainMoves[i],
        blackMove: mainMoves[i + 1],
      });
    }
    return list;
  }, [mainMoves]);

  const activeMoveList = variationMoves || mainMoves;
  const activeMoveRecord = currentPly > 0 ? activeMoveList[currentPly - 1] : null;
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [currentPly]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 对局信息条：红方 vs 黑方 · 存局 · 收藏 · 导出 */}
      <div className="px-3.5 py-1.5 border-b xq-border flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] shrink-0">
        <button
          type="button"
          onClick={onOpenGameInfo}
          title="点击编辑对局信息（红黑棋手、赛事、开局与结果）"
          aria-label="编辑对局信息"
          className="text-left min-w-0 flex-1 group cursor-pointer flex items-center gap-1.5"
        >
          <span className="min-w-0 truncate group-hover:underline">
            <span className="font-semibold text-[var(--xq-accent-crimson)]">
              {metadata.redPlayer}
            </span>
            <span className="xq-text-muted mx-1.5">vs</span>
            <span className="font-semibold">{metadata.blackPlayer}</span>
            <span className="xq-text-muted mx-1.5">·</span>
            <span className="text-xs xq-text-secondary">{metadata.opening}</span>
          </span>
          <Pencil
            className="w-3 h-3 shrink-0 xq-text-muted opacity-70 group-hover:opacity-100 group-hover:text-[var(--xq-accent-gold)] transition-all"
            aria-hidden="true"
          />
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {onSaveToLibrary && (
            <button
              type="button"
              disabled={!canSaveToLibrary}
              onClick={() => {
                onSaveToLibrary();
                setSavedNotice(true);
                window.setTimeout(() => setSavedNotice(false), 1600);
              }}
              title={
                !canSaveToLibrary
                  ? '走子或导入局面后即可存入棋谱库'
                  : isExistingUserSave
                  ? '将当前新着法与修订更新至棋谱库中的本局'
                  : '将当前对局与全部着法保存至棋谱库「自存对局」'
              }
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 text-xs shrink-0 whitespace-nowrap ${
                canSaveToLibrary
                  ? 'xq-btn-secondary cursor-pointer'
                  : 'xq-btn-secondary opacity-45 cursor-not-allowed'
              }`}
            >
              {savedNotice ? (
                <Check className="w-3 h-3 text-[var(--xq-accent-jade)]" />
              ) : (
                <BookmarkPlus className="w-3 h-3 text-[var(--xq-accent-gold)]" />
              )}
              <span>
                {savedNotice ? '已入库' : isExistingUserSave ? '更新存局' : '存局'}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!isLibraryLinked}
            onClick={onToggleFavorite}
            aria-label={metadata.isFavorite ? '取消收藏' : '星标收藏'}
            title={
              !isLibraryLinked
                ? '请先点击左侧「存局」入库后再标记收藏'
                : metadata.isFavorite
                ? '已加入「我的收藏」（点击取消星标）'
                : '标记为「我的收藏」星标'
            }
            className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 text-xs shrink-0 whitespace-nowrap ${
              !isLibraryLinked
                ? 'xq-btn-secondary opacity-35 cursor-not-allowed'
                : metadata.isFavorite
                ? 'xq-btn-option-active cursor-pointer'
                : 'xq-btn-secondary cursor-pointer'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                metadata.isFavorite && isLibraryLinked ? 'fill-current' : 'xq-text-muted'
              }`}
            />
          </button>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              aria-label="导出当前对局"
              title="导出当前对局（.pgn / .fen / 微信文本棋谱）"
              className="px-1.5 py-0.5 rounded-md xq-btn-secondary cursor-pointer flex items-center gap-1 text-xs shrink-0 whitespace-nowrap"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 opacity-85" />
            </button>
          )}
        </div>
      </div>

      {/* 若处于外部平台连线观棋中，在棋谱顶部显示轻量连线同步条 */}
      {connectState?.connected && (
        <div className="px-3.5 py-1.5 border-b border-[var(--xq-accent-jade)]/40 bg-[var(--xq-accent-jade)]/10 flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] shrink-0">
          <div className="flex items-center gap-1.5 text-[var(--xq-accent-jade)] font-medium min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--xq-accent-jade)] animate-pulse shrink-0" />
            <span className="truncate">
              正在同步：{connectState.platformLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onSyncNextExternalMove}
              className="px-2 py-0.5 rounded-md xq-btn-engine-on text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3 h-3" />
              <span>同步下一手</span>
            </button>
            <button
              type="button"
              onClick={onDisconnectExternal}
              className="px-2 py-0.5 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Unplug className="w-3 h-3" />
              <span>断开</span>
            </button>
          </div>
        </div>
      )}

      {/* 若存在无感内联推演支线，在顶部显示推演支线控制台 */}
      {variationMoves && branchOriginPly !== null && (
        <div className="px-3.5 py-1.5 border-b border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] shrink-0">
          <div className="flex items-center gap-1.5 text-[var(--xq-accent-gold)] font-medium min-w-0">
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              自第 {branchOriginPly} 手分叉推演中（共 {variationMoves.length} 手）
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onPromoteVariationToMain}
              className="px-2 py-0.5 rounded-md xq-btn-primary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3 h-3" />
              <span>升为主线</span>
            </button>
            <button
              type="button"
              onClick={onDiscardVariation}
              className="px-2 py-0.5 rounded-md xq-btn-secondary text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3 h-3" />
              <span>回主谱</span>
            </button>
          </div>
        </div>
      )}

      {/* 棋谱表头（连续平整数据表格，对齐回合、红方着法/评估、黑方着法/评估） */}
      <div className="grid grid-cols-12 items-center px-3 py-1 border-b xq-border bg-[var(--xq-bg-canvas)] text-xs font-medium xq-text-muted shrink-0">
        <div className="col-span-2 text-center">回合</div>
        <div className="col-span-5 px-2 flex items-center justify-between">
          <span>红方着法</span>
          <span>评估</span>
        </div>
        <div className="col-span-5 px-2 flex items-center justify-between">
          <span>黑方着法</span>
          <span>评估</span>
        </div>
      </div>

      {/* 双栏回合制着法表格主体 */}
      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--xq-border-subtle)] text-[0.8125rem]">
        {/* 0. 初始阵列行 */}
        <button
          type="button"
          onClick={() => onSelectPly(0, false)}
          className={`w-full px-3.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
            currentPly === 0
              ? 'bg-[var(--xq-bg-active)] font-semibold text-[var(--xq-accent-gold)]'
              : 'hover:bg-[var(--xq-bg-hover)] xq-text-secondary'
          }`}
        >
          <span>0. 初始棋盘（32子标准开局）</span>
          <span className="font-mono-tabular text-xs xq-text-muted">+0.25</span>
        </button>

        {/* 空棋谱快捷起点引导（首次进入标准开局或新局时显示） */}
        {rounds.length === 0 && !variationMoves && (
          <div className="p-3.5 space-y-2.5">
            <div className="p-3 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2">
              <div className="font-medium text-sm xq-text-primary">
                已就绪，可从以下任意方式开始拆棋复盘：
              </div>
              <p className="text-xs xq-text-muted leading-relaxed">
                直接在左侧棋盘走子，或点击上方引擎推荐着法「试走」；进度将自动保存在本地。
              </p>
              <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={onLoadSampleGame}
                  className="w-full px-2.5 py-1.5 rounded-md xq-btn-option-active text-[0.8125rem] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">载入示范名局（王天一 vs 郑惟桐）</span>
                  </span>
                  <span className="text-xs opacity-80 shrink-0">12手含批注</span>
                </button>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenOpeningTab}
                    className="px-2 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <BookMarked className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                    <span>开局定式</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="px-2 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 opacity-85" />
                    <span>导入 / 识盘</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLibraryModal}
                    className="px-2 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
                    <span>棋谱库</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rounds.map((r, idx) => {
          const isRedSelected =
            !variationMoves && r.redMove && currentPly === r.redMove.ply;
          const isBlackSelected =
            !variationMoves && r.blackMove && currentPly === r.blackMove.ply;

          const showBranchHere =
            variationMoves &&
            branchOriginPly !== null &&
            (r.redMove?.ply === branchOriginPly || r.blackMove?.ply === branchOriginPly);

          return (
            <React.Fragment key={`round-${r.roundNumber}`}>
              <MoveRoundRow
                roundNumber={r.roundNumber}
                isOddRow={idx % 2 === 1}
                redMove={r.redMove}
                blackMove={r.blackMove}
                isRedSelected={!!isRedSelected}
                isBlackSelected={!!isBlackSelected}
                activeRowRef={isRedSelected || isBlackSelected ? activeRowRef : undefined}
                onSelectPly={onSelectPly}
              />

              {/* 内联推演支线展示盒 (紧贴分叉回合下方展开) */}
              {showBranchHere && variationMoves && (
                <div className="mx-3 my-1 p-2 rounded-lg border border-[var(--xq-accent-gold)]/50 bg-[var(--xq-accent-gold)]/10 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--xq-accent-gold)]">
                    <span className="flex items-center gap-1 font-medium">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>内联推演支线（盘面落子自动生成）：</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {variationMoves.slice(branchOriginPly).map((vm) => (
                      <button
                        key={`var-ply-${vm.ply}`}
                        type="button"
                        onClick={() => onSelectPly(vm.ply, true)}
                        className={`px-2 py-0.5 rounded text-[0.8125rem] font-serif-sc font-bold border transition-colors cursor-pointer ${
                          currentPly === vm.ply
                            ? 'bg-[var(--xq-btn-primary-bg)] text-[var(--xq-btn-primary-text)] border-[var(--xq-btn-primary-border)]'
                            : 'bg-[var(--xq-bg-surface)] xq-border hover:border-[var(--xq-accent-gold)]'
                        }`}
                      >
                        {vm.ply}手·{vm.notation}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 底部：当前手战术批注与正着提示卡 */}
      <div className="px-3.5 py-2 border-t xq-border bg-[var(--xq-bg-canvas)] text-[0.8125rem] shrink-0">
        {activeMoveRecord ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-serif-sc font-bold text-[0.8125rem]">
                第 {activeMoveRecord.ply} 手 · {activeMoveRecord.notation}
              </span>
              {activeMoveRecord.bestAlternative && (
                <span className="text-xs text-[var(--xq-accent-jade)] font-medium">
                  推荐正着：{activeMoveRecord.bestAlternative}
                </span>
              )}
            </div>
            <p className="text-xs xq-text-secondary leading-snug line-clamp-2">
              {activeMoveRecord.comment ||
                '双方在此处平稳运子，可在任意历史手直接在棋盘走子生成推演分支。'}
            </p>
          </div>
        ) : (
          <p className="text-xs xq-text-muted">
            开局整阵就绪 · 点击棋盘任意棋子或右侧变例即可自然推演
          </p>
        )}
      </div>
    </div>
  );
});
