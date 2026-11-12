import React from 'react';
import { AlertTriangle, CheckCircle2, Download, FolderOpen, Play, Radar, Square } from 'lucide-react';
import { EngineInstallStatus, MultiPVArrow, MultiPVLine, Position } from '../types/xiangqi';

interface EnginePanelProps {
  engineStatus: EngineInstallStatus;
  installProgress: number;
  isAnalyzing: boolean;
  threatRadarEnabled: boolean;
  lines: MultiPVLine[];
  onInstallEngine: () => void;
  onOpenEngineSettings: () => void;
  onToggleAnalysis: () => void;
  onToggleThreatRadar: () => void;
  onSelectMultiPVMove: (from: Position, to: Position) => void;
  onHoverMultiPVMove: (arrow: MultiPVArrow | null) => void;
}

export const EnginePanel: React.FC<EnginePanelProps> = ({
  engineStatus,
  installProgress,
  isAnalyzing,
  threatRadarEnabled,
  lines,
  onInstallEngine,
  onOpenEngineSettings,
  onToggleAnalysis,
  onToggleThreatRadar,
  onSelectMultiPVMove,
  onHoverMultiPVMove,
}) => {
  const primaryLine = lines[0];

  return (
    <section className="flex flex-col border-b xq-border shrink-0">
      {/* 引擎舱顶栏：根据引擎安装状态展示对应控制项 */}
      <div className="px-4 py-2.5 border-b xq-border flex items-center justify-between gap-2">
        {engineStatus === 'ready' ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onToggleAnalysis}
                className={`px-3 py-1 rounded-md text-[13px] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isAnalyzing ? 'xq-btn-engine-on shadow-2xs' : 'xq-btn-secondary'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <span>引擎分析中</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>启动引擎</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleThreatRadar}
                title="开启后在棋盘用红色虚线标出对方下一步最具威胁的攻着"
                className={`px-3 py-1 rounded-md text-[13px] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  threatRadarEnabled ? 'xq-btn-danger font-semibold' : 'xq-btn-secondary'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>威胁雷达</span>
              </button>
            </div>

            {isAnalyzing && primaryLine ? (
              <span className="text-xs font-mono-tabular xq-text-muted shrink-0">
                d={primaryLine.depth} · {primaryLine.nps} kn/s
              </span>
            ) : (
              <span className="text-xs xq-text-muted flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Pikafish 已就绪</span>
              </span>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <AlertTriangle className="w-4 h-4 text-[var(--xq-accent-gold)] shrink-0" />
              <span>引擎分析舱</span>
            </div>
            <span className="px-2 py-0.5 rounded text-xs border border-[var(--xq-accent-gold)]/45 bg-[var(--xq-accent-gold)]/12 text-[var(--xq-accent-gold)] font-medium">
              {engineStatus === 'installing' ? '正在安装组件…' : '未检测到本地引擎'}
            </span>
          </>
        )}
      </div>

      {/* 主体：根据未安装 / 安装中 / 已就绪三种状态呈现 */}
      {engineStatus === 'missing' ? (
        <div className="p-3.5 space-y-2.5 bg-[var(--xq-bg-canvas)]/60">
          <div className="space-y-1">
            <div className="text-[13px] font-semibold xq-text-primary">
              首次使用或未检测到本地 Pikafish (皮卡鱼) 引擎
            </div>
            <p className="text-xs xq-text-secondary leading-relaxed">
              局面评估与候选主变需依赖 UCI 象棋引擎（包含{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--xq-bg-elevated)] border xq-border font-mono-tabular text-[11px]">
                pikafish
              </code>{' '}
              主程序与{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--xq-bg-elevated)] border xq-border font-mono-tabular text-[11px]">
                pikafish.nnue
              </code>{' '}
              权重文件）。
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={onInstallEngine}
              className="flex-1 py-1.5 px-3 rounded-md xq-btn-primary text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>一键下载并安装引擎 (38MB)</span>
            </button>

            <button
              type="button"
              onClick={onOpenEngineSettings}
              className="py-1.5 px-3 rounded-md xq-btn-secondary text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-80" />
              <span>手动指定 / 说明</span>
            </button>
          </div>
        </div>
      ) : engineStatus === 'installing' ? (
        <div className="p-4 space-y-2.5 bg-[var(--xq-bg-canvas)]/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold xq-text-primary">
              {installProgress < 45
                ? '1/3 正在下载 pikafish-avx2 核心程序…'
                : installProgress < 85
                ? '2/3 正在下载并校验 pikafish.nnue 神经网络权重…'
                : '3/3 正在完成 UCI 协议握手与算力初始化…'}
            </span>
            <span className="font-mono-tabular font-bold text-[var(--xq-accent-gold)]">
              {installProgress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--xq-bg-elevated)] border xq-border overflow-hidden">
            <div
              className="h-full bg-[var(--xq-btn-primary-bg)] transition-all duration-150"
              style={{ width: `${installProgress}%` }}
            />
          </div>
          <p className="text-xs xq-text-muted">
            安装完成后将自动写入本地引擎目录并开启实时主变分析
          </p>
        </div>
      ) : !isAnalyzing || lines.length === 0 ? (
        <div className="py-4 px-4 flex items-center justify-between gap-3 text-[13px] xq-text-muted">
          <span>引擎已就绪（当前待命），点击启动实时计算主变</span>
          <button
            type="button"
            onClick={onToggleAnalysis}
            className="px-3 py-1 rounded-md xq-btn-primary text-xs cursor-pointer shrink-0"
          >
            立即分析
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {/* 顶部一行局势定性语 */}
          <div className="px-3 py-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] flex items-center justify-between gap-2 text-[13px]">
            <span className="font-medium xq-text-primary truncate">{primaryLine.summaryText}</span>
            <span className="font-mono-tabular font-bold text-[#10B981] shrink-0">
              {primaryLine.scoreCp >= 0
                ? `+${primaryLine.scoreCp.toFixed(2)}`
                : primaryLine.scoreCp.toFixed(2)}
            </span>
          </div>

          {/* 候选变例列表 */}
          <div className="space-y-1">
            {lines.map((line) => (
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
                className="w-full px-3 py-1.5 rounded-md border xq-border hover:border-[var(--xq-accent-gold)] hover:bg-[var(--xq-bg-hover)] text-left transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-4.5 h-4.5 rounded text-xs font-mono-tabular font-bold flex items-center justify-center shrink-0 ${
                      line.multipv === 1
                        ? 'bg-[#059669] text-white'
                        : 'bg-[var(--xq-bg-canvas)] xq-text-secondary border xq-border'
                    }`}
                  >
                    {line.multipv}
                  </span>
                  <span className="font-mono-tabular text-xs font-semibold w-12 shrink-0">
                    {line.scoreCp >= 0
                      ? `+${line.scoreCp.toFixed(2)}`
                      : line.scoreCp.toFixed(2)}
                  </span>
                  <span className="font-serif-sc font-bold text-sm text-[var(--xq-accent-gold)] shrink-0">
                    {line.firstMove.notation}
                  </span>
                  <span className="text-xs font-serif-sc xq-text-secondary truncate">
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
      )}
    </section>
  );
};
