// Service worker do OWL Hub: recebe as notificações push e abre o Hub (ou o link) ao tocar nelas.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'OWL Hub', body: event.data ? event.data.text() : '' } }
  event.waitUntil(
    self.registration.showNotification(data.title || 'OWL Hub', {
      body: data.body || '',
      icon: '/icon',
      badge: '/icon',
      tag: data.tag,
      data: { url: data.url || '/reunioes' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/reunioes'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const external = /^https?:\/\//i.test(url)
      if (!external) {
        for (const c of list) {
          if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus() }
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
