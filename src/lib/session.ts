// Usuário logado nesta aba. Separado do store para evitar dependência circular.
export type Papel = 'Administrador' | 'Gestor' | 'Leitura'
export type SessionUser = { id: string; nome: string; papel: Papel }

let current: SessionUser | null = null
const subs = new Set<() => void>()

export function getUser() {
  return current
}
export function setUser(u: SessionUser | null) {
  current = u
  subs.forEach((s) => s())
}
export function subscribeUser(l: () => void) {
  subs.add(l)
  return () => subs.delete(l)
}
export const canWrite = () => !!current && current.papel !== 'Leitura'
export const isAdmin = () => current?.papel === 'Administrador'
