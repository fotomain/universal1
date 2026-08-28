#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building all web app variants..."
"$DIR/build_appOnTrend.sh"
"$DIR/build_appPosts.sh"
"$DIR/build_appCC1.sh"
"$DIR/build_appClothes1.sh"

echo "All apps built successfully into dist/!"
