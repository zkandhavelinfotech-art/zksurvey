-- ZKSurvey v13 · Phase 7.1 — MySQL schema (migration 001)
-- Matches PostgreSQL schema exactly with MySQL 8.0+ syntax and types

create table if not exists plans (
  id varchar(60) primary key,
  name varchar(100) not null,
  price int not null default 0,
  limits json not null,
  blurb varchar(255) not null default '',
  sort int not null default 0,
  active tinyint(1) not null default 1
) engine=InnoDB default charset=utf8mb4;

create table if not exists accounts (
  id varchar(60) primary key,
  email varchar(254) not null,
  name varchar(120) not null,
  company varchar(160) not null default '',
  focus varchar(60) not null default '',
  password_hash varchar(255) not null,
  role varchar(30) not null default 'owner',
  plan_id varchar(60) not null default 'free',
  wanted_plan varchar(60),
  plan_period_end datetime(3),
  status varchar(30) not null default 'active',
  email_verified_at datetime(3),
  onboarded tinyint(1) not null default 0,
  billing json,
  cancel_at_period_end tinyint(1) not null default 0,
  failed_logins int not null default 0,
  locked_until datetime(3),
  created_at datetime(3) not null default current_timestamp(3),
  last_login_at datetime(3),
  unique key accounts_email_uq (email),
  index accounts_plan_idx (plan_id)
) engine=InnoDB default charset=utf8mb4;

create table if not exists sessions (
  id varchar(64) primary key,
  account_id varchar(60) not null,
  created_at datetime(3) not null default current_timestamp(3),
  expires_at datetime(3) not null,
  ip varchar(60),
  ua varchar(255),
  index sessions_account_idx (account_id),
  foreign key (account_id) references accounts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists email_tokens (
  token_hash varchar(64) primary key,
  account_id varchar(60) not null,
  purpose varchar(30) not null,
  expires_at datetime(3) not null,
  used_at datetime(3),
  index email_tokens_account_idx (account_id),
  foreign key (account_id) references accounts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists surveys (
  id varchar(60) primary key,
  account_id varchar(60) not null,
  name varchar(255) not null,
  status varchar(30) not null default 'Draft',
  slug varchar(100),
  meta json,
  def json not null,
  poster_png longblob,
  poster_alt varchar(255),
  published_at datetime(3),
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  unique key surveys_slug_uq (slug),
  index surveys_account_idx (account_id),
  foreign key (account_id) references accounts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists responses (
  id varchar(60) primary key,
  survey_id varchar(60) not null,
  account_id varchar(60) not null,
  at datetime(3) not null default current_timestamp(3),
  answers json not null,
  utm json,
  meta json,
  consent json,
  demo tinyint(1) not null default 0,
  ip_hash varchar(64),
  index responses_survey_at_idx (survey_id, at),
  index responses_account_idx (account_id, demo),
  foreign key (survey_id) references surveys(id) on delete cascade,
  foreign key (account_id) references accounts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists survey_starts (
  survey_id varchar(60) primary key,
  count int not null default 0,
  foreign key (survey_id) references surveys(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists workspace_kv (
  account_id varchar(60) not null,
  `key` varchar(100) not null,
  value json not null,
  updated_at datetime(3) not null default current_timestamp(3),
  primary key (account_id, `key`),
  foreign key (account_id) references accounts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists orders (
  id varchar(60) primary key,
  account_id varchar(60),
  plan_id varchar(60) not null,
  months int not null default 1,
  amount_paise int not null,
  gst_paise int not null,
  total_paise int not null,
  status varchar(30) not null default 'created',
  gateway varchar(30) not null,
  gateway_order_id varchar(100),
  gateway_payment_id varchar(100),
  created_at datetime(3) not null default current_timestamp(3),
  paid_at datetime(3),
  index orders_account_idx (account_id),
  index orders_gw_idx (gateway, gateway_order_id),
  foreign key (account_id) references accounts(id) on delete set null
) engine=InnoDB default charset=utf8mb4;

create table if not exists invoices (
  id varchar(60) primary key,
  number varchar(60) not null unique,
  account_id varchar(60),
  order_id varchar(60) not null unique,
  issued_at datetime(3) not null default current_timestamp(3),
  buyer json not null,
  seller json not null,
  lines json not null,
  subtotal_paise int not null,
  cgst_paise int not null default 0,
  sgst_paise int not null default 0,
  igst_paise int not null default 0,
  total_paise int not null,
  foreign key (account_id) references accounts(id) on delete set null,
  foreign key (order_id) references orders(id)
) engine=InnoDB default charset=utf8mb4;

create table if not exists events (
  id bigint auto_increment primary key,
  at datetime(3) not null default current_timestamp(3),
  account_id varchar(60),
  type varchar(60) not null,
  text varchar(300) not null,
  index events_at_idx (at desc)
) engine=InnoDB default charset=utf8mb4;

create table if not exists audit_log (
  id bigint auto_increment primary key,
  at datetime(3) not null default current_timestamp(3),
  actor_id varchar(60),
  action varchar(100) not null,
  target varchar(100),
  ip varchar(60),
  meta json
) engine=InnoDB default charset=utf8mb4;

create table if not exists support_tickets (
  id varchar(60) primary key,
  account_id varchar(60),
  name varchar(120) not null,
  email varchar(254) not null,
  subject varchar(160) not null,
  message text not null,
  status varchar(30) not null default 'open',
  created_at datetime(3) not null default current_timestamp(3),
  foreign key (account_id) references accounts(id) on delete set null
) engine=InnoDB default charset=utf8mb4;

create table if not exists short_links (
  code varchar(60) primary key,
  account_id varchar(60) not null,
  survey_id varchar(60) not null,
  channel varchar(60) not null,
  utm json,
  clicks int not null default 0,
  last_click datetime(3),
  created_at datetime(3) not null default current_timestamp(3),
  index short_links_survey_idx (survey_id),
  foreign key (account_id) references accounts(id) on delete cascade,
  foreign key (survey_id) references surveys(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;

create table if not exists mail_outbox (
  id bigint auto_increment primary key,
  at datetime(3) not null default current_timestamp(3),
  to_email varchar(254) not null,
  subject varchar(255) not null,
  body text not null,
  sent_at datetime(3),
  error text
) engine=InnoDB default charset=utf8mb4;

insert into plans (id,name,price,limits,blurb,sort) values
 ('free','Free',0,'{"surveys":1,"responses":200,"formats":1,"watermark":true,"ads":false,"clients":false,"seats":1}','Try ZKSurvey for one live project with core analytics.',1),
 ('starter','Starter',799,'{"surveys":5,"responses":2500,"formats":5,"watermark":false,"ads":false,"clients":false,"seats":1}','For product launches, validation and research surveys.',2),
 ('growth','Growth',2499,'{"surveys":25,"responses":15000,"formats":5,"watermark":false,"ads":true,"clients":false,"seats":3}','For fast-growing brands across social, ads, and offline QR.',3),
 ('agency','Agency',6999,'{"surveys":100,"responses":60000,"formats":5,"watermark":false,"ads":true,"clients":true,"seats":10}','Manage multi-client campaigns with high response volumes.',4)
 on duplicate key update name=values(name), price=values(price), limits=values(limits), blurb=values(blurb), sort=values(sort);
