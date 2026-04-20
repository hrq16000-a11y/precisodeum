

## Diagnosis

The fatal error `Cannot read properties of undefined (reading 'unstable_scheduleCallback')` occurs because `react-dom` internally imports the `scheduler` package, but `scheduler` is not present in `node_modules/`. The Vite deduplication added previously cannot help if the package does not exist on disk. The recovery buttons in the HTML shell do not fix this because the problem is a missing dependency, not a cache issue.

## Plan (4 rules of fault tolerance)

### 1. Fix the fatal dependency error

- Add `scheduler` as an explicit dependency in `package.json` (version `^0.23.2`, matching what `react-dom@18.3.1` requires).
- Keep the existing Vite config (`optimizeDeps.include`, `resolve.dedupe`, `manualChunks`) which correctly groups `scheduler` with React.

### 2. Global Error Boundary shield (App.tsx)

- Wrap the entire rendered tree inside `App.tsx` (everything inside `QueryClientProvider`) with `ErrorGuard` using `componentName="App"`.
- This ensures that if any component crashes at any level, the app shows a clean fallback UI instead of a white screen or infinite splash. Navigation remains accessible via the fallback's "Go Home" and "Go Back" buttons.

### 3. Optimistic loading -- no full-screen block

- In `useAuth.tsx`, change `loading` initial state from `true` to `false`. The AuthProvider will render children immediately. Components that need auth data already check `loading` individually.
- Remove the `setLoading(true)` call inside `onAuthStateChange` for the `SIGNED_IN` path -- profile fetching happens in the background while the UI is already interactive. Keep `setLoading(true)` only in the initial `getSession` path, with a 3-second safety timeout.

### 4. Network/session resilience (3-second timeout)

- Add a `setTimeout(3000)` safety net in the `useEffect` of `AuthProvider`: if `getSession()` plus `fetchProfile()` haven't resolved in 3 seconds, force `setLoading(false)` so the app renders in "logged out" state with empty structure.
- Wrap `fetchProfile` calls in try/catch to prevent unhandled rejections from blocking state updates.

### Files changed

| File | Change |
|------|--------|
| `package.json` | Add `"scheduler": "^0.23.2"` to dependencies |
| `src/App.tsx` | Wrap root tree with `ErrorGuard componentName="App"` |
| `src/hooks/useAuth.tsx` | Set `loading` default to `false`, add 3s safety timeout, try/catch on fetchProfile |

