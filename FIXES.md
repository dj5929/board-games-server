# 🛠️ Codebase Fixes & Improvements

This document tracks identified bugs, type safety issues, and planned improvements across the Board Game Server project.

## 🟢 Completed Fixes

### 1. `PlayerId` Type Import Error
- **Location:** `packages/web-client/src/components/CatanDevCardManager.tsx`
- **Issue:** The `PlayerId` type was incorrectly imported from `@packages/catan-engine`, which does not re-export it.
- **Fix:** Updated the import statement to pull `PlayerId` directly from `@packages/engine-core`.
- **Status:** 🟢 Fixed

## 🔴 Planned Improvements & Known Issues

*(No active known issues currently logged)*
