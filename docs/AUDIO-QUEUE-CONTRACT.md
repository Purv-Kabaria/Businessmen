# Audio Transcript Queue Contract

Queue implementation lives in `modules/capture/db.ts`. Consumer (call LLM when online, then update status) is out of scope for the queue layer.

| Operation | API | Notes |
|-----------|-----|--------|
| **Enqueue** | `enqueueAudioTranscriptItem(item)` | Adds item with `status: "pending"`, `retry_count: 0`. Returns `id`. |
| **Get pending** | `getPendingAudioTranscriptItems(limit)` | Returns items with `status === "pending"`, ordered by `created_at` ascending. Runs stale reset first (items in `"processing"` older than 5 min are reset to `"pending"`). |
| **Update status** | `updateAudioTranscriptItemStatus(id, status, options?)` | Options: `last_error`, `processed_at`, `retry_count_increment`. When `status === "failed"`, `processed_at` defaults to now. When `status === "pending"`, `processed_at` defaults to `null`. |
| **Record failure** | `recordAudioTranscriptItemFailure(id, last_error)` | Use when the job failed (e.g. LLM threw). Increments `retry_count`, sets `last_error`. If `retry_count < MAX_AUDIO_TRANSCRIPT_RETRIES` (3), sets status to `"pending"` (will retry); else sets `"failed"` and `processed_at`. Returns `{ will_retry }`. Rejects if item is `"done"` or already `"failed"`. |
| **Set contact server id** | `setContactServerId(id, server_id)` | Links item to synced contact for worker. |
| **Cleanup** | `cleanupAudioTranscriptQueue(options?)` | Deletes items with `status === "done"` or `"failed"` and `processed_at` older than `olderThanMs` (default 7 days). Returns `{ deleted }`. Optional `olderThanMs`; negative is clamped to 0 (no deletion). |

**Edge cases**

- **Item not found:** `updateAudioTranscriptItemStatus`, `recordAudioTranscriptItemFailure`, `setContactServerId` reject with a clear error.
- **Already done:** `recordAudioTranscriptItemFailure` rejects (cannot record failure for completed item).
- **Already failed:** `recordAudioTranscriptItemFailure` rejects (no double-fail).
- **Max retries:** After 3 failures, item is set to `"failed"` and `processed_at`; it no longer appears in `getPendingAudioTranscriptItems`. Consumer can rely on `recordAudioTranscriptItemFailure` to enforce this.
- **Stale processing:** Items stuck in `"processing"` (e.g. consumer crashed) are reset to `"pending"` by `getPendingAudioTranscriptItems` after 5 min; `retry_count` is not incremented by stale reset.
- **Retry count cap:** `retry_count` is capped at `MAX_AUDIO_TRANSCRIPT_RETRIES` when using `retry_count_increment` in `updateAudioTranscriptItemStatus`.
- **Cleanup — only done/failed with timestamp:** Items with `status === "pending"` or `"processing"` are never deleted. Items with `status === "done"` or `"failed"` but `processed_at === null` are not deleted (age unknown). Only items with `processed_at` set and `processed_at < (now - olderThanMs)` are removed.
- **Cleanup — empty or no match:** Returns `{ deleted: 0 }`; no error.
- **Cleanup — negative/zero age:** `olderThanMs <= 0` is clamped to 0, so cutoff = now and no items have `processed_at < now`; returns `{ deleted: 0 }`.
- **Cleanup — transaction:** All deletes run in one transaction; if any delete fails, the transaction aborts and the promise rejects.

Consumer responsibility: set status to `"processing"` before calling LLM; on success call `updateAudioTranscriptItemStatus(id, "done", { processed_at })`; on failure call `recordAudioTranscriptItemFailure(id, errorMessage)`.
