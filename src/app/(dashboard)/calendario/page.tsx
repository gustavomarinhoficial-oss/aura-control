import { redirect } from 'next/navigation'

// O calendário agora fica dentro de Reuniões e Captações.
export default function CalendarioPage() {
  redirect('/reunioes')
}
