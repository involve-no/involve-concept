#!/bin/bash
# deploy.sh — Run this on the server to pull latest code and restart the app
# Usage: ./deploy.sh

set -e

echo "🚀 VM-Mania 2026 — Deploying..."
echo ""

echo "📥 Pulling latest code from GitHub..."
git pull

echo "🔨 Rebuilding and restarting Docker container..."
docker compose up -d --build

echo ""
echo "✅ Deploy complete! Site is live."
