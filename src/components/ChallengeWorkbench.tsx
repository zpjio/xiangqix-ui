import React, { useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  Award,
  CheckCircle2,
  Compass,
  RotateCcw,
  Search,
} from 'lucide-react';
import { ClassicalChallengeItem } from '../types/xiangqi';
import { ThemeSelect } from './ThemeSelect';

interface ChallengeWorkbenchProps {
  challenges: ClassicalChallengeItem[];
  selectedChallengeId: string;
  solvedChallengeIds: string[];
  challengeStatusBanner: string | null;
  movesCount: number;
  onSelectChallenge: (id: string) => void;
  onToggleChallengeSolved: (id: string) => void;
  onTransferChallengeToStudy: () => void;
}

type DifficultyFilter = 'all' | '★★☆ · 进阶' | '★★★ · 高难' | '★★★★ · 绝杀';

export const ChallengeWorkbench: React.FC<ChallengeWorkbenchProps> = React.memo(({
  challenges,
  selectedChallengeId,
  solvedChallengeIds,
  challengeStatusBanner,
  movesCount,
  onSelectChallenge,
  onToggleChallengeSolved,
  onTransferChallengeToStudy,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [onlyUnsolved, setOnlyUnsolved] = useState(false);

  const solvedSet = useMemo(() => new Set(solvedChallengeIds), [solvedChallengeIds]);

  const bookOptions = useMemo(() => {
    const books = Array.from(new Set(challenges.map((c) => c.bookSeries)));
    return books;
  }, [challenges]);

  const solvedCount = useMemo(
    () => challenges.filter((c) => solvedSet.has(c.id)).length,
    [challenges, solvedSet]
  );

  const completionPct =
    challenges.length > 0 ? Math.round((solvedCount / challenges.length) * 100) : 0;

  const filteredChallenges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return challenges.filter((ch) => {
      if (selectedBook !== 'all' && ch.bookSeries !== selectedBook) return false;
      if (difficultyFilter !== 'all' && ch.difficulty !== difficultyFilter) return false;
      if (onlyUnsolved && solvedSet.has(ch.id)) return false;
      if (q) {
        return (
          ch.title.toLowerCase().includes(q) ||
          ch.sourceBook.toLowerCase().includes(q) ||
          ch.objective.toLowerCase().includes(q) ||
          ch.lore.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [challenges, selectedBook, difficultyFilter, onlyUnsolved, searchQuery, solvedSet]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBook('all');
    setDifficultyFilter('all');
    setOnlyUnsolved(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-[0.8125rem]">
      {/* 顶部固定：标题与破关总进度 */}
      <div className="px-3.5 py-2.5 border-b xq-border space-y-2 shrink-0 bg-[var(--xq-bg-surface)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[var(--xq-accent-gold)] shrink-0" />
            <span className="font-semibold text-[0.9375rem] whitespace-nowrap">经典残局题库</span>
          </div>
          <span className="text-xs font-mono-tabular xq-text-secondary whitespace-nowrap">
            已破关 {solvedCount} / {challenges.length} 关 · {completionPct}%
          </span>
        </div>

        {/* 紧凑单层破关进度条 */}
        <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--xq-bg-canvas)] border border-[var(--xq-border-subtle)]">
          <div
            style={{ width: `${completionPct}%` }}
            className="h-full bg-[#10B981] transition-[width] duration-200"
          />
        </div>

        {/* 搜索 + 典籍筛选 */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 xq-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索残局名称、典籍或杀法…"
              className="w-full pl-8 pr-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] text-[0.8125rem] focus:outline-none focus:border-[var(--xq-accent-gold)]"
            />
          </div>

          <div className="w-[9rem] shrink-0">
            <ThemeSelect
              ariaLabel="按古谱典籍筛选"
              value={selectedBook}
              onChange={setSelectedBook}
              menuAlign="right"
              triggerClassName="px-2 py-1.5"
              menuMinWidthClass="min-w-[10.5rem]"
              options={[
                { value: 'all', label: `全部典籍 (${challenges.length})` },
                ...bookOptions.map((book) => ({
                  value: book,
                  label: `${book} (${challenges.filter((c) => c.bookSeries === book).length})`,
                })),
              ]}
            />
          </div>
        </div>

        {/* 难度分段筛选 + 仅看未破 */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'all', label: '全部' },
                { id: '★★☆ · 进阶', label: '进阶' },
                { id: '★★★ · 高难', label: '高难' },
                { id: '★★★★ · 绝杀', label: '绝杀' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficultyFilter(d.id)}
                className={`px-2 py-0.5 rounded text-xs cursor-pointer whitespace-nowrap ${
                  difficultyFilter === d.id ? 'xq-btn-option-active' : 'xq-btn-option'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyUnsolved((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-xs cursor-pointer whitespace-nowrap ${
              onlyUnsolved ? 'xq-btn-option-active' : 'xq-btn-option'
            }`}
          >
            仅看未破 ({challenges.length - solvedCount})
          </button>
        </div>
      </div>

      {/* 中部可滚动：残局列表 + 破局实时反馈卡 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs xq-text-muted px-0.5">
          <span className="font-mono-tabular">
            当前显示 {filteredChallenges.length} / {challenges.length} 关
          </span>
          <span>支招/重摆见棋盘底栏</span>
        </div>

        {filteredChallenges.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-2 border xq-border rounded-lg bg-[var(--xq-bg-canvas)]">
            <p className="xq-text-muted">当前筛选条件下暂无匹配残局</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1 rounded-md xq-btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>清除筛选条件</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChallenges.map((ch) => {
              const isSelected = ch.id === selectedChallengeId;
              const isSolved = solvedSet.has(ch.id);
              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectChallenge(ch.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectChallenge(ch.id);
                    }
                  }}
                  className={`w-full p-3 rounded-lg text-left cursor-pointer space-y-1 transition-colors ${
                    isSelected ? 'xq-btn-option-active' : 'xq-btn-option'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif-sc font-bold text-[0.9375rem] truncate">
                      {ch.title}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleChallengeSolved(ch.id);
                        }}
                        title={isSolved ? '点击重置为未破关' : '手动标记为已破关'}
                        className={`flex items-center gap-1 text-xs cursor-pointer hover:underline ${
                          isSolved ? 'text-[#10B981] font-semibold' : 'xq-text-muted'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isSolved ? '已破关' : '待破'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 无胶囊纯文本元数据分隔行 */}
                  <div className="text-xs xq-text-secondary font-normal flex items-center gap-1.5 flex-wrap">
                    <span>{ch.sourceBook}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ch.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">约 {ch.expectedPlies} 手杀</span>
                  </div>

                  <div className="text-[0.8125rem] text-[var(--xq-accent-gold)] font-medium">
                    {ch.objective}
                  </div>
                  <p className="text-xs xq-text-muted leading-relaxed font-normal line-clamp-2">
                    {ch.lore}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* 破局实时反馈与提示卡 */}
        {challengeStatusBanner && (
          <div className="p-2.5 rounded-lg border border-[var(--xq-accent-gold)]/50 bg-[var(--xq-accent-gold)]/10 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--xq-accent-gold)]">
              <Award className="w-4 h-4" />
              <span>破局提示</span>
            </div>
            <p className="text-[0.8125rem] leading-relaxed">{challengeStatusBanner}</p>
          </div>
        )}
      </div>

      {/* 底部主行动区：携残局局面与试走着法转入复盘分析 */}
      <div className="p-3.5 border-t xq-border shrink-0 bg-[var(--xq-bg-surface)]">
        <button
          type="button"
          onClick={onTransferChallengeToStudy}
          className="w-full py-2.5 px-4 rounded-lg xq-btn-primary text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <ArrowRightCircle className="w-4 h-4" />
          <span>
            {movesCount > 0
              ? `携带 ${movesCount} 手试走转入复盘分析`
              : '转入复盘分析'}
          </span>
        </button>
      </div>
    </div>
  );
});
