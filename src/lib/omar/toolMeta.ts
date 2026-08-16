export const TOOL_META: Record<string, { kind: 'consulting' | 'executing'; label: string }> = {
  get_dashboard_summary: { kind: 'consulting', label: 'Consultando visão geral' },
  list_clients: { kind: 'consulting', label: 'Consultando clientes' },
  list_tasks: { kind: 'consulting', label: 'Consultando tarefas' },
  list_projects: { kind: 'consulting', label: 'Consultando projetos' },
  get_financeiro_summary: { kind: 'consulting', label: 'Consultando financeiro' },
  list_members: { kind: 'consulting', label: 'Consultando equipe' },
  create_task: { kind: 'executing', label: 'Criando tarefa' },
  update_task: { kind: 'executing', label: 'Atualizando tarefa' },
  create_client: { kind: 'executing', label: 'Cadastrando cliente' },
  get_client_scope: { kind: 'consulting', label: 'Consultando escopo do cliente' },
  get_week_overview: { kind: 'consulting', label: 'Consultando a semana' },
  list_content: { kind: 'consulting', label: 'Consultando conteúdo' },
  update_content: { kind: 'executing', label: 'Atualizando conteúdo' },
  list_goals: { kind: 'consulting', label: 'Consultando metas' },
  list_pipeline: { kind: 'consulting', label: 'Consultando pipeline' },
  get_financial_history: { kind: 'consulting', label: 'Consultando histórico financeiro' },
}

export function toolMeta(name: string) {
  return TOOL_META[name] ?? { kind: 'consulting' as const, label: `Executando ${name}` }
}
