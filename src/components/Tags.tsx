import { CORES_ETIQUETA } from '../data/schema'
import { get } from '../data/store'

/** Cor (hex) de uma etiqueta pelo id. */
export function corEtiqueta(id: string) {
  const t = get('etiquetas', id)
  return CORES_ETIQUETA[String(t?.cor ?? 'Azul')] ?? CORES_ETIQUETA.Azul
}

export function TagChip({ id, onClick }: { id: string; onClick?: () => void }) {
  const t = get('etiquetas', id)
  if (!t) return null
  const cor = corEtiqueta(id)
  return (
    <span className="tag" style={{ ['--tag' as string]: cor, cursor: onClick ? 'pointer' : undefined }} onClick={onClick} title={String(t.descricao ?? t.nome)}>
      {String(t.nome)}
    </span>
  )
}

export function TagChips({ ids }: { ids: unknown }) {
  if (!Array.isArray(ids) || !ids.length) return null
  return (
    <span className="tags">
      {(ids as string[]).map((id) => (
        <TagChip key={id} id={id} />
      ))}
    </span>
  )
}
