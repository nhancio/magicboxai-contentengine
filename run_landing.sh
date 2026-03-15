#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/apps/landing"
npm install
npm run dev
