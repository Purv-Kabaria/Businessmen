# Contacts Queue Contract

Queue implementation lives in `modules/capture/db.ts`. Consumer (POST to API when online) is out of scope for the queue layer.

| Operation | API | Notes |
|-----------|-----|--------|
| **Enqueue** | `addContact(contact)` | Contact must have `pending_sync: true`. Stall/Field submit flow calls this. |
| **Get pending** | `getUnsyncedContacts()` | Returns contacts with `pending_sync === true`, ordered by `updated_at` ascending (FIFO). |
| **Update after sync** | `updateContact(local_id, patch)` | Use after successful POST to API. Typical patch: `{ server_id, pending_sync: false, version? }`. Optional: `last_sync_error` to store failure reason while keeping `pending_sync: true`. Patch type: `UpdateContactPatch` (partial of `ContactRecord` minus `local_id`). |

**No partial state:** Client must only call `updateContact` to clear sync state (e.g. set `pending_sync: false`, `server_id`) after the API returns **2xx**. Do not update on network error or non-2xx. On failure, client may optionally call `updateContact(local_id, { last_sync_error: message })` and leave `pending_sync: true` so the contact stays in the queue for retry.
