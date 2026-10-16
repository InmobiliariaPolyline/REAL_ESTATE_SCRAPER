-- =============================================================================
-- Historial de precios y filtros completos en búsquedas guardadas
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
--   propiedades_precios   cada cambio de precio de un aviso (lo registra un TRIGGER, así que
--                         funciona con cualquier scraper sin tocar su código)
--   busquedas_guardadas.filtros   filtros completos del portal (jsonb) para las búsquedas de
--                         los clientes; las del admin siguen usando las columnas clásicas
-- =============================================================================

begin;

create table if not exists public.propiedades_precios (
  id            bigint generated always as identity primary key,
  propiedad_id  text not null references public.propiedades (id) on delete cascade,
  precio        numeric not null default 0,
  precio_usd    numeric not null default 0,
  moneda        text not null default 'PEN',
  registrado_en timestamptz not null default now()
);
create index if not exists propiedades_precios_prop_idx
  on public.propiedades_precios (propiedad_id, registrado_en);

-- Registra el precio inicial al insertar y cada vez que cambia el precio.
create or replace function public.registrar_precio()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
     or new.precio is distinct from old.precio
     or new.precio_usd is distinct from old.precio_usd then
    -- Sin precio en ninguna moneda no hay nada que historiar.
    if coalesce(new.precio, 0) > 0 or coalesce(new.precio_usd, 0) > 0 then
      insert into public.propiedades_precios (propiedad_id, precio, precio_usd, moneda)
      values (new.id, coalesce(new.precio, 0), coalesce(new.precio_usd, 0), new.moneda);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists propiedades_registrar_precio on public.propiedades;
create trigger propiedades_registrar_precio
  after insert or update of precio, precio_usd on public.propiedades
  for each row execute function public.registrar_precio();

-- Punto de partida para los avisos que ya existían antes del trigger.
insert into public.propiedades_precios (propiedad_id, precio, precio_usd, moneda, registrado_en)
select p.id, coalesce(p.precio, 0), coalesce(p.precio_usd, 0), p.moneda, p.creado_en
  from public.propiedades p
 where (coalesce(p.precio, 0) > 0 or coalesce(p.precio_usd, 0) > 0)
   and not exists (select 1 from public.propiedades_precios h where h.propiedad_id = p.id);

alter table public.busquedas_guardadas add column if not exists filtros jsonb;

commit;
