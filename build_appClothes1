#!/usr/bin/env bash
set -e

APP="appClothes1"
OUTPUT_DIR="dist/appClothes1"

echo "========================================="
echo "Building Web for: $APP"
echo "Target directory: $OUTPUT_DIR"
echo "========================================="

export APP_NAME="$APP"
npx expo export -p web --output-dir "$OUTPUT_DIR"

echo "========================================="
echo "Successfully built $APP to $OUTPUT_DIR"
echo "To test locally run: npx serve $OUTPUT_DIR"
echo "========================================="
