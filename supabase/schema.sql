create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date not null,
  birth_time text,
  birth_place text,
  zodiac_sign text not null,
  interests text[] not null default '{}',
  guidance_tone text not null default 'protectora',
  relationship_target jsonb,
  notification_time text not null default '09:00',
  created_at timestamptz not null default now()
);

create table if not exists public.content_templates (
  id text primary key,
  kind text not null check (kind in ('daily-message', 'recommendation', 'micro-feed', 'weekly', 'transit', 'relationship')),
  zodiac_sign text,
  topic text,
  tone text not null check (tone in ('suave', 'directo', 'protector', 'expansivo')),
  title text not null,
  body text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_energy_days (
  id text primary key,
  week_start date not null,
  day_index integer not null,
  day_name text not null,
  color text not null,
  symbol text not null,
  focus text not null,
  meaning text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transit_events (
  id text primary key,
  title text not null,
  event_type text not null check (event_type in ('luna', 'mercurio', 'venus', 'temporada', 'cultura')),
  event_date date not null,
  affected_signs text[] not null default '{}',
  summary text not null,
  do_this text not null,
  avoid text not null,
  intensity integer not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.share_card_templates (
  id text primary key,
  type text not null check (type in ('daily', 'weekly-color', 'relationship', 'transit', 'tarot')),
  title text not null,
  subtitle_template text not null,
  body_template text not null,
  accent text not null,
  meta_template text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tarot_cards (
  id text primary key,
  name text not null,
  arcana text not null check (arcana in ('mayor', 'menor')),
  keywords text[] not null default '{}',
  meaning text not null,
  ritual text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  reading_date date not null,
  reading_payload jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.saved_readings enable row level security;

create policy "Users can read their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their saved readings"
  on public.saved_readings for select
  using (auth.uid() = user_id);

create policy "Users can write their saved readings"
  on public.saved_readings for insert
  with check (auth.uid() = user_id);
