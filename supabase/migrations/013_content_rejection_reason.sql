-- Motivo da reprovação de um post pelo cliente (informado no link público),
-- pra equipe saber o que precisa mudar sem depender de mensagem separada.

alter table content_posts add column if not exists rejection_reason text;
