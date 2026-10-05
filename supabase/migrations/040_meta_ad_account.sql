-- ID da conta de anuncios da Meta de cada cliente (so o numero, sem "act_"),
-- usado pra puxar os numeros de trafego automaticamente da Marketing API.
alter table clients add column if not exists meta_ad_account_id text;
