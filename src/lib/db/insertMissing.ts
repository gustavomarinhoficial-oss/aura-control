import type { SupabaseClient } from '@supabase/supabase-js'

// Insere linhas que podem já existir (geradores de cobranças/despesas recorrentes).
// Não usa upsert/onConflict: os índices únicos dessas tabelas são PARCIAIS (where ... is not null)
// e o upsert do PostgREST não consegue usá-los (erro 42P10), o que fazia o gerador falhar em silêncio.
// O índice único continua protegendo contra duplicata (duas abas abertas): se der conflito (23505),
// insere linha por linha e ignora só as que já existem.
export async function insertIgnoringDuplicates(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0
  const first = await supabase.from(table).insert(rows)
  if (!first.error) return rows.length
  if (first.error.code !== '23505') {
    console.error(`[${table}] geração falhou:`, first.error.message)
    return 0
  }
  let inserted = 0
  for (const row of rows) {
    const { error } = await supabase.from(table).insert(row)
    if (!error) inserted++
    else if (error.code !== '23505') console.error(`[${table}] geração falhou:`, error.message)
  }
  return inserted
}
