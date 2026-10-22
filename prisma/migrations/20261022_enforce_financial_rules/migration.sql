-- старые даты лимитов -> первое число месяцев

UPDATE "limit"
SET "data" = date_trunc('month', "data")
WHERE "data" <> date_trunc('month', "data");

-- сумма операции должна быть больше нуля

ALTER TABLE "operation"
ADD CONSTRAINT "operation_summ_positive"
CHECK("summ">0);

-- сумма лимита должна быть больше нуля

ALTER TABLE "limit"
ADD CONSTRAINT "limit_summ_positive"
CHECK("limit_summ">0);

-- дата лимита должна быть первым числом месяца

ALTER TABLE "limit"
ADD CONSTRAINT "limit_data_month_start"
CHECK("data" = date_trunc('month', "data"));