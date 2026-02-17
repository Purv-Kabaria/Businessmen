# Contacts Queue Contract

Queue implementation lives in `modules/capture/db.ts`. Consumer (POST to API when online) is out of scope for the queue layer.

| Operation | API | Notes |
|-----------|-----|--------|
| **Enqueue** | `addContact(contact)` | Contact must have `pending_sync: true`. Stall/Field submit flow calls this. |
| **Get pending** | `getUnsyncedContacts()` | Returns contacts with `pending_sync === true`, ordered by `updated_at` ascending (FIFO). |
| **Update after sync** | `updateContact(local_id, patch)` | Use after successful POST to API. Typical patch: `{ server_id, pending_sync: false, version? }`. Patch type: `UpdateContactPatch` (partial of `ContactRecord` minus `local_id`). |

Consumer responsibility: when online, call `getUnsyncedContacts()`, POST each to `/api/contacts`, on 2xx call `updateContact(local_id, { server_id, pending_sync: false })`. Do not update on network error or non-2xx.
