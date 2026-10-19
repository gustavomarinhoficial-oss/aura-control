import type { SupabaseClient } from '@supabase/supabase-js'

// Nomes que já são rotas do app: um cliente nunca pode ficar com um desses como link.
export const RESERVED_SLUGS = new Set([
  'api', 'login', 'publico', 'diagnostico', 'dashboard', 'clientes', 'financeiro', 'tarefas', 'conteudo', 'calendario',
  'reunioes', 'projetos', 'metas', 'ia', 'pipeline', 'relatorios', 'configuracoes', 'caixa', 'trafego', 'fdmc',
  'influenciadores', 'onboarding', 'admin', 'app', 'favicon.ico', 'icon', 'apple-icon', 'manifest.webmanifest', 'sw.js', 'robots.txt',
])

// "Magalhães & Silva Advogados" -> "magalhaes-silva-advogados"
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Sufixo curto e aleatório (sem letras/números que se confundem): dificulta chutar o link de outra empresa.
const SUFFIX_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export function randomSuffix(len = 5): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, b => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('')
}

// Gera o link do cliente: nome limpo + sufixo aleatório (ex.: stadium-steakhouse-x7k2m).
export async function uniqueSlug(supabase: SupabaseClient, name: string, ignoreClientId?: string): Promise<string> {
  const base = slugify(name) || 'cliente'
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${randomSuffix()}`
    const { data } = await supabase.from('clients').select('id').ilike('share_slug', candidate).limit(1)
    if (!(data ?? []).some(r => r.id !== ignoreClientId)) return candidate
  }
  return `${base}-${randomSuffix(8)}`
}

// Acha o cliente pelo link: aceita o token antigo (uuid) ou o nome na URL.
export async function findClientByShare<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  value: string,
  columns: string,
): Promise<T | null> {
  const v = decodeURIComponent(value).trim()
  const byToken = await supabase.from('clients').select(columns).eq('share_token', v).maybeSingle()
  if (byToken.data) return byToken.data as T
  const lower = v.toLowerCase()
  if (!/^[a-z0-9-]+$/.test(lower)) return null
  const bySlug = await supabase.from('clients').select(columns).ilike('share_slug', lower).maybeSingle()
  return (bySlug.data as T) ?? null
}
