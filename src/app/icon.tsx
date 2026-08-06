import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
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
      <span
        style={{
          color: '#a78bfa',
          fontSize: 300,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-20px',
          fontFamily: 'serif',
        }}
      >
        a.
      </span>
    </div>,
    { ...size }
  )
}
