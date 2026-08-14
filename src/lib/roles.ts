export type Role = 'gustavo' | 'gabriel' | 'thomas' | 'admin' | 'julia' | 'default'

const ROLE_MAP: Record<string, Role> = {
  'gustavomarinhoficial@gmail.com': 'gustavo',
  'camachojulia211@gmail.com':      'julia',
}

export function getRole(email: string): Role {
  return ROLE_MAP[email.toLowerCase()] ?? 'default'
}

export const ROLE_NAME: Record<Role, string> = {
  gustavo: 'Gustavo',
  gabriel: 'Gabriel',
  thomas:  'Thomas',
  admin:   'Admin',
  julia:   'Julia',
  default: '',
}

// Rotas visíveis para a Julia
export const JULIA_NAV = [
  '/dashboard',
  '/projetos',
  '/conteudo',
  '/ia',
  '/metas',
  '/tarefas',
  '/calendario',
]

// Rotas bloqueadas para a Julia (middleware redireciona)
export const BLOCKED_FOR_JULIA = [
  '/pipeline',
  '/clientes',
  '/financeiro',
  '/configuracoes',
]

// Membros cujas tarefas a Julia pode ver
export const JULIA_TASK_MEMBERS = ['Julia', 'Gabriel']
