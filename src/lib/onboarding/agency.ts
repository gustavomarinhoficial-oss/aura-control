// Dados da agência que aparecem nas instruções do formulário de onboarding.
// O e-mail de acesso e o WhatsApp vêm de variáveis de ambiente; enquanto não
// estiverem preenchidos, as instruções simplesmente omitem essas linhas.
export const AGENCY = {
  name: 'OWL Creative Club',
  short: 'OWL',
  // ID do portfólio empresarial da agência no Meta (aparece lá como "Aura Marketing Club").
  metaBusinessId: '191153621712940',
  metaBusinessName: 'Aura Marketing Club',
  accessEmail: process.env.NEXT_PUBLIC_OWL_ACCESS_EMAIL ?? 'gustavomarinhoficial@gmail.com',
  whatsapp: process.env.NEXT_PUBLIC_OWL_WHATSAPP ?? '',
}
