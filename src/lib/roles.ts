export type Role = 'gustavo' | 'gabriel' | 'thomas' | 'admin' | 'julia' | 'mariana' | 'default'

const VALID_ROLES = new Set<string>(['gustavo', 'gabriel', 'thomas', 'admin', 'julia', 'mariana'])

// Role vem do user_metadata do Supabase (campo "role"), configurado no painel admin
export function getRole(userMetadata?: Record<string, unknown> | null): Role {
  const r = userMetadata?.role
  if (typeof r === 'string' && VALID_ROLES.has(r)) return r as Role
  return 'default'
}

export const ROLE_NAME: Record<Role, string> = {
  gustavo: 'Gustavo',
  gabriel: 'Gabriel',
  thomas:  'Thomas',
  admin:   'Admin',
  julia:   'Julia',
  mariana: 'Mariana',
  default: '',
}

// Rotas visíveis para a Julia, na ordem que aparece na sidebar
export const JULIA_NAV = [
  '/dashboard',
  '/conteudo',
  '/clientes',
  '/tarefas',
  '/reunioes',
  '/calendario',
  '/projetos',
  '/metas',
  '/ia',
]

// Rotas bloqueadas para a Julia (middleware redireciona)
export const BLOCKED_FOR_JULIA = [
  '/pipeline',
  '/financeiro',
  '/configuracoes',
  '/relatorios',
]

// Membros cujas tarefas a Julia pode ver
export const JULIA_TASK_MEMBERS = ['Julia', 'Gabriel']

// Rotas visíveis pra Mariana (assistente executiva), na ordem da sidebar —
// foco em agenda/organização; conteúdo é a última prioridade dela.
export const MARIANA_NAV = [
  '/dashboard',
  '/tarefas',
  '/reunioes',
  '/calendario',
  '/clientes',
  '/influenciadores',
  '/conteudo',
]

// Rotas bloqueadas pra Mariana (middleware redireciona) — sem acesso a
// números internos da empresa (financeiro, pipeline, relatórios) nem config
export const BLOCKED_FOR_MARIANA = [
  '/pipeline',
  '/financeiro',
  '/configuracoes',
  '/relatorios',
  '/projetos',
  '/metas',
  '/ia',
]
