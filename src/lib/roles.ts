// ── Central de roles ────────────────────────────────────────────────────────
// Para adicionar um email, basta preencher o valor da chave correspondente.
// Os emails em branco são ignorados automaticamente.

const USER_EMAILS: Record<string, string> = {
  gustavo: 'gustavomarinhoficial@gmail.com',
  gabriel: 'gabriel.almeidamr@gmail.com',
  thomas:  'ThomasMacedobr@gmail.com', // ← email do Thomas
  admin:   '', // ← email geral da Aura (vê tudo)
  julia:   '', // ← cole o email da Julia quando tiver
}

export type Role = 'gustavo' | 'gabriel' | 'thomas' | 'admin' | 'julia' | 'default'

const EMAIL_TO_ROLE: Record<string, Role> = Object.fromEntries(
  Object.entries(USER_EMAILS)
    .filter(([, email]) => email.trim() !== '')
    .map(([role, email]) => [email.toLowerCase(), role as Role])
)

export function getRole(email: string | undefined | null): Role {
  if (!email) return 'default'
  return EMAIL_TO_ROLE[email.toLowerCase()] ?? 'default'
}

export const ROLE_NAME: Record<Role, string> = {
  gustavo: 'Gustavo',
  gabriel: 'Gabriel',
  thomas:  'Thomas',
  admin:   'Aura',
  julia:   'Julia',
  default: '',
}

// Rotas bloqueadas para a Julia
export const BLOCKED_FOR_JULIA = [
  '/dashboard',
  '/pipeline',
  '/financeiro',
  '/metas',
  '/tarefas',
  '/configuracoes',
]

// Nav visível para a Julia (resto fica oculto no sidebar)
export const JULIA_NAV = ['/clientes', '/projetos', '/conteudo', '/ia', '/calendario']
