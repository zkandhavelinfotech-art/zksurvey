-- ZKSurvey v13 · Phase 7 — PostgreSQL schema (migration 001)
-- Every tenant-owned table carries account_id; every query in the API filters by it.

create table plans (
  id          text primary key,
  name        text not null,
  price       integer not null default 0,           -- INR per month, whole rupees, excl. GST
  limits      jsonb not null,                       -- {surveys,responses,formats,watermark,ads,clients,seats}
  blurb       text not null default '',
  sort        integer not null default 0,
  active      boolean not null default true
);

create table accounts (
  id                text primary key,
  email             text not null,
  name              text not null,
  company           text not null default '',
  focus             text not null default '',
  password_hash     text not null,
  role              text not null default 'owner' check (role in ('owner','agency','superadmin')),
  plan_id           text not null default 'free' references plans(id),
  wanted_plan       text,
  plan_period_end   timestamptz,
  status            text not null default 'active' check (status in ('active','suspended')),
  email_verified_at timestamptz,
  onboarded         boolean not null default false,
  billing           jsonb not null default '{}'::jsonb,   -- {legalName,gstin,state,address}
  cancel_at_period_end boolean not null default false,
  failed_logins     integer not null default 0,
  locked_until      timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);
create unique index accounts_email_uq on accounts (lower(email));

create table sessions (
  id          text primary key,                      -- sha256 of the cookie token
  account_id  text not null references accounts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ip          text,
  ua          text
);
create index sessions_account_idx on sessions (account_id);

create table email_tokens (
  token_hash  text primary key,
  account_id  text not null references accounts(id) on delete cascade,
  purpose     text not null check (purpose in ('verify','reset')),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table surveys (
  id           text primary key,
  account_id   text not null references accounts(id) on delete cascade,
  name         text not null,
  status       text not null default 'Draft',
  slug         text,
  meta         jsonb not null default '{}'::jsonb,   -- list entry as the UI keeps it
  def          jsonb not null,                       -- full survey definition
  poster_png   bytea,                                -- optional share image (Open Graph)
  poster_alt   text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index surveys_slug_uq on surveys (slug) where slug is not null and slug <> '';
create index surveys_account_idx on surveys (account_id);

create table responses (
  id          text primary key,
  survey_id   text not null references surveys(id) on delete cascade,
  account_id  text not null references accounts(id) on delete cascade,
  at          timestamptz not null default now(),
  answers     jsonb not null,
  utm         jsonb not null default '{}'::jsonb,
  meta        jsonb not null default '{}'::jsonb,
  consent     jsonb,                                  -- {given:true,at,version}
  demo        boolean not null default false,         -- sample data, not counted against plan
  ip_hash     text
);
create index responses_survey_idx on responses (survey_id, at desc);
create index responses_account_idx on responses (account_id) where demo = false;

create table survey_starts (
  survey_id  text primary key references surveys(id) on delete cascade,
  count      integer not null default 0
);

create table workspace_kv (
  account_id  text not null references accounts(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (account_id, key)
);

create table orders (
  id                  text primary key,
  account_id          text references accounts(id) on delete set null,   -- kept for tax records after account erasure
  plan_id             text not null references plans(id),
  months              integer not null default 1,
  amount_paise        integer not null,               -- excl. GST
  gst_paise           integer not null,
  total_paise         integer not null,
  status              text not null default 'created' check (status in ('created','paid','failed')),
  gateway             text not null,                  -- razorpay | mock
  gateway_order_id    text,
  gateway_payment_id  text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index orders_account_idx on orders (account_id);
create unique index orders_gateway_order_uq on orders (gateway, gateway_order_id);

create sequence invoice_seq;
create table invoices (
  id          text primary key,
  number      text not null unique,
  account_id  text references accounts(id) on delete set null,   -- invoices are retained (GST record keeping) with a buyer snapshot
  order_id    text not null unique references orders(id),
  issued_at   timestamptz not null default now(),
  buyer       jsonb not null,
  seller      jsonb not null,
  lines       jsonb not null,
  subtotal_paise integer not null,
  cgst_paise  integer not null default 0,
  sgst_paise  integer not null default 0,
  igst_paise  integer not null default 0,
  total_paise integer not null
);

create table events (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  account_id  text,
  type        text not null,
  text        text not null
);
create index events_at_idx on events (at desc);

create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_id    text,
  action      text not null,
  target      text,
  ip          text,
  meta        jsonb not null default '{}'::jsonb
);

create table support_tickets (
  id          text primary key,
  account_id  text references accounts(id) on delete set null,
  name        text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  status      text not null default 'open' check (status in ('open','closed')),
  created_at  timestamptz not null default now()
);

create table short_links (
  code        text primary key,
  account_id  text not null references accounts(id) on delete cascade,
  survey_id   text not null references surveys(id) on delete cascade,
  channel     text not null,
  utm         jsonb not null default '{}'::jsonb,
  clicks      integer not null default 0,
  last_click  timestamptz,
  created_at  timestamptz not null default now()
);
create index short_links_survey_idx on short_links (survey_id);

create table mail_outbox (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  to_email    text not null,
  subject     text not null,
  body        text not null,
  sent_at     timestamptz,
  error       text
);

insert into plans (id,name,price,limits,blurb,sort) values
 ('free','Free',0,'{"surveys":1,"responses":200,"formats":1,"watermark":true,"ads":false,"clients":false,"seats":1}','Try ZKSurvey for one live project with core analytics.',1),
 ('starter','Starter',799,'{"surveys":5,"responses":2500,"formats":5,"watermark":false,"ads":false,"clients":false,"seats":1}','For product launches, validation and research surveys.',2),
 ('growth','Growth',2499,'{"surveys":25,"responses":15000,"formats":5,"watermark":false,"ads":true,"clients":false,"seats":3}','For fast-growing brands across social, ads, and offline QR.',3),
 ('agency','Agency',6999,'{"surveys":100,"responses":60000,"formats":5,"watermark":false,"ads":true,"clients":true,"seats":10}','Manage multi-client campaigns with high response volumes.',4)
 on conflict (id) do update set name=excluded.name, price=excluded.price, limits=excluded.limits, blurb=excluded.blurb, sort=excluded.sort;
