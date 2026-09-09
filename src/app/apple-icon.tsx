import { ImageResponse } from 'next/og'
import { OWL_MARK_DATA_URI } from '@/lib/brand/owlMarkDataUri'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={OWL_MARK_DATA_URI} width={120} height={120} alt="" />
      </div>
    ),
    { ...size }
  )
}
