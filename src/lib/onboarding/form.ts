import { AGENCY } from './agency'

// ── Tipos ────────────────────────────────────────────────────────────────────
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'password'
  | 'select' | 'radio' | 'checkboxes' | 'file'

// Condição pra mostrar um campo/seção: o valor de `field` é igual a `equals`
// ou (se for lista) contém algum item de `includes`.
export interface Cond { field: string; equals?: string; includes?: string[] }

export interface Option { value: string; label: string }

export interface Field {
  kind?: 'field'
  key: string
  label: string
  type: FieldType
  required?: boolean
  hint?: string
  placeholder?: string
  options?: Option[]
  showIf?: Cond
  // arquivos: pasta do Documentos e "slot" (nome que faz o arquivo cair no lugar certo da pasta)
  folder?: 'identidade-visual' | 'outros'
  slot?: string
  multiple?: boolean
  // campos de senha são mascarados no diagnóstico/exportações
  secret?: boolean
}

export interface Guide {
  kind: 'guide'
  key: string
  title: string
  steps: { text: string; link?: { label: string; url: string } }[]
  footer?: string
  showIf?: Cond
}

export interface Info { kind: 'info'; key: string; text: string; showIf?: Cond }

export type Block = Field | Guide | Info

export interface Section {
  id: string
  title: string
  subtitle?: string
  showIf?: Cond
  blocks: Block[]
}

export type Answers = Record<string, unknown>

export interface UploadedFile { path: string; name: string; size?: number }

// ── Condições ────────────────────────────────────────────────────────────────
export function isVisible(cond: Cond | undefined, answers: Answers): boolean {
  if (!cond) return true
  const v = answers[cond.field]
  const list = Array.isArray(v) ? v.map(String) : v === undefined || v === null || v === '' ? [] : [String(v)]
  if (cond.equals !== undefined) return list.includes(cond.equals)
  if (cond.includes) return cond.includes.some(i => list.includes(i))
  return list.length > 0
}

export const isField = (b: Block): b is Field => b.kind === undefined || b.kind === 'field'

// ── Opções reaproveitadas ────────────────────────────────────────────────────
const SIM_NAO: Option[] = [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]
const TENHO: Option[] = [
  { value: 'sim', label: 'Sim, tenho' },
  { value: 'nao', label: 'Não tenho' },
  { value: 'nao_sei', label: 'Não sei' },
]
const HAS = { field: '', equals: 'sim' }
const cond = (field: string, equals = 'sim'): Cond => ({ ...HAS, field, equals })

const FOOD: Cond = { field: 'segmento_tipo', equals: 'alimentacao' }

const accessEmailStep = AGENCY.accessEmail
  ? `Digite o e-mail de acesso da ${AGENCY.short}: ${AGENCY.accessEmail}`
  : `Digite o e-mail de acesso que a ${AGENCY.short} te passou`

const DUVIDA = `Ficou com dúvida? Fale com a gente${AGENCY.whatsapp ? ` no WhatsApp ${AGENCY.whatsapp}` : ''} que a gente te ajuda.`

