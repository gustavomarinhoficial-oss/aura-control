// Marca oficial da OWL Creative Club (public/owl-mark.png) — reusada no
// sidebar e no login. Ícones/favicon usam o mesmo arquivo, mas embutido como
// data URI (ver src/lib/brand/owlMarkDataUri.ts) porque rodam em edge runtime
// e não tem acesso ao filesystem público em tempo de request.
export function OwlMark({ size = 24 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/owl-mark.png" alt="" width={size} height={size} style={{ width: size, height: size }} />
  )
}
