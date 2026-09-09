import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#111111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 96,
        }}
      >
        <svg width={340} height={340} viewBox="0 0 100 100">
          <polygon points="20,32 33,6 46,32" fill="#a78bfa" />
          <polygon points="54,32 67,6 80,32" fill="#a78bfa" />
          <circle cx="50" cy="58" r="34" fill="#a78bfa" />
          <circle cx="38" cy="54" r="11" fill="#111111" />
          <circle cx="62" cy="54" r="11" fill="#111111" />
          <circle cx="38" cy="54" r="4.5" fill="#a78bfa" />
          <circle cx="62" cy="54" r="4.5" fill="#a78bfa" />
          <polygon points="46,64 54,64 50,73" fill="#111111" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
