// Service worker do Gestor Eficiente: só exibe avisos e abre a tela certa ao tocar no aviso.
// Não guarda cache (o sistema sempre carrega a versão mais nova).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(e.notification.data?.url || './', self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) {
        if ('focus' in c) {
          c.navigate?.(destino)
          return c.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
