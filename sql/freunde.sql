-- MacFit — Freunde (ab v1.24.0)
--
-- Einmal im Supabase-Dashboard ausführen: Projekt macfit → SQL Editor →
-- einfügen → Run. Das Skript ist wiederholbar (alles "if not exists" bzw.
-- "drop policy if exists"), ein zweiter Lauf ändert also nichts.
--
-- Zwei Tabellen:
--
--   profiles      die öffentliche Visitenkarte eines Kontos. Steht nur dort,
--                 wenn der Spieler die Freunde-Funktion selbst freigeschaltet
--                 hat — wer sie nie anfasst, hat keine Zeile und ist für
--                 niemanden auffindbar.
--   friend_links  Einladung und Freundschaft in einer Zeile. status wandert
--                 von 'offen' nach 'angenommen'; Ablehnen und Entfernen
--                 löschen die Zeile.
--
-- Was in profiles steht, ist für JEDES angemeldete Konto lesbar — anders ist
-- eine Suche über den Freundescode nicht möglich (Row Level Security kann
-- "nur die eine Zeile, nach der du suchst" nicht ausdrücken). Deshalb steht
-- dort ausschließlich, was ohnehin im Spiel gezeigt wird: Anzeigename,
-- Freundescode, Masse, Index, Level und die Figur fürs Posenbild. Keine
-- E-Mail, keine Kontokennung außer der uuid, kein Foto, kein Spielstand.


-- === profiles ==============================================================

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  code       text        not null unique,   -- Freundescode, z. B. 'K7P2QX'
  name       text        not null default '',
  level      integer     not null default 1,
  mass       real        not null default 0,   -- Muskelmasse in kg
  fit        integer     not null default 0,   -- Fitness-Index
  sets       integer     not null default 0,   -- Sätze am letzten Trainingstag
  day        integer     not null default 1,
  outfit     text        not null default 'blau',
  def        real        not null default 0.5, -- Definition 0..1 (game/fat.js)
  health     integer     not null default 80,
  -- Verhältnis der acht Partien zueinander, damit der Freund im Posenbild
  -- seine eigene Figur hat und nicht die Standardverteilung.
  shape      jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profile lesen" on public.profiles;
create policy "profile lesen" on public.profiles
  for select to authenticated using (true);

drop policy if exists "eigenes profil anlegen" on public.profiles;
create policy "eigenes profil anlegen" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigenes profil aendern" on public.profiles;
create policy "eigenes profil aendern" on public.profiles
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigenes profil loeschen" on public.profiles;
create policy "eigenes profil loeschen" on public.profiles
  for delete to authenticated using (auth.uid() = user_id);


-- === friend_links ==========================================================

create table if not exists public.friend_links (
  id          bigint generated always as identity primary key,
  from_user   uuid        not null references auth.users on delete cascade,
  to_user     uuid        not null references auth.users on delete cascade,
  status      text        not null default 'offen',
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  constraint friend_links_status check (status in ('offen', 'angenommen')),
  constraint friend_links_nicht_selbst check (from_user <> to_user),
  constraint friend_links_paar unique (from_user, to_user)
);

create index if not exists friend_links_to_idx on public.friend_links (to_user);

alter table public.friend_links enable row level security;

-- Gelesen wird nur, woran man selbst beteiligt ist.
drop policy if exists "eigene verbindungen lesen" on public.friend_links;
create policy "eigene verbindungen lesen" on public.friend_links
  for select to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Einladen darf man nur in eigenem Namen, und nur als offene Einladung:
-- ohne die zweite Bedingung könnte man sich selbst zum Freund eines
-- Fremden erklären.
drop policy if exists "einladung senden" on public.friend_links;
create policy "einladung senden" on public.friend_links
  for insert to authenticated
  with check (auth.uid() = from_user and status = 'offen');

-- Annehmen darf nur der Eingeladene, und nur in Richtung 'angenommen'.
drop policy if exists "einladung annehmen" on public.friend_links;
create policy "einladung annehmen" on public.friend_links
  for update to authenticated
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user and status = 'angenommen');

-- Löschen deckt drei Fälle ab: Einladung zurückziehen (Absender),
-- Einladung ablehnen (Empfänger), Freundschaft beenden (beide).
drop policy if exists "verbindung loesen" on public.friend_links;
create policy "verbindung loesen" on public.friend_links
  for delete to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);


-- === updated_at nachziehen =================================================
-- Eigene Funktion statt einer geteilten: eine "create or replace function
-- set_updated_at()" würde eine gleichnamige Funktion überschreiben, an der
-- womöglich schon die Tabelle saves hängt.

create or replace function public.freunde_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.freunde_touch_updated_at();
