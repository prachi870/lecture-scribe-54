/**
 * Postinstall patch for use-sync-external-store compatibility with React 19.
 *
 * Issue: @tanstack/react-store imports useSyncExternalStoreWithSelector from
 * 'use-sync-external-store/shim/with-selector', but the installed version
 * (1.6.0) ships CommonJS files that Vite cannot resolve as ESM.
 *
 * Fix: In React 19, useSyncExternalStoreWithSelector is available from 'react'
 * directly. We patch the shim files to re-export from react.
 */
const fs = require("fs");
const path = require("path");

const files = [
  "node_modules/use-sync-external-store/shim/with-selector.js",
  "node_modules/use-sync-external-store/with-selector.js",
];

const content = "export { useSyncExternalStoreWithSelector } from 'react';\n";

for (const file of files) {
  const fullPath = path.resolve(file);
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content);
    console.log(`[patch] Fixed ${file}`);
  }
}
