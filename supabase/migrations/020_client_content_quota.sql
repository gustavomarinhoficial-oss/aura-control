-- Meta mensal de conteúdo por cliente (quantos posts a agência precisa
-- entregar por mês para aquele cliente) — usado na Central de Conteúdo
-- pra mostrar "criados X/meta" e "aprovados X/meta".

alter table clients add column if not exists monthly_content_quota integer;

update clients set monthly_content_quota = 12 where name = 'Magalhaes e Silva Advogados';
update clients set monthly_content_quota = 25 where name = 'iMoowe';
update clients set monthly_content_quota = 20 where name = 'Brasa Alta';
update clients set monthly_content_quota = 20 where name = 'Stadium Steakhouse';
update clients set monthly_content_quota = 8  where name = 'Valure Contabilidade';
update clients set monthly_content_quota = 4  where name = 'Limpa Legal';
update clients set monthly_content_quota = 12 where name = 'Smile Pet';
update clients set monthly_content_quota = 15 where name = 'BMF';