// ── O formulário ─────────────────────────────────────────────────────────────
export const SECTIONS: Section[] = [
  {
    id: 'empresa',
    title: 'Sobre a empresa',
    subtitle: 'Os dados básicos pra gente te conhecer.',
    blocks: [
      { key: 'nome_fantasia', label: 'Nome fantasia', type: 'text', required: true },
      { key: 'razao_social', label: 'Razão social', type: 'text' },
      { key: 'cnpj', label: 'CNPJ', type: 'text' },
      {
        key: 'segmento_tipo', label: 'Qual é o tipo do seu negócio?', type: 'select', required: true,
        hint: 'Isso libera as perguntas certas pra você (por exemplo, delivery pra restaurantes).',
        options: [
          { value: 'alimentacao', label: 'Restaurante, bar, lanchonete, cafeteria ou similar' },
          { value: 'saude', label: 'Saúde, clínica ou bem-estar' },
          { value: 'juridico', label: 'Jurídico, contábil ou consultoria' },
          { value: 'varejo', label: 'Loja ou varejo' },
          { value: 'servicos', label: 'Serviços em geral' },
          { value: 'educacao', label: 'Educação ou cursos' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      { key: 'segmento_detalhe', label: 'Qual é o segmento, exatamente?', type: 'text', placeholder: 'Ex: churrascaria, clínica de fisioterapia, escritório de advocacia' },
      { key: 'tempo_empresa', label: 'Há quanto tempo a empresa existe?', type: 'text' },
      { key: 'site', label: 'Site', type: 'url', placeholder: 'https://' },
      { key: 'endereco', label: 'Endereço', type: 'text' },
      { key: 'cidade_uf', label: 'Cidade/UF', type: 'text' },
      { key: 'unidades', label: 'Quantas unidades ou filiais?', type: 'text' },
      { key: 'horario_funcionamento', label: 'Horário de funcionamento', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp principal da empresa', type: 'tel', required: true },
      { key: 'telefone', label: 'Telefone fixo (se tiver)', type: 'tel' },
      { key: 'email', label: 'E-mail principal da empresa', type: 'email', required: true },
      { key: 'responsavel_nome', label: 'Nome do responsável pela empresa', type: 'text', required: true },
      { key: 'responsavel_whatsapp', label: 'WhatsApp do responsável', type: 'tel', required: true },
      { key: 'mkt_resp_nome', label: 'Quem cuida da comunicação/marketing aí dentro?', type: 'text', hint: 'Se for a mesma pessoa, pode deixar em branco.' },
      { key: 'mkt_resp_whatsapp', label: 'WhatsApp dessa pessoa', type: 'tel' },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery e plataformas',
    subtitle: 'Só pra restaurantes, bares e similares.',
    showIf: FOOD,
    blocks: [
      { key: 'ifood_tem', label: 'A empresa está no iFood?', type: 'radio', options: SIM_NAO },
      { key: 'ifood_email', label: 'E-mail do iFood', type: 'email', showIf: cond('ifood_tem') },
      { key: 'ifood_senha', label: 'Senha do iFood', type: 'password', secret: true, showIf: cond('ifood_tem'), hint: 'Fica guardada com segurança; só a equipe vê.' },
      { key: 'ifood_mais', label: 'Tem mais de uma loja no iFood? Informe e-mail e senha de cada uma.', type: 'textarea', showIf: cond('ifood_tem') },
      { key: 'plat_propria_tem', label: 'A empresa tem uma plataforma própria de pedidos?', type: 'radio', options: SIM_NAO },
      { key: 'plat_propria_nome', label: 'Qual plataforma?', type: 'text', showIf: cond('plat_propria_tem') },
      { key: 'plat_propria_email', label: 'E-mail de acesso', type: 'email', showIf: cond('plat_propria_tem') },
      { key: 'plat_propria_senha', label: 'Senha de acesso', type: 'password', secret: true, showIf: cond('plat_propria_tem') },
      { key: 'outros_apps', label: 'Outros apps ou plataformas de pedido?', type: 'text', placeholder: 'Ex: Rappi, 99Food, Keeta, Anota Aí' },
    ],
  },
  {
    id: 'objetivos',
    title: 'Objetivos do marketing',
    subtitle: 'O que você espera alcançar com a gente.',
    blocks: [
      {
        key: 'objetivos', label: 'Qual é o principal objetivo com marketing? Marque quantos quiser.', type: 'checkboxes', required: true,
        options: [
          { value: 'vendas', label: 'Aumentar vendas' },
          { value: 'leads', label: 'Gerar leads' },
          { value: 'marca', label: 'Aumentar o reconhecimento da marca' },
          { value: 'movimento', label: 'Aumentar o movimento da loja/unidade' },
          { value: 'pedidos', label: 'Aumentar pedidos online' },
          { value: 'seguidores', label: 'Aumentar seguidores e presença digital' },
          { value: 'trafego_site', label: 'Aumentar o tráfego para o site' },
        ],
      },
      { key: 'objetivo_outro', label: 'Outro objetivo?', type: 'text' },
      { key: 'meta_3m', label: 'Qual é a principal meta para os próximos 3 meses?', type: 'textarea', required: true },
      { key: 'meta_6m', label: 'E para os próximos 6 meses?', type: 'textarea' },
      { key: 'meta_numerica', label: 'Existe alguma meta específica de faturamento, vendas, leads ou pedidos?', type: 'text', placeholder: 'Ex: chegar a 300 pedidos por mês' },
    ],
  },
  {
    id: 'marca',
    title: 'Posicionamento e marca',
    subtitle: 'Quanto mais você contar, mais personalizado fica o conteúdo.',
    blocks: [
      { key: 'missao', label: 'Qual é a missão da empresa?', type: 'textarea' },
      { key: 'visao', label: 'Qual é a visão da empresa?', type: 'textarea' },
      { key: 'valores', label: 'Quais são os principais valores?', type: 'textarea' },
      { key: 'percepcao', label: 'Como vocês querem que a marca seja percebida pelo público?', type: 'textarea' },
      { key: 'personalidade', label: 'Quais características definem a personalidade da marca?', type: 'textarea' },
      { key: 'slogan', label: 'Existe algum slogan?', type: 'text' },
      {
        key: 'tom', label: 'Tom de comunicação desejado', type: 'checkboxes',
        options: ['Formal', 'Informal', 'Técnico', 'Divertido', 'Premium', 'Popular', 'Inspirador'].map(v => ({ value: v, label: v })),
      },
      { key: 'tom_outro', label: 'Outro tom?', type: 'text' },
      { key: 'publico_alvo', label: 'Quem é o público principal? (idade, perfil, comportamento)', type: 'textarea' },
      { key: 'concorrentes', label: 'Quem são os 2 ou 3 principais concorrentes?', type: 'textarea', hint: 'Se tiver, coloque o @ do Instagram deles.' },
      { key: 'produtos_principais', label: 'Quais são os principais produtos ou serviços?', type: 'textarea' },
      { key: 'ticket_medio', label: 'Qual é o ticket médio?', type: 'text' },
      { key: 'promocoes', label: 'Existem promoções ou ações que se repetem?', type: 'textarea', placeholder: 'Ex: happy hour toda quinta, combo de fim de semana' },
      { key: 'datas_sazonais', label: 'Quais datas ou épocas são importantes pro seu negócio?', type: 'textarea', placeholder: 'Ex: Dia dos Namorados, Black Friday, alta temporada' },
      { key: 'evitar', label: 'Tem algo que a marca NÃO deve falar ou mostrar?', type: 'textarea' },
      { key: 'referencias', label: 'Tem marcas ou perfis que vocês admiram e gostariam de se aproximar?', type: 'textarea' },
    ],
  },
  {
    id: 'comercial',
    title: 'Processo comercial',
    subtitle: 'Como os clientes chegam e quem atende.',
    blocks: [
      { key: 'leads_quem', label: 'Quem recebe os contatos gerados pelo marketing?', type: 'text' },
      {
        key: 'canais_contato', label: 'Por quais canais os clientes costumam entrar em contato?', type: 'checkboxes',
        options: ['WhatsApp', 'Instagram', 'Site', 'Telefone', 'Formulário', 'CRM'].map(v => ({ value: v, label: v })),
      },
      { key: 'canais_outro', label: 'Outro canal?', type: 'text' },
    ],
  },
  {
    id: 'acessos',
    title: 'Redes sociais e acessos',
    subtitle: 'O jeito mais seguro é adicionar a OWL como parceira: você não precisa passar senha.',
    blocks: [
      { key: 'instagram_handle', label: 'Instagram da empresa', type: 'text', required: true, placeholder: '@suaempresa' },
      { key: 'instagram_login', label: 'Login ou e-mail do Instagram', type: 'text', hint: 'Pode passar o acesso do Instagram. Fica guardado com segurança e só a equipe vê.' },
      { key: 'instagram_senha', label: 'Senha do Instagram', type: 'password', secret: true },
      { key: 'facebook_link', label: 'Página do Facebook', type: 'url', placeholder: 'Link da página' },
      { key: 'tiktok', label: 'TikTok', type: 'text', placeholder: '@ ou link' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'Link da página' },
      { key: 'youtube', label: 'YouTube', type: 'text', placeholder: '@ ou link do canal' },

      { key: 'meta_status', label: 'Vocês têm Meta Business (Facebook, Instagram e anúncios)?', type: 'radio', options: TENHO },
      {
        kind: 'guide', key: 'guide_meta_partner', title: `Como adicionar a ${AGENCY.short} como parceira no Meta`,
        showIf: cond('meta_status'),
        steps: [
          { text: 'Abra as configurações de parceiros do seu Meta Business.', link: { label: 'business.facebook.com/settings/partners', url: 'https://business.facebook.com/settings/partners' } },
          { text: 'Clique em "Adicionar" e depois em "Dar acesso a um parceiro".' },
          { text: `Cole o ID do portfólio da ${AGENCY.short}: ${AGENCY.metaBusinessId}. (No Meta ele aparece como "${AGENCY.metaBusinessName}": é a nossa conta.)` },
          { text: 'Marque a Página, o Instagram e a conta de anúncios, com acesso total, e confirme.' },
        ],
        footer: DUVIDA,
      },
      { key: 'meta_parceira_feito', label: `Já adicionou a ${AGENCY.short} como parceira?`, type: 'radio', showIf: cond('meta_status'), options: [{ value: 'sim', label: 'Sim, já adicionei' }, { value: 'ainda_nao', label: 'Ainda não' }] },
      {
        kind: 'guide', key: 'guide_meta_create', title: 'Como criar o Meta Business',
        showIf: { field: 'meta_status', includes: ['nao', 'nao_sei'] },
        steps: [
          { text: 'Acesse o Meta Business e clique em "Criar conta".', link: { label: 'business.facebook.com', url: 'https://business.facebook.com/' } },
          { text: 'Informe o nome da empresa, seu nome e e-mail.' },
          { text: 'Crie (ou conecte) a Página do Facebook e o Instagram da empresa.' },
          { text: `Pronto! Depois é só voltar aqui e adicionar a ${AGENCY.short} como parceira, seguindo o passo a passo.` },
        ],
        footer: DUVIDA,
      },

      { key: 'gmn_status', label: 'A empresa tem Google Meu Negócio (Perfil da Empresa no Google)?', type: 'radio', options: TENHO },
      { key: 'gmn_link', label: 'Link do perfil no Google', type: 'url', showIf: cond('gmn_status') },
      {
        kind: 'guide', key: 'guide_gmn_partner', title: `Como dar acesso ao Google Meu Negócio para a ${AGENCY.short}`,
        showIf: cond('gmn_status'),
        steps: [
          { text: 'Abra o Perfil da Empresa e selecione a sua empresa.', link: { label: 'business.google.com', url: 'https://business.google.com/' } },
          { text: 'Vá em "Configurações da empresa" e depois em "Gerentes" (ou "Pessoas e acesso").' },
          { text: 'Clique em "Adicionar".' },
          { text: accessEmailStep },
          { text: 'Escolha a função "Gerente" e envie o convite.' },
        ],
        footer: DUVIDA,
      },
      {
        kind: 'guide', key: 'guide_gmn_create', title: 'Como criar o perfil no Google Meu Negócio',
        showIf: { field: 'gmn_status', includes: ['nao', 'nao_sei'] },
        steps: [
          { text: 'Acesse o Perfil da Empresa e clique em "Gerenciar agora".', link: { label: 'business.google.com', url: 'https://business.google.com/' } },
          { text: 'Informe o nome, a categoria e o endereço da empresa.' },
          { text: 'O Google pede uma verificação (por ligação, SMS ou carta). Siga as instruções da tela.' },
        ],
        footer: DUVIDA,
      },

      { key: 'gads_status', label: 'A empresa tem conta no Google Ads?', type: 'radio', options: TENHO },
      {
        kind: 'guide', key: 'guide_gads_partner', title: `Como dar acesso ao Google Ads para a ${AGENCY.short}`,
        showIf: cond('gads_status'),
        steps: [
          { text: 'Entre na sua conta do Google Ads.', link: { label: 'ads.google.com', url: 'https://ads.google.com/' } },
          { text: 'Vá em "Administrador" (ou "Ferramentas") e depois em "Acesso e segurança".' },
          { text: 'Na aba "Usuários", clique no botão "+".' },
          { text: accessEmailStep },
          { text: 'Escolha o nível "Administrador" e envie o convite.' },
        ],
        footer: DUVIDA,
      },
      {
        kind: 'guide', key: 'guide_gads_create', title: 'Como criar uma conta no Google Ads',
        showIf: { field: 'gads_status', includes: ['nao', 'nao_sei'] },
        steps: [
          { text: 'Acesse o Google Ads e clique em "Começar agora".', link: { label: 'ads.google.com', url: 'https://ads.google.com/' } },
          { text: 'Entre com o e-mail da empresa e siga as etapas (pode pular a criação de campanha).' },
          { text: `Depois volte aqui e dê acesso à ${AGENCY.short}.` },
        ],
        footer: DUVIDA,
      },

      { key: 'ga_status', label: 'A empresa usa Google Analytics?', type: 'radio', options: TENHO },
      {
        kind: 'guide', key: 'guide_ga_partner', title: `Como dar acesso ao Google Analytics para a ${AGENCY.short}`,
        showIf: cond('ga_status'),
        steps: [
          { text: 'Abra o Google Analytics e vá em "Administrador".', link: { label: 'analytics.google.com', url: 'https://analytics.google.com/' } },
          { text: 'Em "Gerenciamento de acesso à conta", clique no "+" e em "Adicionar usuários".' },
          { text: accessEmailStep },
          { text: 'Escolha a função "Editor" e confirme.' },
        ],
        footer: DUVIDA,
      },
    ],
  },
  {
    id: 'emails',
    title: 'E-mails da empresa',
    subtitle: 'Opcional: e-mails por área, se existirem.',
    blocks: [
      { key: 'email_marketing', label: 'E-mail do Marketing', type: 'email' },
      { key: 'email_marketing_resp', label: 'Responsável', type: 'text' },
      { key: 'email_comercial', label: 'E-mail do Comercial', type: 'email' },
      { key: 'email_comercial_resp', label: 'Responsável', type: 'text' },
      { key: 'email_financeiro', label: 'E-mail do Financeiro', type: 'email' },
      { key: 'email_financeiro_resp', label: 'Responsável', type: 'text' },
      { key: 'email_atendimento', label: 'E-mail do Atendimento', type: 'email' },
      { key: 'email_atendimento_resp', label: 'Responsável', type: 'text' },
      { key: 'email_outro', label: 'Existe outro e-mail que a agência precise conhecer?', type: 'email' },
      { key: 'email_outro_resp', label: 'Responsável', type: 'text' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    subtitle: 'Como funciona o atendimento pelo WhatsApp.',
    blocks: [
      { key: 'wa_tem', label: 'A empresa atende clientes pelo WhatsApp?', type: 'radio', options: SIM_NAO },
      { key: 'wa_numero', label: 'Número comercial', type: 'tel', showIf: cond('wa_tem') },
      { key: 'wa_business', label: 'É WhatsApp Business?', type: 'radio', options: SIM_NAO, showIf: cond('wa_tem') },
      { key: 'wa_integracao', label: 'Existe integração com alguma plataforma? Qual?', type: 'text', showIf: cond('wa_tem') },
      { key: 'wa_crm', label: 'Existe integração com CRM? Qual?', type: 'text', showIf: cond('wa_tem') },
      { key: 'wa_bot', label: 'Existe chatbot ou automação? Qual?', type: 'text', showIf: cond('wa_tem') },
      { key: 'wa_quem', label: 'Quem responde o WhatsApp?', type: 'text', showIf: cond('wa_tem') },
      { key: 'wa_horario', label: 'Horário de atendimento', type: 'text', showIf: cond('wa_tem') },
      { key: 'wa_msg_auto', label: 'Existe mensagem automática? Qual?', type: 'textarea', showIf: cond('wa_tem') },
      { key: 'wa_mais_numeros', label: 'Existe mais de um número de WhatsApp na empresa? Quais?', type: 'text', showIf: cond('wa_tem') },
    ],
  },
  {
    id: 'trafego',
    title: 'Tráfego pago',
    subtitle: 'Anúncios no Instagram, Facebook e Google.',
    blocks: [
      { key: 'trafego_ja_faz', label: 'A empresa já investe em anúncios?', type: 'radio', options: SIM_NAO },
      { key: 'trafego_verba', label: 'Quanto pretende investir por mês em anúncios?', type: 'text', placeholder: 'Ex: R$ 2.000' },
      {
        key: 'trafego_acesso', label: `Quer dar acesso às contas de anúncios para a ${AGENCY.short} cuidar?`, type: 'radio',
        options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'depois', label: 'Decido depois' }],
      },
      { key: 'meta_ads_id', label: 'ID da conta de anúncios do Meta', type: 'text', showIf: cond('trafego_acesso'), hint: 'No Gerenciador de Anúncios, o número aparece no topo, ao lado do nome da conta. Se não souber, sem problema: a gente encontra depois.' },
      { key: 'google_ads_id', label: 'ID da conta do Google Ads', type: 'text', showIf: cond('trafego_acesso'), placeholder: '000-000-0000', hint: 'Fica no topo da tela do Google Ads. Se não souber, sem problema: a gente encontra depois.' },
      { key: 'trafego_obs', label: 'Algo importante sobre as contas de anúncios?', type: 'textarea', showIf: cond('trafego_acesso') },
    ],
  },
  {
    id: 'materiais',
    title: 'Materiais da empresa',
    subtitle: 'Logos e arquivos. Pra fotos e vídeos, um link do Drive resolve.',
    blocks: [
      { key: 'logo_alta', label: 'Logo em alta resolução', type: 'file', required: true, folder: 'identidade-visual', slot: 'Logo colorida' },
      { key: 'logo_png', label: 'Logo em PNG, sem fundo', type: 'file', required: true, folder: 'identidade-visual', slot: 'Logo PNG' },
      { key: 'logo_vetor', label: 'Logo em vetor (se tiver)', type: 'file', folder: 'identidade-visual', slot: 'Logo vetor (AI/EPS/SVG)', hint: 'Arquivos AI, EPS, SVG ou PDF.' },
      { key: 'manual_marca', label: 'Manual da marca (se existir)', type: 'file', folder: 'identidade-visual', slot: 'Manual de marca' },
      { key: 'paleta_arquivo', label: 'Paleta de cores (arquivo)', type: 'file', folder: 'identidade-visual', slot: 'Paleta de cores (hex/RGB/CMYK)' },
      { key: 'cores_texto', label: 'Cores da marca', type: 'text', placeholder: 'Ex: #111111, dourado, branco' },
      { key: 'fontes_texto', label: 'Fontes/tipografias usadas', type: 'text', placeholder: 'Nome das fontes' },
      { key: 'fontes_arquivo', label: 'Arquivos das fontes (se tiver)', type: 'file', multiple: true, folder: 'identidade-visual', slot: 'Tipografia' },
      { key: 'banco_fotos_link', label: 'Link do banco de fotos', type: 'url', placeholder: 'Google Drive, Dropbox, etc.' },
      { key: 'banco_fotos_arquivo', label: 'Ou envie algumas fotos aqui', type: 'file', multiple: true, folder: 'outros', slot: 'Banco de fotos' },
      { key: 'banco_videos_link', label: 'Link do banco de vídeos', type: 'url', placeholder: 'Google Drive, Dropbox, etc.' },
      { key: 'banco_videos_arquivo', label: 'Ou envie alguns vídeos aqui', type: 'file', multiple: true, folder: 'outros', slot: 'Banco de vídeos' },
      { key: 'cardapio_link', label: 'Link do cardápio', type: 'url', showIf: FOOD },
      { key: 'cardapio_arquivo', label: 'Ou envie o cardápio', type: 'file', multiple: true, folder: 'outros', slot: 'Cardápio', showIf: FOOD },
    ],
  },
  {
    id: 'aprovacao',
    title: 'Aprovação de conteúdo',
    subtitle: 'Quem aprova os posts antes de irem ao ar.',
    blocks: [
      { key: 'aprov_nome', label: 'Nome do responsável pela aprovação', type: 'text', required: true },
      { key: 'aprov_whatsapp', label: 'WhatsApp', type: 'tel', required: true },
      { key: 'aprov_email', label: 'E-mail', type: 'email' },
    ],
  },
  {
    id: 'diagnostico',
    title: 'Diagnóstico final',
    subtitle: 'Últimas perguntas: elas fazem toda a diferença no nosso planejamento.',
    blocks: [
      { key: 'maior_problema', label: 'Qual é o maior problema da empresa hoje?', type: 'textarea', required: true },
      { key: 'esperam_resolver', label: 'O que vocês esperam que a nossa agência resolva?', type: 'textarea', required: true },
      { key: 'meta_90_dias', label: 'Se pudéssemos resolver apenas uma coisa nos próximos 90 dias, o que deveria ser?', type: 'textarea', required: true },
      { key: 'diferencial', label: 'O que vocês acreditam que diferencia a empresa dos concorrentes?', type: 'textarea' },
      { key: 'por_que_escolher', label: 'Por que um cliente deveria escolher a empresa em vez de outra?', type: 'textarea' },
      { key: 'dificuldade_comercial', label: 'Qual é a maior dificuldade comercial da empresa atualmente?', type: 'textarea' },
      { key: 'dificuldade_marketing', label: 'Qual é a maior dificuldade de marketing atualmente?', type: 'textarea' },
      { key: 'info_extra', label: 'Existe alguma informação importante que ainda não perguntamos?', type: 'textarea' },
    ],
  },
]

// ── Utilidades ───────────────────────────────────────────────────────────────
export function allFields(): Field[] {
  return SECTIONS.flatMap(s => s.blocks.filter(isField))
}

export function fieldByKey(key: string): Field | undefined {
  return allFields().find(f => f.key === key)
}

export function visibleSections(answers: Answers): Section[] {
  return SECTIONS.filter(s => isVisible(s.showIf, answers))
}

export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

// Campos obrigatórios que estão visíveis e ainda vazios.
export function missingRequired(answers: Answers): { section: Section; field: Field }[] {
  const out: { section: Section; field: Field }[] = []
  for (const s of visibleSections(answers)) {
    for (const b of s.blocks) {
      if (!isField(b) || !b.required) continue
      if (!isVisible(b.showIf, answers)) continue
      if (!isFilled(answers[b.key])) out.push({ section: s, field: b })
    }
  }
  return out
}

// "Slug" usado pelo Documentos pra reconhecer o arquivo no slot certo.
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Só guarda chaves que existem no formulário e valores no formato esperado.
export function sanitizeAnswers(raw: unknown, clientId: string): Answers {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Answers = {}
  for (const f of allFields()) {
    const v = input[f.key]
    if (v === undefined || v === null) continue
    if (f.type === 'file') {
      if (!Array.isArray(v)) continue
      const files = v
        .map(x => x as Partial<UploadedFile>)
        .filter(x => typeof x?.path === 'string' && x.path.startsWith(`${clientId}/`) && typeof x?.name === 'string')
        .slice(0, f.multiple ? 30 : 1)
        .map(x => ({ path: x.path as string, name: String(x.name).slice(0, 200), size: typeof x.size === 'number' ? x.size : undefined }))
      if (files.length) out[f.key] = files
    } else if (f.type === 'checkboxes') {
      if (!Array.isArray(v)) continue
      const allowed = new Set((f.options ?? []).map(o => o.value))
      const picked = v.map(String).filter(x => allowed.has(x))
      if (picked.length) out[f.key] = picked
    } else {
      const s = String(v).slice(0, 5000)
      if (s.trim() !== '') out[f.key] = s
    }
  }
  return out
}
