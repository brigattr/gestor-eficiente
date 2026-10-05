import { MES_CURTO, money } from '../lib/format'
import type { BvR } from '../lib/calc'

/** Colunas de budget (contorno) × realizado (preenchido), por mês. */
export function BudgetChart({ months, height = 200 }: { months: BvR[]; height?: number }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.budget, m.real]))
  const W = 720
  const pad = 28
  const bw = (W - pad) / 12
  const y = (v: number) => height - 22 - (v / max) * (height - 34)
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Budget versus realizado por mês">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={pad} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--border)" />
          <text x={pad - 4} y={y(max * g) + 4} fontSize="9" textAnchor="end" fill="var(--muted)">
            {Math.round((max * g) / 1000)}k
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = pad + i * bw + bw * 0.18
        const w = bw * 0.64
        const over = m.real > m.budget && m.budget > 0
        return (
          <g key={i}>
            <title>{`${MES_CURTO[i]}: budget ${money(m.budget)} · real ${money(m.real)}`}</title>
            <rect x={x} y={y(m.budget)} width={w} height={Math.max(0, height - 22 - y(m.budget))} fill="var(--surface-2)" stroke="var(--brand-2)" strokeDasharray="3 2" rx="3" />
            {m.real > 0 && <rect x={x + w * 0.18} y={y(m.real)} width={w * 0.64} height={height - 22 - y(m.real)} fill={over ? 'var(--bad)' : 'var(--brand-2)'} rx="3" />}
            <text x={x + w / 2} y={height - 6} fontSize="10" textAnchor="middle" fill="var(--muted)">
              {MES_CURTO[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Donut({ value, size = 84, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, value))
  const col = p >= 70 ? 'var(--ok)' : p >= 40 ? 'var(--warn)' : 'var(--bad)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="8" strokeDasharray={`${(p / 100) * c} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 5} fontWeight="700" fill="var(--text)">
        {Math.round(p)}%
      </text>
      {label && <title>{label}</title>}
    </svg>
  )
}
