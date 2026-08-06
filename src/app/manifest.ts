import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aura Control',
    short_name: 'Aura',
    description: 'Gestão interna da Aura MKT.CLUB',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
