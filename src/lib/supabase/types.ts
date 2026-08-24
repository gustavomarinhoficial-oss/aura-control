export type ClientStatus = 'ativo' | 'pausado' | 'encerrado'
export type ServiceType = 'recorrente' | 'avulso'
export type ServiceRecurrence = 'mensal' | 'trimestral' | 'anual' | 'único'
export type ChargeStatus = 'pendente' | 'pago' | 'atrasado'
export type GoalType = 'mrr' | 'clientes' | 'custom'
export type InfluencerStatus = 'a_contatar' | 'em_contato' | 'negociando' | 'fechado' | 'recusado'

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: ClientStatus
  started_at: string
  notes: string | null
  billing_day: number | null
  created_at: string
}

export interface ClientStatusHistory {
  id: string
  client_id: string
  old_status: ClientStatus | null
  new_status: ClientStatus
  note: string | null
  changed_at: string
}

export interface Service {
  id: string
  client_id: string
  name: string
  type: ServiceType
  amount: number
  recurrence: ServiceRecurrence | null
  started_at: string
  ended_at: string | null
  contract_end: string | null
  first_charge_date: string | null
  active: boolean
  created_at: string
}

export interface Charge {
  id: string
  client_id: string
  service_id: string | null
  description: string
  amount: number
  due_date: string
  paid_at: string | null
  status: ChargeStatus
  created_at: string
  clients?: { name: string }
}

export interface Influencer {
  id: string
  name: string
  niche: string | null
  instagram: string | null
  phone: string | null
  email: string | null
  client_id: string | null
  status: InfluencerStatus
  value: number | null
  responsible: string | null
  notes: string | null
  created_at: string
  updated_at: string
  clients?: { id: string; name: string } | null
}

export interface Goal {
  id: string
  period: string
  type: GoalType
  target_value: number
  created_at: string
  title: string | null
  client_id: string | null
  deadline: string | null
  current_value: number
  unit: string | null
  clients?: { id: string; name: string } | null
}

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluido'
export type TaskPriority = 'baixa' | 'media' | 'alta'

export interface Member {
  id: string
  name: string
  initials: string
  color: string
  created_at: string
}

export interface TaskItem {
  id: string
  task_id: string
  title: string
  completed: boolean
  position: number
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  client_id: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  is_global: boolean
  created_at: string
  clients?: { id: string; name: string } | null
  assignees?: Array<{ id: string; name: string; initials: string; color: string }>
}

export type MeetingStatus = 'agendada' | 'realizada' | 'cancelada'

export interface Meeting {
  id: string
  title: string
  client_id: string | null
  meeting_date: string
  start_time: string | null
  location: string | null
  notes: string | null
  status: MeetingStatus
  created_at: string
  clients?: { id: string; name: string } | null
  attendees?: Array<{ id: string; name: string; initials: string; color: string }>
}

export type OmarRole = 'user' | 'assistant'

export interface OmarConversation {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface OmarMessage {
  id: string
  conversation_id: string
  role: OmarRole
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls: any[] | null
  created_at: string
}
