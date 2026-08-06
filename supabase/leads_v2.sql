-- Adiciona novos campos na tabela leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS responsavel text;

-- Migra stages antigos para os novos nomes
UPDATE leads SET stage = 'novo_lead' WHERE stage = 'prospecto';
