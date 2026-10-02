#!/bin/sh
# Construit le banc de pose : tools/lab/dist/lab.js + index.html (servir ensuite le dossier racine du dépôt).
cd "$(dirname "$0")/../.." && npx esbuild tools/lab/lab.ts --bundle --format=iife --outfile=tools/lab/dist/lab.js --log-level=warning
printf '<!doctype html><meta charset=utf-8><body style="margin:0"><script src="lab.js"></script>' > tools/lab/dist/index.html
