#!/bin/sh
set -e

echo "Pushing DB schema..."
cd /app/server
npx prisma db push --skip-generate

echo "Seeding database (if empty)..."
node dist/seed.js

echo "Starting server..."
cd /app
exec node server/dist/server/src/index.js
