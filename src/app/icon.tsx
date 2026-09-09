import { ImageResponse } from 'next/og'
import { OWL_MARK_DATA_URI } from '@/lib/brand/owlMarkDataUri'

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={OWL_MARK_DATA_URI} width={340} height={340} alt="" />
      </div>
    ),
    { ...size }
  )
}
