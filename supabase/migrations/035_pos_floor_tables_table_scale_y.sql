-- Independent table height scale (width stays in table_scale).

alter table public.pos_floor_tables
  add column if not exists table_scale_y numeric(6,2);

comment on column public.pos_floor_tables.table_scale_y is
  'Height scale. NULL means follow table_scale (uniform).';
