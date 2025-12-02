#!/bin/bash
# Script to prepare a customer-ready release without test files

set -e

RELEASE_DIR="amplify-genai-release"

echo "🚀 Preparing customer release..."

# Remove old release directory if it exists
rm -rf "$RELEASE_DIR"

# Create release directory
mkdir -p "$RELEASE_DIR"

# Copy all files except tests and dev files
rsync -av \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__tests__' \
  --exclude='tests' \
  --exclude='*.test.ts' \
  --exclude='*.test.tsx' \
  --exclude='*.test.js' \
  --exclude='*.test.jsx' \
  --exclude='*.spec.ts' \
  --exclude='*.spec.tsx' \
  --exclude='vitest.config.ts' \
  --exclude='.kiro' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='*.log' \
  --exclude='test-results' \
  --exclude='coverage' \
  --exclude='.vitest' \
  ./ "$RELEASE_DIR/"

# Remove test dependencies from package.json
cd "$RELEASE_DIR"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Remove test-related dev dependencies
const testDeps = [
  'vitest',
  '@fast-check/vitest',
  'fast-check',
  '@types/jsdom',
  '@vitest/mocker'
];

testDeps.forEach(dep => {
  delete pkg.devDependencies[dep];
});

// Remove test scripts
delete pkg.scripts.test;
delete pkg.scripts.coverage;

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ Customer release prepared in: $RELEASE_DIR"
echo ""
echo "Next steps:"
echo "  cd $RELEASE_DIR"
echo "  npm install"
echo "  npm run build"
