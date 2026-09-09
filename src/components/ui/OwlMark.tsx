// Marca da OWL Creative Club — coruja flat de duas cores, pra reusar em
// sidebar, login e favicons sem duplicar a geometria em cada lugar.
export function OwlMark({
  size = 24,
  color = '#a78bfa',
  cutout = '#111111',
}: {
  size?: number
  color?: string
  cutout?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polygon points="20,32 33,6 46,32" fill={color} />
      <polygon points="54,32 67,6 80,32" fill={color} />
      <circle cx="50" cy="58" r="34" fill={color} />
      <circle cx="38" cy="54" r="11" fill={cutout} />
      <circle cx="62" cy="54" r="11" fill={cutout} />
      <circle cx="38" cy="54" r="4.5" fill={color} />
      <circle cx="62" cy="54" r="4.5" fill={color} />
      <polygon points="46,64 54,64 50,73" fill={cutout} />
    </svg>
  )
}
