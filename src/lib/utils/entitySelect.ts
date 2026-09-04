// Combina cliente e lead num único <select>: cliente usa o id puro (mesmo
// formato de sempre), lead usa o prefixo "lead:" pra não colidir.
export function leadOptionValue(leadId: string): string {
  return `lead:${leadId}`
}

export function decodeEntitySelect(raw: string): { client_id: string | null; lead_id: string | null } {
  if (raw.startsWith('lead:')) return { client_id: null, lead_id: raw.slice(5) }
  return { client_id: raw || null, lead_id: null }
}

export interface LeadOption { id: string; company_name: string }
