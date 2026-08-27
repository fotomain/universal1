CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at = NOW();
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

   --===================
   
   
DO $$
DECLARE
tables TEXT[] := ARRAY[
        'userAuthTable'
        ,'userTable'
        ,'dtcTaskFinishedTable'
        ,'catalogOrganizationTable'
        ,'dtcCatalogExecutiveTable'
        ,'mediaPostTable'
        ,'dtcTaskRegisteredTable'
        ,'dtcTaskWaitingTable'
        ,'dtcTaskProgressTable'
        ,'dtcFreeExecutiveTable'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- Add columns
        EXECUTE format(
            'ALTER TABLE %I
             ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();',
            t
        );

        -- Correct index creation
EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (created_at);',
        t || '_created_at_idx', t
        );

EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (updated_at);',
        t || '_updated_at_idx', t
        );

-- Recreate trigger
EXECUTE format(
        'DROP TRIGGER IF EXISTS set_updated_at_trigger ON %I;',
        t
        );

EXECUTE format(
        'CREATE TRIGGER set_updated_at_trigger
         BEFORE UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION set_updated_at();',
        t
        );
END LOOP;
END $$;