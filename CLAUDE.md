# UNIVERSAL1 expo-app - instructions for Claude Code

The project knowledge (stack, folders, the SQL pipeline, feature index, tests, pitfalls, working agreement) is in one file, loaded here:

@KNOW_HOW.md

## Standing rules (short; the reasons are in KNOW_HOW.md section 8)

- END EVERY JOB REPORT with a last paragraph **UPDATE STEP-BY-STEP**: numbered steps in order (which SQL file to run in the Supabase SQL Editor - start1_sql_tables.sql, then start2_sql_code.sql, start3 only if seeds changed -, `.env` lines, the Expo restart command, what to click to verify, what is NOT needed). Nothing after it. When nothing has to be run or edited, write only `UPDATE STEP-BY-STEP: reload app`.
- SQL: tables -> `kit8/sql/start/start1_sql_tables.sql`, everything else -> `start2_sql_code.sql` (same PART number), seeds -> `start3_sql_insert_missing.sql` (+ `start5_sql_upsert_all.sql`), drops -> `delete_sql_structure.sql`. Test with `kit8/docker/test_sql.sh` and `test_fact_monitor01.sh` before handing it over. `start1_sql_structure.sql` no longer exists.
- Do not edit `.env` (give the lines to the user). Do not commit unless asked. No subagents unless asked.
- Keep the user informed in a few words during long runs. Be honest about what was tested and what could not be seen (the user's Supabase, browsers).
- Fact code: `kit8/pm/fact`; Monitor01: `kit8/pm/reports/monitor01`; vendor invoice: `kit8/pm/vendor_invoice`. Write the tests and the README of a feature in the same round.
- When a fact in KNOW_HOW.md turns out wrong or a new feature / rule is added, update KNOW_HOW.md (keep it a short map).
