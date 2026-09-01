-- Controla, por cliente, se o link público de conteúdo permite aprovar/
-- reprovar posts (com motivo). Desligado por padrão — só os clientes
-- explicitamente liberados abaixo têm essa função; os demais só visualizam
-- o calendário (podem ser liberados depois, é só marcar true).

alter table clients add column if not exists content_approval_enabled boolean not null default false;

update clients set content_approval_enabled = true
  where name in ('Stadium Steakhouse', 'Brasa Alta', 'Valure Contabilidade');
