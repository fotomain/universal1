# postgres:15 (the version of Supabase) + the pg_cron extension, so the Monitor01 worker schedule can be tested for real.
# Built by docker-compose.yml (docker compose build). The base image is the local postgres:15; only the apt package comes from the network.
FROM postgres:15
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-15-cron \
 && rm -rf /var/lib/apt/lists/*
