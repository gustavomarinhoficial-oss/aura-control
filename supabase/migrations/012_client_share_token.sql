-- Token único por cliente pra gerar um link público (sem login) do calendário
-- editorial dele — usado na página /publico/[token].

alter table clients add column if not exists share_token uuid unique default gen_random_uuid();

-- Preenche o token pros clientes já existentes
update clients set share_token = gen_random_uuid() where share_token is null;
