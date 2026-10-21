// Envia uma imagem (foto de perfil ou logo) direto pro R2 e devolve a URL pública.
// Reduz antes de enviar (máx. 512px) pra ficar leve e carregar rápido no Hub.

const MAX_SIDE = 512

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir essa imagem.')) }
    img.src = url
  })
}

async function shrink(file: File, asPng: boolean): Promise<{ blob: Blob; type: string; ext: string }> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const type = asPng ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, type, 0.9))
  if (!blob) throw new Error('Não consegui preparar a imagem.')
  return { blob, type, ext: asPng ? 'png' : 'jpg' }
}

// kind: "logo" mantém fundo transparente (PNG); "avatar" vira JPEG
export async function uploadImage(file: File, kind: 'logo' | 'avatar'): Promise<string> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|png|jpe?g|webp|svg)$/i.test(file.name)) {
    throw new Error('Escolha um arquivo de imagem.')
  }
  const { blob, type, ext } = await shrink(file, kind === 'logo')
  const presign = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: `${kind}.${ext}`, contentType: type }),
  })
  const info = await presign.json().catch(() => ({}))
  if (!presign.ok) throw new Error(info.error ?? `Erro ${presign.status}`)
  const put = await fetch(info.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type }, body: blob })
  if (!put.ok) throw new Error(`Erro ao enviar a imagem (${put.status})`)
  return info.publicUrl as string
}
