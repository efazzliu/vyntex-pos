-- If older rows only had table_id populated, copy UUID to table_ref so POS (which reads table_ref via API) finds them.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'table_id'
  ) then
    update public.sales
    set table_ref = table_id::text
    where table_id is not null
      and (table_ref is null or btrim(table_ref) = '');
  end if;
end $$;

notify pgrst, 'reload schema';
