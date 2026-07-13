#!/usr/bin/env bash
# Wait for infrastructure services to be ready
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h localhost -p 5432 -U caselens 2>/dev/null; do
  sleep 1
done
echo "✓ PostgreSQL is ready"

echo "Waiting for Redis..."
until redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "✓ Redis is ready"

echo "Waiting for MinIO..."
until curl -s http://localhost:9000/minio/health/live 2>/dev/null; do
  sleep 1
done
echo "✓ MinIO is ready"

echo "All services are ready!"
