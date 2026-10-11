#!/usr/bin/env bash
set -euo pipefail
rm -rf packages/core-dist
mkdir -p packages/core-dist
tsc -p packages/core/tsconfig.json --outDir packages/core-dist --declaration false --module commonjs --moduleResolution node
