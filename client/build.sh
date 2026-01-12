#!/bin/bash
set -e

# Clean install to fix Rollup optional dependencies bug
rm -rf node_modules package-lock.json
npm install
npm run build