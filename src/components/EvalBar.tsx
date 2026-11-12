import React from 'react';

interface EvalBarProps {
  scoreCp: number; // 主引擎红方视角分值（例如 +1.45）
  secondaryScoreCp?: number | null; // 双擎对比模式下副引擎红方视角分值
  compareMode?: boolean;
  mateIn?: number; // 正数为红杀N，负数为黑杀N
  flipped?: boolean;
  heightClass?: string;
  labelOverride?: string;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  scoreCp,
  secondaryScoreCp = null,
  compareMode = false,
  mateIn,
  flipped = false,
  heightClass = 'h-full',
  labelOverride,
}) => {
  // 计算红方占比百分比 (5% .. 95%)
  const toRedPercent = (cp: number) => {
    const clamped = Math.max(-8, Math.min(8, cp));
    return Math.round(50 + (clamped / 8) * 45);
  };

  let redPercent = 50;
  if (mateIn !== undefined) {
    redPercent = mateIn > 0 ? 96 : 4;
  } else {
    redPercent = toRedPercent(scoreCp);
  }

  const secondaryRedPercent =
    compareMode && secondaryScoreCp !== null ? toRedPercent(secondaryScoreCp) : null;

  // 盘面条内采用精炼分值格式（如 +1.7、-0.4、+12、杀3），避免窄条内多字符被截断
  const formatCompactScore = (val: number) => {
    const abs = Math.abs(val);
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    if (abs >= 10) {
      return `${sign}${Math.round(abs)}`;
    }
    return `${sign}${abs.toFixed(1)}`;
  };

  const compactText =
    labelOverride ??
    (mateIn !== undefined
      ? `杀${Math.abs(mateIn)}`
      : formatCompactScore(scoreCp));

  const fullTooltipText =
    labelOverride ??
    (mateIn !== undefined
      ? mateIn > 0
        ? `红方杀 (${mateIn}步)`
        : `黑方杀 (${Math.abs(mateIn)}步)`
      : compareMode && secondaryScoreCp !== null
      ? `主引擎评估：${scoreCp >= 0 ? '+' : ''}${scoreCp.toFixed(2)} · 副引擎评估：${
          secondaryScoreCp >= 0 ? '+' : ''
        }${secondaryScoreCp.toFixed(2)}`
      : `${scoreCp >= 0 ? '+' : ''}${scoreCp.toFixed(2)}`);

  const isRedAdv = mateIn !== undefined ? mateIn > 0 : scoreCp >= 0;
  const placeAtBottom = isRedAdv !== flipped;

  return (
    <div
      data-component="EvalBar.tsx"
      className={`relative w-9 sm:w-10 shrink-0 rounded-lg overflow-hidden border xq-border flex flex-col select-none shadow-inner ${heightClass}`}
      title={`当前局面评估：${fullTooltipText}`}
    >
      {/* 顶部区域（默认黑方在顶，翻转后红方在顶） */}
      <div
        style={{
          height: flipped ? `${redPercent}%` : `${100 - redPercent}%`,
        }}
        className={`w-full transition-all duration-200 ${
          flipped ? 'bg-[#B82925]' : 'bg-[#26201D]'
        }`}
      />
      {/* 底部区域 */}
      <div
        style={{
          height: flipped ? `${100 - redPercent}%` : `${redPercent}%`,
        }}
        className={`w-full transition-all duration-200 ${
          flipped ? 'bg-[#26201D]' : 'bg-[#B82925]'
        }`}
      />

      {/* 均势中线刻度 */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-[#D4AF37]/60 pointer-events-none" />

      {/* 双擎对比模式：副引擎评估水位天青蓝参考刻度线 */}
      {secondaryRedPercent !== null && (
        <div
          style={{
            top: flipped
              ? `${secondaryRedPercent}%`
              : `${100 - secondaryRedPercent}%`,
          }}
          className="absolute inset-x-0 -translate-y-1/2 h-[2.5px] bg-[#3B82F6] shadow-[0_0_6px_rgba(59,130,246,0.9)] pointer-events-none transition-all duration-200"
        />
      )}

      {/* 阵营微标（固定在与分值相对的另一端，互不挤压） */}
      <span
        className={`absolute inset-x-0 text-center text-[10px] font-medium text-[#EFE6D8]/70 pointer-events-none ${
          placeAtBottom ? 'top-1.5' : 'bottom-1.5'
        }`}
      >
        {placeAtBottom ? (flipped ? '红' : '黑') : flipped ? '黑' : '红'}
      </span>

      {/* 评估分值（置于优势方一端，带半透明衬底确保跨分界线时依然清晰完整） */}
      <div
        className={`absolute inset-x-0.5 flex flex-col items-center gap-0.5 pointer-events-none ${
          placeAtBottom ? 'bottom-1.5' : 'top-1.5'
        }`}
      >
        <span className="px-1 py-0.5 rounded bg-black/55 backdrop-blur-[1px] text-[11px] font-mono-tabular font-bold tracking-tight leading-none text-[#FAF5EB] whitespace-nowrap">
          {compactText}
        </span>
        {compareMode && secondaryScoreCp !== null && (
          <span className="px-1 py-0.2 rounded bg-[#1E3A8A]/85 border border-[#3B82F6]/60 text-[10px] font-mono-tabular font-semibold leading-none text-[#93C5FD] whitespace-nowrap">
            {formatCompactScore(secondaryScoreCp)}
          </span>
        )}
      </div>
    </div>
  );
};
