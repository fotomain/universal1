-- pg_cron lives in ONE database of the cluster (cron.database_name, set in docker-compose.yml = sqlcron) and starts its scheduler there.
-- test_cron.sh installs the app into this database; every other test database (sqltest, sqlfactmon ...) cannot create the extension: the install prints its NOTICE and goes on, as before.
CREATE DATABASE sqlcron TEMPLATE supabase_stub;
