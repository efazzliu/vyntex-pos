-- Default POS language/currency for new licenses: English + Euro.
-- Safe to re-run. Does not overwrite venues that already chose a language or symbol.

alter table public.restaurants
  alter column currency set default 'EUR';

alter table public.restaurants
  alter column language set default 'en';

alter table public.restaurants
  alter column currency_symbol set default '€';

alter table public.restaurants
  alter column currency_position set default 'prefix';

alter table public.restaurants
  alter column currency_decimals set default 2;

update public.restaurants
set language = 'en'
where language is null;

update public.restaurants
set currency = 'EUR'
where currency is null or btrim(currency) = '';

update public.restaurants
set currency_symbol = '€'
where currency_symbol is null or btrim(currency_symbol) = '';

update public.restaurants
set currency_position = 'prefix'
where currency_position is null;

update public.restaurants
set currency_decimals = 2
where currency_decimals is null;
