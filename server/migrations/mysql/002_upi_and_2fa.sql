-- ZKSurvey Phase 7.1 — Migration 002 (MySQL)
-- Adds 2FA fields to accounts and updates plans pricing

alter table accounts add column if not exists totp_secret varchar(100);
alter table accounts add column if not exists totp_enabled tinyint(1) not null default 0;

update plans set price=799, limits='{"surveys":5,"responses":2500,"formats":5,"watermark":false,"ads":false,"clients":false,"seats":1}' where id='starter';
update plans set price=2499, limits='{"surveys":25,"responses":15000,"formats":5,"watermark":false,"ads":true,"clients":false,"seats":3}' where id='growth';
update plans set price=6999, limits='{"surveys":100,"responses":60000,"formats":5,"watermark":false,"ads":true,"clients":true,"seats":10}' where id='agency';
