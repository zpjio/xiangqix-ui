import React, { useMemo } from 'react';
import { MoveRecord } from '../types/xiangqi';

interface EvalGraphProps {
  moves: MoveRecord[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = React.memo(({
  moves,
  currentPly,
  onSelectPly,
}) => {
  const width = 500;
  const height = 80;
  const midY = height / 2;

  const { points, maxPlies, lineCoords, areaCoords } = useMemo(() => {
    const pts = [
      { ply: 0, score: 0.25, quality: undefined as MoveRecord['quality'] },
      ...moves.map((m) => ({
        ply: m.ply,
        score: m.evalScore,
        quality: m.quality,
      })),
    ];
    const maxP = Math.max(12, pts.length - 1);
    const calcX = (ply: number) => 28 + (ply / maxP) * (width - 40);
    const calcY = (score: number) => {
      const clamped = Math.max(-3.5, Math.min(3.5, score));
      return midY - (clamped / 3.5) * (midY - 9);
    };
    const lCoords = pts.map((p) => `${calcX(p.ply)},${calcY(p.score)}`).join(' ');
    const aCoords = `${calcX(0)},${midY} ${lCoords} ${calcX(pts[pts.length - 1].ply)},${midY}`;
    return { points: pts, maxPlies: maxP, lineCoords: lCoords, areaCoords: aCoords };
  }, [moves, midY]);

  const toX = (ply: number) => 28 + (ply / maxPlies) * (width - 40);
  const toY = (score: number) => {
    const clamped = Math.max(-3.5, Math.min(3.5, score));
    return midY - (clamped / 3.5) * (midY - 9);
  };

  return (
    <div className="w-full px-3 py-2 rounded-lg border xq-surface select-none">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium xq-text-secondary">整局优劣势曲线（点击圆点跳手）</span>
        <span className="font-mono-tabular xq-text-muted">
          手数 {currentPly}/{moves.length}
        </span>
      </div>

      <div className="relative w-full h-[4.5rem]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="evalAreaRed2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--xq-eval-red)" stopOpacity="0.38" />
              <stop offset="50%" stopColor="var(--xq-eval-red)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--xq-eval-black)" stopOpacity="0.28" />
            </linearGradient>
          </defs>

          <text
            x="2"
            y="15"
            fontSize="11"
            fill="var(--xq-accent-crimson)"
            className="font-serif-sc font-bold"
          >
            红优
          </text>
          <text
            x="2"
            y={midY + 3}
            fontSize="10"
            fill="var(--xq-text-muted)"
            className="font-mono-tabular"
          >
            0.0
          </text>
          <text
            x="2"
            y={height - 5}
            fontSize="11"
            fill="var(--xq-text-muted)"
            className="font-serif-sc font-bold"
          >
            黑优
          </text>

          <line
            x1="28"
            y1={midY}
            x2={width - 8}
            y2={midY}
            stroke="var(--xq-border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          <polygon points={areaCoords} fill="url(#evalAreaRed2)" />
          <polyline
            fill="none"
            stroke="var(--xq-accent-crimson)"
            strokeWidth="2"
            points={lineCoords}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <line
            x1={toX(currentPly)}
            y1={5}
            x2={toX(currentPly)}
            y2={height - 5}
            stroke="var(--xq-accent-gold)"
            strokeWidth="1.5"
          />

          {points.map((pt) => {
            const cx = toX(pt.ply);
            const cy = toY(pt.score);
            const isCurrent = pt.ply === currentPly;
            const isMistake = pt.quality === '缓' || pt.quality === '败';

            return (
              <g
                key={`graph-pt-${pt.ply}`}
                className="cursor-pointer"
                onClick={() => onSelectPly(pt.ply)}
              >
                <circle cx={cx} cy={cy} r={8} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isCurrent ? 4.5 : isMistake ? 4 : 2.5}
                  fill={
                    isCurrent
                      ? 'var(--xq-accent-gold)'
                      : pt.quality === '败'
                      ? 'var(--xq-badge-blunder)'
                      : pt.quality === '缓'
                      ? 'var(--xq-badge-inaccuracy)'
                      : pt.quality === '妙'
                      ? 'var(--xq-badge-best)'
                      : 'var(--xq-text-secondary)'
                  }
                  stroke="var(--xq-bg-surface)"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});
