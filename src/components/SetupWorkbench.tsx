import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRightCircle,
  Check,
  CheckCircle2,
  Copy,
  Grid,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Camp, Piece, PieceType } from '../types/xiangqi';
import { PIECE_LABELS, piecesToFen } from '../utils/xiangqiRules';

interface SetupWorkbenchProps {
  pieces: Piece[];
  useTraditionalChar: boolean;
  setupSelectedTemplate: { camp: Camp; type: PieceType } | null;
  setupTurn: Camp;
  onSelectSetupTemplate: (template: { camp: Camp; type: PieceType } | null) => void;
  onChangeSetupTurn: (camp: Camp) => void;
  onClearSetupToKings: () => void;
  onResetSetupInitial: () => void;
  onFinishSetup: () => void;
}

const PIECE_QUOTA: { type: PieceType; max: number }[] = [
  { type: 'chariot', max: 2 },
  { type: 'horse', max: 2 },
  { type: 'cannon', max: 2 },
  { type: 'advisor', max: 2 },
  { type: 'elephant', max: 2 },
  { type: 'soldier', max: 5 },
  { type: 'general', max: 1 },
];

export const SetupWorkbench: React.FC<SetupWorkbenchProps> = React.memo(({
  pieces,
  useTraditionalChar,
  setupSelectedTemplate,
  setupTurn,
  onSelectSetupTemplate,
  onChangeSetupTurn,
  onClearSetupToKings,
  onResetSetupInitial,
  onFinishSetup,
}) => {
  const [copiedFen, setCopiedFen] = useState(false);

  const getRemainingCount = (camp: Camp, type: PieceType, max: number) => {
    const onBoard = pieces.filter((p) => p.camp === camp && p.type === type).length;
    return Math.max(0, max - onBoard);
  };

  const hasRedGeneral = pieces.some((p) => p.camp === 'red' && p.type === 'general');
  const hasBlackGeneral = pieces.some((p) => p.camp === 'black' && p.type === 'general');
  const isPositionValid = hasRedGeneral && hasBlackGeneral;
  const currentFen = piecesToFen(pieces, setupTurn);

  const handleCopyFen = () => {
    navigator.clipboard?.writeText(currentFen);
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 1500);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
      {/* 顶栏 */}
      <div className="px-3.5 py-2.5 border-b xq-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          <span className="font-semibold text-sm">摆子编辑工坊</span>
        </div>
        <span className="text-[11px] xq-text-muted">点选子力落子 · 点盘面子移除</span>
      </div>

      {/* 中间可适应内容区 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3">
        {/* 合法性状态条 */}
        <div
          className={`px-2.5 py-1.5 rounded-md border flex items-center justify-between gap-2 ${
            isPositionValid
              ? 'border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]'
              : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {isPositionValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isPositionValid
                ? `局面合法（盘面共 ${pieces.length} 枚棋子）`
                : '请确保红帅与黑将均已在盘面上'}
            </span>
          </div>
          <span className="font-mono-tabular text-[11px] opacity-85 shrink-0">
            {setupTurn === 'red' ? '红先' : '黑先'}
          </span>
        </div>

        {/* 双列棋子库存 */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 红方子力列 */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold xq-text-secondary text-center pb-1 border-b xq-border">
              红方子力库
            </div>
            <div className="space-y-1">
              {PIECE_QUOTA.map(({ type, max }) => {
                const remain = getRemainingCount('red', type, max);
                const isSelected =
                  setupSelectedTemplate?.camp === 'red' &&
                  setupSelectedTemplate?.type === type;
                const label = useTraditionalChar
                  ? PIECE_LABELS.red[type].traditional
                  : PIECE_LABELS.red[type].simplified;
                const disabled = remain <= 0;

                return (
                  <button
                    key={`setup-r-${type}`}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onSelectSetupTemplate(
                        isSelected ? null : { camp: 'red', type }
                      )
                    }
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-colors ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed xq-border'
                        : isSelected
                        ? 'border-[#C8372D] bg-[#C8372D]/15 cursor-pointer'
                        : 'xq-border hover:bg-[var(--xq-bg-hover)] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif-sc font-bold text-[#A62222] bg-[#EAD2B0] w-6 h-6 rounded-full flex items-center justify-center border border-[#9E2A2B]/50 text-xs">
                        {label}
                      </span>
                      <span className="font-medium xq-text-primary">
                        红{label}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-[11px] xq-text-secondary">
                      余 {remain}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 黑方子力列 */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold xq-text-secondary text-center pb-1 border-b xq-border">
              黑方子力库
            </div>
            <div className="space-y-1">
              {PIECE_QUOTA.map(({ type, max }) => {
                const remain = getRemainingCount('black', type, max);
                const isSelected =
                  setupSelectedTemplate?.camp === 'black' &&
                  setupSelectedTemplate?.type === type;
                const label = useTraditionalChar
                  ? PIECE_LABELS.black[type].traditional
                  : PIECE_LABELS.black[type].simplified;
                const disabled = remain <= 0;

                return (
                  <button
                    key={`setup-b-${type}`}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onSelectSetupTemplate(
                        isSelected ? null : { camp: 'black', type }
                      )
                    }
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-colors ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed xq-border'
                        : isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 cursor-pointer'
                        : 'xq-border hover:bg-[var(--xq-bg-hover)] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif-sc font-bold text-[#DFB654] bg-[#241E1B] w-6 h-6 rounded-full flex items-center justify-center border border-[#D4AF37]/40 text-xs">
                        {label}
                      </span>
                      <span className="font-medium xq-text-primary">
                        黑{label}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-[11px] xq-text-secondary">
                      余 {remain}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 先行方与快捷重置 */}
        <div className="p-2.5 rounded-lg border xq-border bg-[var(--xq-bg-canvas)] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="xq-text-secondary font-medium">设定先行方</span>
            <div className="grid grid-cols-2 gap-1.5 w-44">
              <button
                type="button"
                onClick={() => onChangeSetupTurn('red')}
                className={`py-1 rounded-md text-center cursor-pointer ${
                  setupTurn === 'red' ? 'xq-btn-option-active' : 'xq-btn-option'
                }`}
              >
                红方先行
              </button>
              <button
                type="button"
                onClick={() => onChangeSetupTurn('black')}
                className={`py-1 rounded-md text-center cursor-pointer ${
                  setupTurn === 'black' ? 'xq-btn-option-active' : 'xq-btn-option'
                }`}
              >
                黑方先行
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClearSetupToKings}
              className="px-2.5 py-1.5 rounded-md xq-btn-secondary flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 opacity-80" />
              <span>仅留将帅</span>
            </button>
            <button
              type="button"
              onClick={onResetSetupInitial}
              className="px-2.5 py-1.5 rounded-md xq-btn-secondary flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 opacity-80" />
              <span>恢复初始棋盘</span>
            </button>
          </div>
        </div>

        {/* 实时 FEN 预览 */}
        <div className="p-2 rounded-md border xq-border bg-[var(--xq-bg-canvas)]/70 flex items-center justify-between gap-2">
          <code className="font-mono-tabular text-[11px] xq-text-secondary truncate">
            {currentFen}
          </code>
          <button
            type="button"
            onClick={handleCopyFen}
            title="复制当前摆子 FEN"
            className="px-2 py-1 rounded xq-btn-secondary flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copiedFen ? (
              <>
                <Check className="w-3 h-3 text-[#10B981]" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 opacity-80" />
                <span>复制 FEN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 底部主行动区 */}
      <div className="p-3.5 border-t xq-border shrink-0 bg-[var(--xq-bg-surface)]">
        <button
          type="button"
          disabled={!isPositionValid}
          onClick={onFinishSetup}
          className="w-full py-2.5 px-4 rounded-lg xq-btn-primary disabled:opacity-45 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <ArrowRightCircle className="w-4 h-4" />
          <span>完成摆子 · 转入复盘分析</span>
        </button>
      </div>
    </div>
  );
});
