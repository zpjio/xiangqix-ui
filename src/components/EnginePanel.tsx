import React from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Download,
  FolderOpen,
  GitCompare,
  Play,
  Radar,
  Square,
  Zap,
} from 'lucide-react';
import { EngineProfile, MultiPVArrow, MultiPVLine, Position } from '../types/xiangqi';

interface EnginePanelProps {
  engines: EngineProfile[];
  primaryEngineId: string;
  secondaryEngineId: string;
  compareMode: boolean;
  isAnalyzing: boolean;
  threatRadarEnabled: boolean;
  primaryLines: MultiPVLine[];
  secondaryLines: MultiPVLine[];
  onChangePrimaryEngine: (id: string) => void;
  onChangeSecondaryEngine: (id: string) => void;
  onToggleCompareMode: () => void;
  onInstallEngine: (id: string) => void;
  onOpenEngineSettings: () => void;
  onToggleAnalysis: () => void;
  onToggleThreatRadar: () => void;
  onSelectMultiPVMove: (from: Position, to: Position) => void;
  onHoverMultiPVMove: (arrow: MultiPVArrow | null) => void;
}

export const EnginePanel: React.FC<EnginePanelProps> = ({
  engines,
  primaryEngineId,
  secondaryEngineId,
  compareMode,
  isAnalyzing,
  threatRadarEnabled,
  primaryLines,
  secondaryLines,
  onChangePrimaryEngine,
  onChangeSecondaryEngine,
  onToggleCompareMode,
  onInstallEngine,
  onOpenEngineSettings,
  onToggleAnalysis,
  onToggleThreatRadar,
  onSelectMultiPVMove,
  onHoverMultiPVMove,
}) => {
  const primaryEngine =
    engines.find((e) => e.id === primaryEngineId) || engines[0];
  const secondaryEngine =
    engines.find((e) => e.id === secondaryEngineId) ||
    engines.find((e) => e.id !== primaryEngine.id) ||
    engines[0];

  const primaryTop = primaryLines[0];
  const secondaryTop = secondaryLines[0];

  const isConsensus =
    compareMode &&
    primaryTop &&
    secondaryTop &&
    primaryTop.firstMove.from.row === secondaryTop.firstMove.from.row &&
    primaryTop.firstMove.from.col === secondaryTop.firstMove.from.col &&
    primaryTop.firstMove.to.row === secondaryTop.firstMove.to.row &&
    primaryTop.firstMove.to.col === secondaryTop.firstMove.to.col;

  const evalDiff =
    primaryTop && secondaryTop
      ? Math.abs(primaryTop.scoreCp - secondaryTop.scoreCp).toFixed(2)
      : '0.00';

  const formatScore = (cp: number) => (cp >= 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2));

  return (
    <section className="flex flex-col border-b xq-border shrink-0">
      {/* 引擎舱顶栏：左侧启动开关 + 主引擎快选下拉；右侧双擎对比开关 + 威胁雷达 */}
      <div className="px-3.5 py-1.5 border-b xq-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {primaryEngine.status === 'ready' ? (
            <button
              type="button"
              onClick={onToggleAnalysis}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                isAnalyzing ? 'xq-btn-engine-on shadow-2xs' : 'xq-btn-secondary'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>分析中</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>启动</span>
                </>
              )}
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 text-[var(--xq-accent-gold)] font-medium flex items-center gap-1 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              <span>待安装</span>
            </span>
          )}

          {/* 主引擎快速切换器 */}
          <select
            aria-label="选择主分析引擎"
            value={primaryEngine.id}
            onChange={(e) => onChangePrimaryEngine(e.target.value)}
            className="px-2 py-1 rounded-md text-xs font-medium border xq-border bg-[var(--xq-bg-canvas)] xq-text-primary cursor-pointer focus:outline-none focus:border-[var(--xq-accent-gold)] min-w-0 max-w-[148px] truncate"
          >
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.shortName} [{eng.protocol}]{eng.status !== 'ready' ? ' (未装)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 右侧：双擎对比开关 + 威胁雷达开关（无重复设置按钮，彻底消除文字重叠） */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleCompareMode}
            title="开启双引擎并行对比（翠绿主擎 vs 天青蓝副擎，自动诊断双擎共识与分歧）"
            className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              compareMode ? 'xq-btn-option-active' : 'xq-btn-secondary'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>双擎对比</span>
          </button>

          <button
            type="button"
            onClick={onToggleThreatRadar}
            title="开启后在棋盘用红色虚线标出对方下一步最具威胁的攻着"
            className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              threatRadarEnabled ? 'xq-btn-danger font-semibold' : 'xq-btn-secondary'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>威胁</span>
          </button>
        </div>
      </div>

      {/* 主体：若主引擎未安装或安装中，呈现一键下载引导 */}
      {primaryEngine.status === 'missing' ? (
        <div className="p-3 space-y-2 bg-[var(--xq-bg-canvas)]/60">
          <div className="space-y-1">
            <div className="text-xs font-semibold xq-text-primary flex items-center justify-between">
              <span>未检测到本地「{primaryEngine.name}」组件</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded border xq-border xq-text-secondary font-mono-tabular">
                {primaryEngine.protocol} · {primaryEngine.styleLabel}
              </span>
            </div>
            <p className="text-xs xq-text-secondary leading-relaxed">
              该引擎需配置核心可执行程序与{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--xq-bg-elevated)] border xq-border font-mono-tabular text-[11px]">
                {primaryEngine.nnueFile}
              </code>{' '}
              神经网络权重文件后方可启动分析。
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onInstallEngine(primaryEngine.id)}
              className="flex-1 py-1.5 px-3 rounded-md xq-btn-primary text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                一键下载并安装 {primaryEngine.shortName} ({primaryEngine.sizeMb}MB)
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenEngineSettings}
              className="py-1.5 px-3 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-80" />
              <span>引擎库管理</span>
            </button>
          </div>
        </div>
      ) : primaryEngine.status === 'installing' ? (
        <div className="p-3 space-y-2 bg-[var(--xq-bg-canvas)]/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold xq-text-primary">
              {primaryEngine.installProgress < 45
                ? `1/3 正在下载 ${primaryEngine.name} 核心程序…`
                : primaryEngine.installProgress < 85
                ? `2/3 正在校验 ${primaryEngine.nnueFile} 神经网络权重…`
                : `3/3 正在完成 ${primaryEngine.protocol} 协议握手与算力初始化…`}
            </span>
            <span className="font-mono-tabular font-bold text-[var(--xq-accent-gold)]">
              {primaryEngine.installProgress}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--xq-bg-elevated)] border xq-border overflow-hidden">
            <div
              className="h-full bg-[var(--xq-btn-primary-bg)] transition-all duration-150"
              style={{ width: `${primaryEngine.installProgress}%` }}
            />
          </div>
          <p className="text-xs xq-text-muted">
            安装完成后将自动载入引擎库并开启实时主变分析
          </p>
        </div>
      ) : !isAnalyzing || primaryLines.length === 0 ? (
        <div className="py-2.5 px-3.5 flex items-center justify-between gap-3 text-xs xq-text-muted">
          <span className="truncate">
            {primaryEngine.name} 已就绪（待命），点击启动实时计算
          </span>
          <button
            type="button"
            onClick={onToggleAnalysis}
            className="px-3 py-1 rounded-md xq-btn-primary text-xs cursor-pointer shrink-0"
          >
            立即分析
          </button>
        </div>
      ) : !compareMode ? (
        /* ==================== 单引擎标准模式 ==================== */
        <div className="p-2.5 space-y-1.5">
          {/* 顶部一行局势定性语 + 引擎风格标签 + 深度算力指标 + 评分 */}
          <div className="px-2.5 py-1 rounded-md border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono-tabular bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shrink-0">
                {primaryEngine.shortName}·{primaryEngine.styleLabel}
              </span>
              <span className="font-medium xq-text-primary truncate">
                {primaryTop.summaryText}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono-tabular">
              <span className="text-[11px] xq-text-muted">
                d={primaryTop.depth}·{primaryTop.nps}k
              </span>
              <span className="font-bold text-[13px] text-[#10B981]">
                {formatScore(primaryTop.scoreCp)}
              </span>
            </div>
          </div>

          {/* 候选变例列表 */}
          <div className="space-y-1">
            {primaryLines.map((line) => (
              <button
                key={`multipv-${line.multipv}`}
                type="button"
                onMouseEnter={() =>
                  onHoverMultiPVMove({
                    rank: line.multipv,
                    from: line.firstMove.from,
                    to: line.firstMove.to,
                    scoreText: `预览 ${line.firstMove.notation}`,
                    notation: line.firstMove.notation,
                    isGhostPreview: true,
                  })
                }
                onMouseLeave={() => onHoverMultiPVMove(null)}
                onClick={() => {
                  onHoverMultiPVMove(null);
                  onSelectMultiPVMove(line.firstMove.from, line.firstMove.to);
                }}
                className="w-full px-2.5 py-1 rounded-md border xq-border hover:border-[var(--xq-accent-gold)] hover:bg-[var(--xq-bg-hover)] text-left transition-colors cursor-pointer flex items-center justify-between gap-2.5 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded text-[11px] font-mono-tabular font-bold flex items-center justify-center shrink-0 ${
                      line.multipv === 1
                        ? 'bg-[#059669] text-white'
                        : 'bg-[var(--xq-bg-canvas)] xq-text-secondary border xq-border'
                    }`}
                  >
                    {line.multipv}
                  </span>
                  <span className="font-mono-tabular text-xs font-semibold w-11 shrink-0">
                    {formatScore(line.scoreCp)}
                  </span>
                  <span className="font-serif-sc font-bold text-[13px] text-[var(--xq-accent-gold)] shrink-0">
                    {line.firstMove.notation}
                  </span>
                  <span className="text-xs font-serif-sc xq-text-secondary truncate">
                    {line.pvMoves.slice(1).join(' · ')}
                  </span>
                </div>

                <span className="text-[11px] xq-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shrink-0">
                  试走
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ==================== 双擎对比并行模式 (Dual-Engine Compare) ==================== */
        <div className="p-2.5 space-y-2">
          {/* 1. 顶部双擎共识/分歧诊断横幅 */}
          {secondaryEngine.status === 'ready' && secondaryTop ? (
            isConsensus ? (
              <div className="px-2.5 py-1.5 rounded-md border border-[#10B981]/40 bg-[#10B981]/10 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <span className="font-semibold text-[#10B981] shrink-0">双擎共识：</span>
                  <span className="xq-text-primary truncate">
                    一致首推{' '}
                    <strong className="font-serif-sc text-[var(--xq-accent-gold)]">
                      {primaryTop.firstMove.notation}
                    </strong>
                  </span>
                </div>
                <span className="font-mono-tabular text-[11px] xq-text-secondary shrink-0">
                  分差 Δ{evalDiff}
                </span>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-md border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                  <span className="font-semibold text-[var(--xq-accent-gold)] shrink-0">
                    双擎分歧：
                  </span>
                  <span className="xq-text-primary truncate">
                    {primaryEngine.shortName}主推{' '}
                    <strong className="font-serif-sc text-[#10B981]">
                      {primaryTop.firstMove.notation}
                    </strong>{' '}
                    · {secondaryEngine.shortName}主推{' '}
                    <strong className="font-serif-sc text-[#3B82F6]">
                      {secondaryTop.firstMove.notation}
                    </strong>
                  </span>
                </div>
                <span className="font-mono-tabular text-[11px] xq-text-secondary shrink-0">
                  Δ{evalDiff}
                </span>
              </div>
            )
          ) : (
            <div className="px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] text-xs xq-text-secondary flex items-center justify-between">
              <span>已开启双擎对比：请安装或选择已就绪的副引擎参与并行推演</span>
              <span className="font-mono-tabular text-[11px] xq-text-muted">1/2 运行中</span>
            </div>
          )}

          {/* 2. 主引擎紧凑卡片 [主 · 翠绿 #10B981] */}
          <div className="rounded-md border border-[#10B981]/35 bg-[var(--xq-bg-canvas)] p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.2 rounded bg-[#10B981] text-white font-bold text-[11px] shrink-0">
                  主擎
                </span>
                <span className="font-semibold xq-text-primary truncate">
                  {primaryEngine.name}
                </span>
                <span className="text-[11px] xq-text-muted shrink-0">
                  [{primaryEngine.protocol}·{primaryEngine.styleLabel}]
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const prevPrimary = primaryEngine.id;
                    onChangePrimaryEngine(secondaryEngine.id);
                    onChangeSecondaryEngine(prevPrimary);
                  }}
                  title="一键互换主引擎与副引擎"
                  className="px-1.5 py-0.2 rounded xq-btn-secondary text-[11px] flex items-center gap-0.5 cursor-pointer font-sans"
                >
                  <ArrowUpDown className="w-2.5 h-2.5" />
                  <span>互换</span>
                </button>
                <span className="text-[11px] xq-text-muted">
                  d={primaryTop.depth}·{primaryTop.nps}k
                </span>
                <span className="font-bold text-[#10B981]">
                  {formatScore(primaryTop.scoreCp)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {primaryLines.slice(0, 2).map((line) => (
                <button
                  key={`pri-pv-${line.multipv}`}
                  type="button"
                  onMouseEnter={() =>
                    onHoverMultiPVMove({
                      rank: line.multipv,
                      from: line.firstMove.from,
                      to: line.firstMove.to,
                      scoreText: `[主] ${line.firstMove.notation}`,
                      notation: line.firstMove.notation,
                      isGhostPreview: true,
                    })
                  }
                  onMouseLeave={() => onHoverMultiPVMove(null)}
                  onClick={() => {
                    onHoverMultiPVMove(null);
                    onSelectMultiPVMove(line.firstMove.from, line.firstMove.to);
                  }}
                  className="w-full px-2 py-1 rounded border xq-border hover:border-[#10B981] hover:bg-[var(--xq-bg-hover)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono-tabular xq-text-muted w-9 shrink-0">
                      {formatScore(line.scoreCp)}
                    </span>
                    <span className="font-serif-sc font-bold text-xs text-[#10B981] shrink-0">
                      {line.firstMove.notation}
                    </span>
                    <span className="text-xs font-serif-sc xq-text-secondary truncate">
                      {line.pvMoves.slice(1).join(' · ')}
                    </span>
                  </div>
                  <span className="text-[11px] xq-text-muted shrink-0">试走</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 副引擎紧凑卡片 [副 · 天青蓝 #3B82F6] */}
          <div className="rounded-md border border-[#3B82F6]/35 bg-[var(--xq-bg-canvas)] p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.2 rounded bg-[#3B82F6] text-white font-bold text-[11px] shrink-0">
                  副擎
                </span>
                <select
                  aria-label="选择对比副引擎"
                  value={secondaryEngine.id}
                  onChange={(e) => onChangeSecondaryEngine(e.target.value)}
                  className="px-1.5 py-0.5 rounded border xq-border bg-[var(--xq-bg-surface)] xq-text-primary font-semibold text-xs cursor-pointer focus:outline-none"
                >
                  {engines
                    .filter((e) => e.id !== primaryEngine.id)
                    .map((eng) => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name} [{eng.protocol}·{eng.styleLabel}]
                        {eng.status !== 'ready' ? ' (未安装)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {secondaryEngine.status === 'ready' && secondaryTop && (
                <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                  <span className="text-[11px] xq-text-muted">
                    d={secondaryTop.depth}·{secondaryTop.nps}k
                  </span>
                  <span className="font-bold text-[#3B82F6]">
                    {formatScore(secondaryTop.scoreCp)}
                  </span>
                </div>
              )}
            </div>

            {secondaryEngine.status === 'missing' ? (
              <div className="pt-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="xq-text-secondary truncate">
                  未安装 {secondaryEngine.shortName} ({secondaryEngine.nnueFile})
                </span>
                <button
                  type="button"
                  onClick={() => onInstallEngine(secondaryEngine.id)}
                  className="px-2.5 py-1 rounded xq-btn-primary text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Download className="w-3 h-3" />
                  <span>一键安装 ({secondaryEngine.sizeMb}MB)</span>
                </button>
              </div>
            ) : secondaryEngine.status === 'installing' ? (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="xq-text-secondary">
                    正在下载安装 {secondaryEngine.name}…
                  </span>
                  <span className="font-mono-tabular font-bold text-[#3B82F6]">
                    {secondaryEngine.installProgress}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--xq-bg-elevated)] overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6] transition-all duration-150"
                    style={{ width: `${secondaryEngine.installProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {secondaryLines.slice(0, 2).map((line) => (
                  <button
                    key={`sec-pv-${line.multipv}`}
                    type="button"
                    onMouseEnter={() =>
                      onHoverMultiPVMove({
                        rank: line.multipv,
                        from: line.firstMove.from,
                        to: line.firstMove.to,
                        scoreText: `[副] ${line.firstMove.notation}`,
                        notation: line.firstMove.notation,
                        isGhostPreview: true,
                      })
                    }
                    onMouseLeave={() => onHoverMultiPVMove(null)}
                    onClick={() => {
                      onHoverMultiPVMove(null);
                      onSelectMultiPVMove(line.firstMove.from, line.firstMove.to);
                    }}
                    className="w-full px-2 py-1 rounded border xq-border hover:border-[#3B82F6] hover:bg-[var(--xq-bg-hover)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-mono-tabular xq-text-muted w-9 shrink-0">
                        {formatScore(line.scoreCp)}
                      </span>
                      <span className="font-serif-sc font-bold text-xs text-[#3B82F6] shrink-0">
                        {line.firstMove.notation}
                      </span>
                      <span className="text-xs font-serif-sc xq-text-secondary truncate">
                        {line.pvMoves.slice(1).join(' · ')}
                      </span>
                    </div>
                    <span className="text-[11px] xq-text-muted shrink-0">试走</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
