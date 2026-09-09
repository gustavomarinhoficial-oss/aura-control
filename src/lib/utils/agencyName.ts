// Nome da agencia mostrado nas cobrancas (PIX/WhatsApp) e como "cliente"
// interno na Central de Conteudo — fica salvo por navegador em localStorage.
// Quem ja tinha o nome antigo salvo ("Aura MKT.CLUB", de antes do rebrand
// pra OWL Hub) e migrado pro novo padrao automaticamente na primeira leitura.
export const AGENCY_NAME_KEY = 'aura_agency_name'
export const DEFAULT_AGENCY_NAME = 'OWL Creative Club'
const OLD_AGENCY_NAME = 'Aura MKT.CLUB'

export function getAgencyName(): string {
  if (typeof window === 'undefined') return DEFAULT_AGENCY_NAME

  const stored = localStorage.getItem(AGENCY_NAME_KEY)
  if (stored === OLD_AGENCY_NAME) {
    localStorage.setItem(AGENCY_NAME_KEY, DEFAULT_AGENCY_NAME)
    return DEFAULT_AGENCY_NAME
  }
  return stored ?? DEFAULT_AGENCY_NAME
}
