# Troubleshooting

## Prisma EPERM (rename) on Windows

If you see:

```
EPERM: operation not permitted, rename '...query_engine-windows.dll.tmp...' -> '...query_engine-windows.dll.node'
```

the Prisma query engine is **locked by another process**.

## Fix

1. **Stop all Node/Prisma usage in this project**
   - Stop the dev server (`Ctrl+C` in the terminal running `pnpm dev` or `next dev`).
   - Stop any workers (`pnpm worker:transcribe`, etc.).
   - Close Prisma Studio.
   - Close other terminals that run `node`/`tsx`/`next` in this repo.

2. **Optional: kill Node processes** (PowerShell)
   ```powershell
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

3. **Run generate again**
   ```bash
   pnpm prisma generate
   ```

4. **If it still fails**
   - Close Cursor/VS Code (they can hold the DLL via the TS server or extensions).
   - Run step 2, then step 3 in a **new** terminal (e.g. Windows Terminal or cmd outside the IDE).
   - If you use antivirus, temporarily exclude the project folder or add an exclusion for `query_engine-windows.dll.node`.

---

## Worker: ENOTFOUND Upstash (Redis)

If the transcribe (or other) worker logs:

```
Error: getaddrinfo ENOTFOUND active-mayfly-56813.upstash.io
```

BullMQ is trying to use Redis at the URL in `REDIS_URL` (e.g. Upstash) and that host is unreachable (no internet, wrong URL, or instance deleted).

**Fix:** Use local Redis instead.

1. **Install and start Redis** (e.g. [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL/Docker: `redis-server`).

2. **In `.env`** either:
   - Set `REDIS_URL=redis://127.0.0.1:6379` and remove or comment out the Upstash URL, or  
   - Set `USE_LOCAL_REDIS=true` so the app uses `redis://127.0.0.1:6379` and ignores `REDIS_URL`.

3. Restart the worker: `pnpm worker:transcribe`.

**“Interaction not found”** in the transcribe worker means a job was queued for an interaction that no longer exists (e.g. DB reset). The job now completes without retry so it won’t spam the logs.
