-- ZKSurvey Phase 7.1 — Migration 002 (PostgreSQL)
-- Adds pending_verification status to orders, 2FA fields to accounts, and updates plans pricing

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in ('created','pending_verification','paid','failed'));

alter table email_tokens drop constraint if exists email_tokens_purpose_check;
alter table email_tokens add constraint email_tokens_purpose_check check (purpose in ('verify','reset','2fa'));

alter table accounts add column if not exists totp_secret text;
alter table accounts add column if not exists totp_enabled boolean not null default false;

update plans set price=799, limits='{"surveys":5,"responses":2500,"formats":5,"watermark":false,"ads":false,"clients":false,"seats":1}' where id='starter';
update plans set price=2499, limits='{"surveys":25,"responses":15000,"formats":5,"watermark":false,"ads":true,"clients":false,"seats":3}' where id='growth';
update plans set price=6999, limits='{"surveys":100,"responses":60000,"formats":5,"watermark":false,"ads":true,"clients":true,"seats":10}' where id='agency';
