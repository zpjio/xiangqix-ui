import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
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
import { ThemeSelect } from './ThemeSelect';

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
  onSwapEngines: () => void;
  onToggleCompareMode: () => void;
  onInstallEngine: (id: string) => void;
  onOpenEngineSettings: () => void;
  onToggleAnalysis: () => void;
  onToggleThreatRadar: () => void;
  onSelectMultiPVMove: (from: Position, to: Position) => void;
  onHoverMultiPVMove: (arrow: MultiPVArrow | null) => void;
}

export const EnginePanel: React.FC<EnginePanelProps> = React.memo(({
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
  onSwapEngines,
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
      <div className="px-3.5 py-1.5 border-b xq-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {primaryEngine.status === 'ready' ? (
            <button
              type="button"
              onClick={onToggleAnalysis}
              className={`px-2.5 py-1 rounded-md text-[0.8125rem] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs ${
                isAnalyzing ? 'xq-btn-engine-on' : 'xq-btn-primary'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>暂停分析</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>开始分析</span>
                </>
              )}
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 text-[var(--xq-accent-gold)] font-medium flex items-center gap-1 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              <span>待安装</span>
            </span>
          )}

          {/* 单引擎模式显示主引擎下拉；双擎模式在下方展示对称双引擎选择器 */}
          {!compareMode ? (
            <div className="min-w-0 flex-1 max-w-[13rem]">
              <ThemeSelect
                ariaLabel="选择主分析引擎"
                value={primaryEngine.id}
                onChange={onChangePrimaryEngine}
                triggerClassName="px-2 py-1 font-medium"
                menuMinWidthClass="min-w-[11.5rem]"
                options={engines.map((eng) => ({
                  value: eng.id,
                  label: `${eng.shortName} [${eng.protocol}]${eng.status !== 'ready' ? ' (未装)' : ''}`,
                }))}
              />
            </div>
          ) : (
            <span className="text-[0.8125rem] font-medium text-[var(--xq-accent-gold)] truncate">
              双擎并行推演
            </span>
          )}
        </div>

        {/* 右侧：双擎对比开关 + 威胁雷达开关 */}
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

      {/* 双擎对称配对选择器（开启双擎对比时常驻显示，支持直接选择两个引擎及一键互换） */}
      {compareMode && (
        <div className="px-3.5 py-1.5 border-b xq-border bg-[var(--xq-bg-canvas)]/70 flex items-center gap-1.5">
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-[var(--xq-accent-jade)] text-[#F4EFE2] font-bold text-xs shrink-0">
              主
            </span>
            <div className="flex-1 min-w-0">
              <ThemeSelect
                ariaLabel="选择对比主引擎"
                value={primaryEngine.id}
                onChange={onChangePrimaryEngine}
                triggerClassName="px-1.5 py-1 font-medium border-[var(--xq-accent-jade)]/45 bg-[var(--xq-bg-surface)] focus:border-[var(--xq-accent-jade)]"
                menuMinWidthClass="min-w-[11.5rem]"
                options={engines.map((eng) => ({
                  value: eng.id,
                  label: `${eng.shortName} [${eng.protocol}]${eng.status !== 'ready' ? ' (未装)' : ''}`,
                }))}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onSwapEngines}
            title="一键互换主引擎与副引擎"
            className="p-1 rounded-md xq-btn-secondary shrink-0 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-[var(--xq-accent-azure)] text-[#F4EFE2] font-bold text-xs shrink-0">
              副
            </span>
            <div className="flex-1 min-w-0">
              <ThemeSelect
                ariaLabel="选择对比副引擎"
                value={secondaryEngine.id}
                onChange={onChangeSecondaryEngine}
                menuAlign="right"
                triggerClassName="px-1.5 py-1 font-medium border-[var(--xq-accent-azure)]/45 bg-[var(--xq-bg-surface)] focus:border-[var(--xq-accent-azure)]"
                menuMinWidthClass="min-w-[11.5rem]"
                options={engines.map((eng) => ({
                  value: eng.id,
                  label: `${eng.shortName} [${eng.protocol}]${eng.status !== 'ready' ? ' (未装)' : ''}`,
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* 主体：若主引擎未安装或安装中，呈现一键下载引导 */}
      {primaryEngine.status === 'missing' ? (
        <div className="p-3 space-y-2 bg-[var(--xq-bg-canvas)]/60">
          <div className="space-y-1">
            <div className="text-[0.8125rem] font-semibold xq-text-primary flex items-center justify-between gap-2 flex-wrap">
              <span>未检测到本地「{primaryEngine.name}」组件</span>
              <span className="text-xs px-1.5 py-0.5 rounded border xq-border xq-text-secondary font-mono-tabular">
                {primaryEngine.protocol} · {primaryEngine.styleLabel}
              </span>
            </div>
            <p className="text-xs xq-text-secondary leading-relaxed">
              该引擎需配置核心可执行程序与{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--xq-bg-elevated)] border xq-border font-mono-tabular text-xs">
                {primaryEngine.nnueFile}
              </code>{' '}
              神经网络权重文件后方可启动分析。
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onInstallEngine(primaryEngine.id)}
              className="flex-1 py-1.5 px-3 rounded-md xq-btn-primary text-[0.8125rem] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                一键下载并安装 {primaryEngine.shortName} ({primaryEngine.sizeMb}MB)
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenEngineSettings}
              className="py-1.5 px-3 rounded-md xq-btn-secondary text-[0.8125rem] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-80" />
              <span>引擎库管理</span>
            </button>
          </div>
        </div>
      ) : primaryEngine.status === 'installing' ? (
        <div className="p-3 space-y-2 bg-[var(--xq-bg-canvas)]/60">
          <div className="flex items-center justify-between text-[0.8125rem]">
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
        <div className="py-2.5 px-3.5 flex items-center justify-between gap-2 text-[0.8125rem] xq-text-muted bg-[var(--xq-bg-canvas)]/40">
          <span className="truncate">
            {primaryEngine.name} 已就绪 · 点击左上方「开始分析」推演当前局面
          </span>
          <span className="text-xs font-mono-tabular shrink-0 opacity-75">
            待命中
          </span>
        </div>
      ) : !compareMode ? (
        /* ==================== 单引擎标准模式 ==================== */
        <div className="p-2.5 space-y-1.5">
          {/* 顶部一行局势定性语 + 引擎风格标签 + 深度算力指标 + 评分 */}
          <div className="px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between gap-2 text-[0.8125rem]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-1.5 py-0.5 rounded text-xs font-mono-tabular bg-[var(--xq-accent-jade)]/15 text-[var(--xq-accent-jade)] border border-[var(--xq-accent-jade)]/30 shrink-0">
                {primaryEngine.shortName}·{primaryEngine.styleLabel}
              </span>
              <span className="font-medium xq-text-primary truncate">
                {primaryTop.summaryText}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono-tabular">
              <span className="text-xs xq-text-muted">
                d={primaryTop.depth}·{primaryTop.nps}k
              </span>
              <span className="font-bold text-sm text-[var(--xq-accent-jade)]">
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
                className="w-full px-2.5 py-1.5 rounded-md border xq-border hover:border-[var(--xq-accent-gold)] hover:bg-[var(--xq-bg-hover)] text-left transition-colors cursor-pointer flex items-center justify-between gap-2.5 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded text-xs font-mono-tabular font-bold flex items-center justify-center shrink-0 ${
                      line.multipv === 1
                        ? 'bg-[var(--xq-btn-engine-bg)] text-[var(--xq-btn-engine-text)]'
                        : 'bg-[var(--xq-bg-canvas)] xq-text-secondary border xq-border'
                    }`}
                  >
                    {line.multipv}
                  </span>
                  <span className="font-mono-tabular text-xs font-semibold min-w-[3.1rem] shrink-0">
                    {formatScore(line.scoreCp)}
                  </span>
                  <span className="font-serif-sc font-bold text-sm text-[var(--xq-accent-gold)] shrink-0">
                    {line.firstMove.notation}
                  </span>
                  <span className="text-[0.8125rem] font-serif-sc xq-text-secondary truncate">
                    {line.pvMoves.slice(1).join(' · ')}
                  </span>
                </div>

                <span className="text-xs xq-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shrink-0">
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
              <div className="px-2.5 py-1.5 rounded-md border border-[var(--xq-accent-jade)]/40 bg-[var(--xq-accent-jade)]/10 flex items-center justify-between gap-2 text-[0.8125rem]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--xq-accent-jade)] shrink-0" />
                  <span className="font-semibold text-[var(--xq-accent-jade)] shrink-0">双擎共识：</span>
                  <span className="xq-text-primary truncate">
                    一致首推{' '}
                    <strong className="font-serif-sc text-[var(--xq-accent-gold)]">
                      {primaryTop.firstMove.notation}
                    </strong>
                  </span>
                </div>
                <span className="font-mono-tabular text-xs xq-text-secondary shrink-0">
                  分差 Δ{evalDiff}
                </span>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-md border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 flex items-center justify-between gap-2 text-[0.8125rem]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className="w-3.5 h-3.5 text-[var(--xq-accent-gold)] shrink-0" />
                  <span className="font-semibold text-[var(--xq-accent-gold)] shrink-0">
                    双擎分歧：
                  </span>
                  <span className="xq-text-primary truncate">
                    {primaryEngine.shortName}主推{' '}
                    <strong className="font-serif-sc text-[var(--xq-accent-jade)]">
                      {primaryTop.firstMove.notation}
                    </strong>{' '}
                    · {secondaryEngine.shortName}主推{' '}
                    <strong className="font-serif-sc text-[var(--xq-accent-azure)]">
                      {secondaryTop.firstMove.notation}
                    </strong>
                  </span>
                </div>
                <span className="font-mono-tabular text-xs xq-text-secondary shrink-0">
                  Δ{evalDiff}
                </span>
              </div>
            )
          ) : (
            <div className="px-2.5 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] text-[0.8125rem] xq-text-secondary flex items-center justify-between gap-2">
              <span className="truncate">已开启双擎对比：请安装或选择已就绪的副引擎参与并行推演</span>
              <span className="font-mono-tabular text-xs xq-text-muted shrink-0">1/2 运行中</span>
            </div>
          )}

          {/* 2. 主引擎紧凑卡片 */}
          <div className="rounded-md border border-[var(--xq-accent-jade)]/35 bg-[var(--xq-bg-canvas)] p-2 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-[var(--xq-accent-jade)] text-[#F4EFE2] font-bold text-xs shrink-0">
                  主擎
                </span>
                <span className="font-semibold xq-text-primary truncate">
                  {primaryEngine.name}
                </span>
                <span className="text-xs xq-text-muted shrink-0">
                  [{primaryEngine.protocol}·{primaryEngine.styleLabel}]
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                <span className="text-xs xq-text-muted">
                  d={primaryTop.depth}·{primaryTop.nps}k
                </span>
                <span className="font-bold text-[var(--xq-accent-jade)]">
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
                  className="w-full px-2 py-1 rounded border xq-border hover:border-[var(--xq-accent-jade)] hover:bg-[var(--xq-bg-hover)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono-tabular xq-text-muted min-w-[2.9rem] shrink-0">
                      {formatScore(line.scoreCp)}
                    </span>
                    <span className="font-serif-sc font-bold text-sm text-[var(--xq-accent-jade)] shrink-0">
                      {line.firstMove.notation}
                    </span>
                    <span className="text-[0.8125rem] font-serif-sc xq-text-secondary truncate">
                      {line.pvMoves.slice(1).join(' · ')}
                    </span>
                  </div>
                  <span className="text-xs xq-text-muted shrink-0">试走</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 副引擎紧凑卡片 */}
          <div className="rounded-md border border-[var(--xq-accent-azure)]/35 bg-[var(--xq-bg-canvas)] p-2 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-[var(--xq-accent-azure)] text-[#F4EFE2] font-bold text-xs shrink-0">
                  副擎
                </span>
                <span className="font-semibold xq-text-primary truncate">
                  {secondaryEngine.name}
                </span>
                <span className="text-xs xq-text-muted shrink-0">
                  [{secondaryEngine.protocol}·{secondaryEngine.styleLabel}]
                </span>
              </div>

              {secondaryEngine.status === 'ready' && secondaryTop && (
                <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                  <span className="text-xs xq-text-muted">
                    d={secondaryTop.depth}·{secondaryTop.nps}k
                  </span>
                  <span className="font-bold text-[var(--xq-accent-azure)]">
                    {formatScore(secondaryTop.scoreCp)}
                  </span>
                </div>
              )}
            </div>

            {secondaryEngine.status === 'missing' ? (
              <div className="pt-0.5 flex items-center justify-between gap-2 text-[0.8125rem]">
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
                <div className="flex items-center justify-between text-xs">
                  <span className="xq-text-secondary">
                    正在下载安装 {secondaryEngine.name}…
                  </span>
                  <span className="font-mono-tabular font-bold text-[var(--xq-accent-azure)]">
                    {secondaryEngine.installProgress}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--xq-bg-elevated)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--xq-accent-azure)] transition-all duration-150"
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
                    className="w-full px-2 py-1 rounded border xq-border hover:border-[var(--xq-accent-azure)] hover:bg-[var(--xq-bg-hover)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono-tabular xq-text-muted min-w-[2.9rem] shrink-0">
                        {formatScore(line.scoreCp)}
                      </span>
                      <span className="font-serif-sc font-bold text-sm text-[var(--xq-accent-azure)] shrink-0">
                        {line.firstMove.notation}
                      </span>
                      <span className="text-[0.8125rem] font-serif-sc xq-text-secondary truncate">
                        {line.pvMoves.slice(1).join(' · ')}
                      </span>
                    </div>
                    <span className="text-xs xq-text-muted shrink-0">试走</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
});
