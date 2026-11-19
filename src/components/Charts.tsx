import React, { useState } from 'react';
import { MonthlyCashPoint } from '../types/finance';
import { formatINR, formatINRCompact } from '../utils/formatters';

interface CashFlowTrendChartProps {
  data: MonthlyCashPoint[];
}

export const CashFlowTrendChart: React.FC<CashFlowTrendChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
        No monthly sales or expense transactions in this period yet.
      </div>
    );
  }

  const maxVal = Math.max(
    10000,
    ...data.flatMap((d) => [d.salesBilled, d.cashInflow, d.cashOutflow])
  );

  const chartHeight = 220;
  const chartWidth = 640;
  const padLeft = 58;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const groupWidth = innerWidth / data.length;
  const barWidth = Math.min(18, Math.max(8, (groupWidth - 18) / 3));

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
            Credit Sales Billed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 inline-block" />
            Cash Collected
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
            Business Expenses
          </span>
        </div>

        {activePoint && (
          <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-900">{activePoint.label}</span>
            <span aria-hidden="true">·</span>
            <span>
              Inflow <strong className="font-mono text-teal-700">{formatINR(activePoint.cashInflow)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Outflow <strong className="font-mono text-amber-700">{formatINR(activePoint.cashOutflow)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Net{' '}
              <strong
                className={`font-mono ${
                  activePoint.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {activePoint.netCashFlow >= 0 ? '+' : ''}
                {formatINR(activePoint.netCashFlow)}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[460px] h-56 select-none"
          role="img"
          aria-label="Monthly sales billed, cash collected, and expenses chart"
        >
          {ticks.map((t) => {
            const y = padTop + innerHeight * (1 - t);
            const val = maxVal * t;
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  x2={chartWidth - padRight}
                  y1={y}
                  y2={y}
                  stroke={t === 0 ? '#CBD5E1' : '#F1F5F9'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {t === 0 ? '₹0' : formatINRCompact(val)}
                </text>
              </g>
            );
          })}

          {data.map((pt, idx) => {
            const groupCenterX = padLeft + groupWidth * idx + groupWidth / 2;
            const totalBarsWidth = barWidth * 3 + 6;
            const startX = groupCenterX - totalBarsWidth / 2;

            const hSales = (pt.salesBilled / maxVal) * innerHeight;
            const hInflow = (pt.cashInflow / maxVal) * innerHeight;
            const hOutflow = (pt.cashOutflow / maxVal) * innerHeight;
            const isActive = hoveredIdx === idx;

            return (
              <g
                key={pt.monthKey}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={padLeft + groupWidth * idx + 2}
                  y={padTop}
                  width={Math.max(10, groupWidth - 4)}
                  height={innerHeight}
                  rx="4"
                  fill={isActive ? '#F8FAFC' : 'transparent'}
                />
                <rect
                  x={startX}
                  y={padTop + innerHeight - hSales}
                  width={barWidth}
                  height={Math.max(2, hSales)}
                  rx="2"
                  fill="#CBD5E1"
                />
                <rect
                  x={startX + barWidth + 3}
                  y={padTop + innerHeight - hInflow}
                  width={barWidth}
                  height={Math.max(2, hInflow)}
                  rx="2"
                  fill="#0F766E"
                />
                <rect
                  x={startX + (barWidth + 3) * 2}
                  y={padTop + innerHeight - hOutflow}
                  width={barWidth}
                  height={Math.max(2, hOutflow)}
                  rx="2"
                  fill="#D97706"
                />
                <text
                  x={groupCenterX}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-medium ${
                    isActive ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                  }`}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
