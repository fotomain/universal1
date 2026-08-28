DO $$
DECLARE
table_name TEXT;
    tables TEXT[] := ARRAY[
          'raciMemberTable'
--          ,'userAuthTable'
--          ,'aiSessionTable'
--          ,'raciMemberTable'
--          ,'userTable'
--          ,'userAuthTable'
--          ,'dtcTaskFinishedTable'
--          ,'catalogOrganizationTable'
--          ,'dtcCatalogExecutiveTable'
--          ,'mediaPostTable'
--          ,'mediaPostTableArchive'
--          ,'dtcTaskRegisteredTable'
--          ,'dtcTaskWaitingTable'
--          ,'dtcTaskProgressTable'
--          ,'dtcFreeExecutiveTable'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP

        -- 1️⃣ Drop table if exists
        EXECUTE format(
            'DROP TABLE IF EXISTS public.%I',
            table_name
        );

        -- 2️⃣ Create table
EXECUTE format(
        'CREATE TABLE public.%I (
            "rowGUID" TEXT NOT NULL,
            "rowOwnerGUID" TEXT NOT NULL,
            "rowParentGUID" TEXT NOT NULL,
            "rowJSON" JSONB NOT NULL DEFAULT ''{}''::jsonb,
            "orderInList" NUMERIC NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY ("rowGUID")
        )',
        table_name,
        'pk_' || table_name
        );

-- 3️⃣ Create GIN index for jsonb
EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I
         ON public.%I
         USING GIN ("rowJSON" jsonb_path_ops)',
        'idx_' || table_name || '_rowJSON',
        table_name
        );

-- 4️⃣ Create index on orderInList
EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I
         ON public.%I ("orderInList")',
        'idx_' || table_name || '_order',
        table_name
        );

-- 5️⃣ Enable Row Level Security
EXECUTE format(
        'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
        table_name
        );

-- 6️⃣ Grant basic permissions to anon role
EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon',
        table_name
        );

-- 7️⃣ Create default policies for all CRUD operations
EXECUTE format(
        'CREATE POLICY "Allow anon select" ON public.%I FOR SELECT USING (true)',
        table_name
        );
EXECUTE format(
        'CREATE POLICY "Allow anon insert" ON public.%I FOR INSERT WITH CHECK (true)',
        table_name
        );
EXECUTE format(
        'CREATE POLICY "Allow anon update" ON public.%I FOR UPDATE USING (true) WITH CHECK (true)',
        table_name
        );
EXECUTE format(
        'CREATE POLICY "Allow anon delete" ON public.%I FOR DELETE USING (true)',
        table_name
        );

-- 8️⃣ Add table to the supabase realtime publication
EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        table_name
        );

END LOOP;

    -- ██ 9 Check tables in the publication
    RAISE NOTICE 'Tables in supabase_realtime:';
    PERFORM * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

    -- ██ 10 create additional indexes
    -- █████████ dtcTaskProgressTable
    CREATE UNIQUE INDEX IF NOT EXISTS  idx_dtcTaskProgressTable_rowOwnerGUID
    ON public."dtcTaskProgressTable" ("rowOwnerGUID");


    -- █████████ userTable
    CREATE UNIQUE INDEX IF NOT EXISTS  idx_userTable_rowOwnerGUID
    ON public."userTable" ("rowOwnerGUID");

--    CREATE UNIQUE INDEX IF NOT EXISTS  idx_dtcTaskFinishedTable_mediaPostOwnerGUID
--    ON public."dtcTaskFinishedTable" ("mediaPostOwnerGUID");

END $$;


