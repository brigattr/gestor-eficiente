/** Marca: barras de sinal (como no BP.CONN) + nome do sistema. */
export function Bars({ size = 26, color = '#ffffff', accent = '#f5c542' }: { size?: number; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <rect x="1" y="17" width="3.6" height="7" rx="1.2" fill={color} />
      <rect x="7" y="13" width="3.6" height="11" rx="1.2" fill={color} />
      <rect x="13" y="8" width="3.6" height="16" rx="1.2" fill={color} />
      <rect x="19" y="2" width="3.6" height="22" rx="1.2" fill={accent} />
    </svg>
  )
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="logo" style={{ color: light ? '#fff' : 'var(--brand)' }}>
      <Bars color={light ? '#ffffff' : 'currentColor'} />
      <div>
        <b>Gestor Eficiente</b>
        <span>por BP.CONN</span>
      </div>
    </div>
  )
}
