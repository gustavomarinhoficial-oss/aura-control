import type { Metadata } from 'next'
import { PublicBooking } from '@/components/domain/booking/PublicBooking'

export const metadata: Metadata = {
  title: 'Agende sua captação · OWL Creative Club',
  description: 'Escolha o melhor dia e horário para a captação com a equipe OWL.',
  robots: { index: false, follow: false },
}

export default async function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PublicBooking slug={slug} />
}
