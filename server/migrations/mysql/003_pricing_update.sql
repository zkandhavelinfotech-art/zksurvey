-- ZKSurvey Phase 7.1 — Migration 003 (MySQL)
-- Finalized Indian SaaS market pricing update

update plans set price=799, blurb='For product launches, validation and research surveys.', limits='{"surveys":5,"responses":2500,"formats":5,"watermark":false,"ads":false,"clients":false,"seats":1}' where id='starter';
update plans set price=2499, blurb='For fast-growing brands across social, ads, and offline QR.', limits='{"surveys":25,"responses":15000,"formats":5,"watermark":false,"ads":true,"clients":false,"seats":3}' where id='growth';
update plans set price=6999, blurb='Manage multi-client campaigns with high response volumes.', limits='{"surveys":100,"responses":60000,"formats":5,"watermark":false,"ads":true,"clients":true,"seats":10}' where id='agency';
