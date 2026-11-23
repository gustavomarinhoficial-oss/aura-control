// Avatar redondo do cliente: a logo (como foto de perfil) ou, sem logo, a inicial do nome.
export function ClientAvatar({ name, logoUrl, size = 40, className = '' }: { name: string; logoUrl?: string | null; size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full shrink-0 overflow-hidden flex items-center justify-center ${logoUrl ? 'bg-white' : 'bg-[#efefef]/15'} ${className}`}
      style={{ width: size, height: size }}
    >
      {logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        : <span className="font-bold text-[#efefef]" style={{ fontSize: Math.round(size * 0.38) }}>{(name.trim()[0] ?? '?').toUpperCase()}</span>}
    </div>
  )
}
