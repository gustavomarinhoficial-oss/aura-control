import type { SupabaseClient } from '@supabase/supabase-js'
import { fieldByKey, isFilled, type Answers } from './form'

type Contact = { name: string; role: string; contact: string }
type Social = { platform: string; handle: string }
type LinkEntry = { label: string; url: string }
type Password = { label: string; username: string; password: string; url: string }

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function labelsOf(key: string, v: unknown): string {
  const f = fieldByKey(key)
  if (!Array.isArray(v)) return ''
  const map = new Map((f?.options ?? []).map(o => [o.value, o.label]))
  return v.map(x => map.get(String(x)) ?? String(x)).join(', ')
}

function lines(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n')
}

const labelled = (label: string, v: unknown) => (s(v) ? `${label}: ${s(v)}` : '')

// Preenche o Hub da marca e o cadastro do cliente com o que veio do formulário.
// Regra: só preenche o que está VAZIO — nunca sobrescreve o que a equipe já escreveu.
export async function applyOnboarding(supabase: SupabaseClient, clientId: string, a: Answers): Promise<{ filled: string[] }> {
  const filled: string[] = []

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
  const { data: extrasRow } = await supabase.from('client_extras').select('*').eq('client_id', clientId).maybeSingle()
  const cur = (extrasRow ?? {}) as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  const fillText = (col: string, value: string) => {
    if (value && !isFilled(cur[col])) { patch[col] = value; filled.push(col) }
  }

  // ── Textos do Hub da marca ──
  fillText('mission', lines(s(a.missao), labelled('Visão', a.visao), labelled('Valores', a.valores)))
  fillText('positioning', lines(
    labelled('Como querem ser percebidos', a.percepcao),
    labelled('Personalidade da marca', a.personalidade),
    labelled('Slogan', a.slogan),
    labelled('Diferencial', a.diferencial),
    labelled('Por que escolher a empresa', a.por_que_escolher),
    labelled('Referências', a.referencias),
  ))
  fillText('target_audience', s(a.publico_alvo))
  fillText('competitors', s(a.concorrentes))
  fillText('tone_of_voice', lines(labelsOf('tom', a.tom), s(a.tom_outro)).replace(/\n/g, ', '))
  fillText('avoid_topics', s(a.evitar))
  fillText('brand_colors', s(a.cores_texto))
  fillText('products_services', lines(s(a.produtos_principais), labelled('Ticket médio', a.ticket_medio)))
  fillText('recurring_promos', lines(s(a.promocoes), labelled('Datas importantes', a.datas_sazonais)))
  fillText('content_goal', lines(labelled('Meta em 3 meses', a.meta_3m), labelled('Meta em 6 meses', a.meta_6m)))
  fillText('objectives', lines(
    labelled('Objetivos', lines(labelsOf('objetivos', a.objetivos), s(a.objetivo_outro)).replace(/\n/g, ', ')),
    labelled('Meta em 3 meses', a.meta_3m),
    labelled('Meta em 6 meses', a.meta_6m),
    labelled('Meta específica', a.meta_numerica),
    labelled('Maior problema da empresa', a.maior_problema),
    labelled('O que esperam que a agência resolva', a.esperam_resolver),
    labelled('Prioridade nos próximos 90 dias', a.meta_90_dias),
    labelled('Maior dificuldade comercial', a.dificuldade_comercial),
    labelled('Maior dificuldade de marketing', a.dificuldade_marketing),
    labelled('Informação extra', a.info_extra),
  ))

  // ── Responsáveis ──
  const contacts = ((cur.responsible_contacts as Contact[] | undefined) ?? [])
  if (contacts.length === 0) {
    const list: Contact[] = []
    if (s(a.responsavel_nome)) list.push({ name: s(a.responsavel_nome), role: 'Responsável pela empresa', contact: s(a.responsavel_whatsapp) })
    if (s(a.mkt_resp_nome)) list.push({ name: s(a.mkt_resp_nome), role: 'Comunicação/Marketing', contact: s(a.mkt_resp_whatsapp) })
    if (s(a.aprov_nome)) list.push({ name: s(a.aprov_nome), role: 'Aprova os conteúdos', contact: [s(a.aprov_whatsapp), s(a.aprov_email)].filter(Boolean).join(' · ') })
    if (s(a.leads_quem)) list.push({ name: s(a.leads_quem), role: 'Recebe os leads', contact: '' })
    if (list.length) { patch.responsible_contacts = list; filled.push('responsible_contacts') }
  }

  // ── Redes sociais (adiciona o que ainda não existe) ──
  const social = [...((cur.social_media as Social[] | undefined) ?? [])]
  const addSocial = (platform: string, handle: string) => {
    if (!handle) return
    if (social.some(x => x.platform.toLowerCase() === platform.toLowerCase())) return
    social.push({ platform, handle }); filled.push(`social:${platform}`)
  }
  addSocial('Instagram', s(a.instagram_handle))
  addSocial('Facebook', s(a.facebook_link))
  addSocial('TikTok', s(a.tiktok))
  addSocial('LinkedIn', s(a.linkedin))
  addSocial('YouTube', s(a.youtube))

  // ── Links úteis ──
  const links = [...((cur.links as LinkEntry[] | undefined) ?? [])]
  const addLink = (label: string, url: string) => {
    if (!url || links.some(l => l.url === url)) return
    links.push({ label, url }); filled.push(`link:${label}`)
  }
  addLink('Site', s(a.site))
  addLink('Google Meu Negócio', s(a.gmn_link))
  addLink('Logo principal', s(a.logo_alta_link))
  addLink('Logo PNG', s(a.logo_png_link))
  addLink('Banco de fotos', s(a.banco_fotos_link))
  addLink('Banco de vídeos', s(a.banco_videos_link))
  addLink('Cardápio', s(a.cardapio_link))

  // ── Senhas / acessos ──
  const passwords = [...((cur.passwords as Password[] | undefined) ?? [])]
  const addPassword = (label: string, username: string, password: string) => {
    if (!password && !username) return
    if (passwords.some(p => p.label.toLowerCase() === label.toLowerCase())) return
    passwords.push({ label, username, password, url: '' }); filled.push(`senha:${label}`)
  }
  addPassword('Instagram', s(a.instagram_login), s(a.instagram_senha))
  addPassword('iFood', s(a.ifood_email), s(a.ifood_senha))
  if (s(a.ifood_mais)) addPassword('iFood (outras lojas)', s(a.ifood_mais), '')
  addPassword(s(a.plat_propria_nome) ? `Plataforma própria (${s(a.plat_propria_nome)})` : 'Plataforma própria', s(a.plat_propria_email), s(a.plat_propria_senha))

  // Sempre manda os arrays completos: a tabela pode ter essas colunas como NOT NULL.
  const payload = {
    client_id: clientId,
    objectives: (patch.objectives as string | undefined) ?? (cur.objectives as string | undefined) ?? '',
    ...patch,
    responsible_contacts: (patch.responsible_contacts as Contact[] | undefined) ?? contacts,
    social_media: social,
    links,
    passwords,
    updated_at: new Date().toISOString(),
  }
  const { error: extrasErr } = await supabase.from('client_extras').upsert(payload, { onConflict: 'client_id' })
  if (extrasErr) throw new Error(extrasErr.message)

  // ── Cadastro do cliente (só se estiver vazio) ──
  const cl: Record<string, unknown> = {}
  if (client && !isFilled(client.email) && s(a.email)) { cl.email = s(a.email); filled.push('client:email') }
  if (client && !isFilled(client.phone) && (s(a.whatsapp) || s(a.telefone))) { cl.phone = s(a.whatsapp) || s(a.telefone); filled.push('client:phone') }
  if (client && !isFilled(client.notes)) {
    const tipo = fieldByKey('segmento_tipo')?.options?.find(o => o.value === a.segmento_tipo)?.label
    const seg = lines(tipo && `Segmento: ${tipo}${s(a.segmento_detalhe) ? ` — ${s(a.segmento_detalhe)}` : ''}`)
    if (seg) { cl.notes = seg; filled.push('client:notes') }
  }
  if (client && !isFilled(client.meta_ad_account_id) && a.trafego_acesso === 'sim') {
    const id = s(a.meta_ads_id).replace(/\D/g, '')
    if (id) { cl.meta_ad_account_id = id; filled.push('client:meta_ad_account_id') }
  }
  if (Object.keys(cl).length) {
    const { error } = await supabase.from('clients').update(cl).eq('id', clientId)
    if (error) throw new Error(error.message)
  }

  return { filled }
}
