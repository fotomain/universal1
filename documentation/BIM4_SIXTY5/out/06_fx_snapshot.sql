-- 06: the fx snapshot (fxSnapshotTaskLine) of every task line of the project, made the way the app does it (kit8/pm/view/task/finances/taskLineFx.ts).
-- Without it the task window gives the line a snapshot on opening and sets taskIsPosted = false ("Post needed"). Everything is EUR -> EUR, rate 1.
-- Day: the date of the contract of the line (signed, else start) when it has one, else the start of the task. Idempotent: only lines without a snapshot.
-- taskIsPosted is not touched.
WITH proj AS (
  SELECT coalesce(nullif(upper("rowJSON"->>'currencyForAccounting'),''),'EUR') acc, coalesce(nullif(upper("rowJSON"->>'currencyForBudget'),''),'EUR') bud,
         coalesce("rowJSON"->>'exchangeRateTypeForAccounting','Default') acct, coalesce("rowJSON"->>'exchangeRateTypeForBudget','Budget') budt
  FROM public.project_table WHERE "rowGUID" = '6c70450d-4e27-4a56-8e7f-4698e30e2ac4'
), src AS (
  SELECT l."rowGUID" lg,
         substr(t."rowJSON"->>'manualStartAt',1,10) tday,
         CASE WHEN l."rowJSON"->>'taskManagementGenusLine' = 'timeGenus' THEN NULL
              ELSE (SELECT CASE WHEN c."rowJSON"->>'contractSignedDate' ~ '^\d{4}-\d{2}-\d{2}$' THEN c."rowJSON"->>'contractSignedDate'
                                WHEN c."rowJSON"->>'contractStartDate' ~ '^\d{4}-\d{2}-\d{2}$' THEN c."rowJSON"->>'contractStartDate' END
                    FROM public."contractTable" c WHERE c."rowGUID" = l."rowJSON"->>'taskLinePartnerContract') END cday
  FROM public.task_line_table l JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID"
  WHERE l."rowProjectGUID" = '6c70450d-4e27-4a56-8e7f-4698e30e2ac4' AND NOT (l."rowJSON" ? 'fxSnapshotTaskLine') AND t."rowJSON"->>'manualStartAt' IS NOT NULL
)
UPDATE public.task_line_table l
SET "rowJSON" = l."rowJSON" || jsonb_build_object('fxSnapshotTaskLine', jsonb_build_object(
      'from', p.acc, 'day', coalesce(s.cday, s.tday), 'dayFrom', CASE WHEN s.cday IS NOT NULL THEN 'contract' ELSE 'task' END,
      'inputs', coalesce(s.cday,'') || '|' || s.tday,
      'accounting', jsonb_build_object('to', p.acc, 'rateType', p.acct, 'rate', 1),
      'budget', jsonb_build_object('to', p.bud, 'rateType', p.budt, 'rate', 1)))
FROM src s, proj p WHERE l."rowGUID" = s.lg;
SELECT count(*) AS lines_without_snapshot FROM public.task_line_table WHERE "rowProjectGUID" = '6c70450d-4e27-4a56-8e7f-4698e30e2ac4' AND NOT ("rowJSON" ? 'fxSnapshotTaskLine');
