import React from 'react';

interface EvalBarProps {
  scoreCp: number; // 红方视角分值（例如 +1.45）
  mateIn?: number; // 正数为红杀N，负数为黑杀N
  flipped?: boolean;
  heightClass?: string;
  labelOverride?: string;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  scoreCp,
  mateIn,
  flipped = false,
  heightClass = 'h-full',
  labelOverride,
}) => {
  // Component: EvalBar.tsx (对应设计简报 §3.2 / §7.B)
  // 计算红方占比百分比 (5% .. 95%)
  let redPercent = 50;
  if (mateIn !== undefined) {
    redPercent = mateIn > 0 ? 96 : 4;
  } else {
    // Sigmoid 映射 [-6, +6] -> [5%, 95%]
    const clamped = Math.max(-8, Math.min(8, scoreCp));
    redPercent = Math.round(50 + (clamped / 8) * 45);
  }

  // 盘面条内采用精炼分值格式（如 +1.7、-0.4、+12、杀3），避免窄条内多字符被截断；完整两位小数保留在悬浮提示与右侧引擎栏
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
        className={`absolute inset-x-0.5 flex justify-center pointer-events-none ${
          placeAtBottom ? 'bottom-1.5' : 'top-1.5'
        }`}
      >
        <span className="px-1 py-0.5 rounded bg-black/45 backdrop-blur-[1px] text-[11px] font-mono-tabular font-bold tracking-tight leading-none text-[#FAF5EB] whitespace-nowrap">
          {compactText}
        </span>
      </div>
    </div>
  );
};
