select table_schema, table_name
from information_schema.tables
where table_name like 'project\_%'
  and table_type = 'BASE TABLE'
  and table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name;
