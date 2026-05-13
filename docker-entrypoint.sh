#!/bin/sh
set -e

echo "Pushing DB schema..."
cd /app/server
npx prisma db push --skip-generate

echo "Starting server..."
cd /app
exec node server/dist/src/index.js
