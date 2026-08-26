-- Mês manualmente liberado pro cliente ver no link público (além do que já
-- libera sozinho perto do fim do mês). Formato 'YYYY-MM'.
alter table clients add column if not exists content_unlocked_month text;

-- Prints que o cliente anexa ao reprovar um post, mostrando o que precisa mudar
alter table content_posts add column if not exists rejection_images text[];
