#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "postgres" -U "eterna" -d "order_db" -c '\q'; do
  sleep 1
done

echo "PostgreSQL is ready. Creating schema..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h "postgres" -U "eterna" -d "order_db" <<-EOSQL
  CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL,
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    tx_hash TEXT,
    execution_price NUMERIC,
    logs JSONB[],
    created_at TIMESTAMP NOT NULL
  );
EOSQL

echo "Schema created successfully!"
exec "$@"
