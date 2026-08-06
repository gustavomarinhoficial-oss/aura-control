import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: '#111111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: '#a78bfa',
          fontSize: 108,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-8px',
          fontFamily: 'serif',
        }}
      >
        a.
      </span>
    </div>,
    { ...size }
  )
}
