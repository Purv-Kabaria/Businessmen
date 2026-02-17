# AI Interaction Ingestion & Job Scheduling – System Design Document

---

# 🎯 Objective

Build the complete Interaction → Audio Upload → AI Job Scheduling pipeline.

This layer must:

- Work independently of frontend completion.
- Automatically create AI jobs.
- Store audio safely.
- Prepare system for GPU worker.
- Never block CRM usage.
- Be production-safe and scalable.

This document defines the **exact architecture, flow, and implementation steps**.

---

# 1️⃣ High-Level Architecture

User (Stall/Field Capture)
        |
        |  (POST interaction)
        ↓
Next.js API Layer
        |
        |-- Upload Audio → MinIO
        |
        |-- Insert Interaction → PostgreSQL
        |
        |-- Insert AI Job → PostgreSQL
        ↓
ai_jobs (status = pending)

AI Worker (Future)
        |
        |-- Poll ai_jobs
        |-- Process interaction
        |-- Update transcript + snapshot
        |-- Mark job complete

---

# 2️⃣ Core Design Principles

- Deterministic identity (phone UNIQUE constraint)
- Interactions are append-only
- Audio stored in object storage (MinIO)
- AI jobs are asynchronous
- API never waits for AI completion
- Job processing must be idempotent
- Failures must not corrupt CRM state

---

# 3️⃣ Database Design (Required Tables)

## Contacts

CREATE TABLE contacts (
    id UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT UNIQUE NOT NULL,
    current_stage TEXT DEFAULT 'Met',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

## Interactions (Append-Only)

CREATE TABLE interactions (
    id UUID PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    audio_object_key TEXT,
    transcript TEXT,
    structured_snapshot JSONB,
    tags JSONB,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

## AI Jobs

CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY,
    interaction_id UUID REFERENCES interactions(id),
    status TEXT DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

---

# 4️⃣ End-to-End Flow

## Step 1: User Creates Interaction

Frontend sends:

POST /api/interactions

Payload (multipart/form-data):

{
  contact_id: UUID,
  audio_file: file (optional),
  tags: JSON,
  created_by: string
}

---

## Step 2: Backend Interaction API Logic

### Pseudocode

1. Validate contact exists.
2. Generate interaction_id (UUID).
3. If audio exists:
     - Generate object key:
         interactions/{interaction_id}.wav
     - Upload to MinIO bucket.
4. Insert interaction row into DB.
5. Insert AI job row (status = pending).
6. Return success.

---

## 5️⃣ Exact API Flow

### POST /api/interactions

Request:
- contact_id (required)
- audio_file (optional)
- tags (optional)

Server Logic:

if (!contact_exists(contact_id)) {
    throw Error("Invalid contact");
}

interaction_id = uuid();

if (audio_file) {
    object_key = `interactions/${interaction_id}.wav`;
    upload_to_minio(object_key, audio_file);
}

INSERT INTO interactions (
    id,
    contact_id,
    audio_object_key,
    tags,
    created_by
);

INSERT INTO ai_jobs (
    id,
    interaction_id,
    status
) VALUES (
    uuid(),
    interaction_id,
    'pending'
);

return { success: true };

---

# 6️⃣ MinIO Integration

## Bucket Structure

Bucket Name:
- interactions-audio

Object Key Pattern:
- interactions/{interaction_id}.wav

## Security

- Private bucket
- No public access
- Signed URL when needed

---

# 7️⃣ AI Job Scheduling Model

AI jobs are created immediately after interaction insertion.

### Job Lifecycle States

- pending
- processing
- completed
- failed

### Important

The API must NEVER:
- Wait for transcription
- Wait for LLM
- Block response

Job creation is fire-and-forget.

---

# 8️⃣ Idempotency Rules

If API retries:

- Do not create duplicate interactions.
- Use unique interaction_id generation before insert.
- Ensure AI job linked only once.

Future AI worker must:

- Check job status before processing.
- Avoid double-processing.

---

# 9️⃣ Error Handling

If MinIO upload fails:
- Do NOT insert interaction.
- Return error.

If interaction insert fails:
- Do NOT create AI job.

If AI job insert fails:
- Log error.
- Return success but mark AI disabled.

CRM must remain usable.

---

# 🔟 Logging Strategy

Log:

- Interaction creation time
- Audio upload duration
- Job creation success
- Error details

Log format:

{
  event: "interaction_created",
  interaction_id: UUID,
  contact_id: UUID,
  has_audio: true/false,
  timestamp: ISO8601
}

---

# 1️⃣1️⃣ Manual Testing Strategy

Before AI worker exists:

1. Create contact manually.
2. Use Postman to POST interaction.
3. Verify:
   - Audio uploaded in MinIO.
   - Interaction row created.
   - ai_job row created.
4. Insert dummy transcript manually.
5. Confirm system integrity.

---

# 1️⃣2️⃣ Future AI Worker Compatibility

AI worker will:

1. Poll ai_jobs:
   SELECT * FROM ai_jobs
   WHERE status = 'pending'
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

2. Fetch interaction.
3. Fetch audio from MinIO.
4. Process.
5. Update interaction:
   - transcript
   - structured_snapshot
6. Mark job complete.

No API changes required later.

---

# 1️⃣3️⃣ Sequence Diagram

User → API → MinIO → Postgres (interaction) → Postgres (ai_job)

Later:

AI Worker → Postgres (fetch job)
AI Worker → MinIO (get audio)
AI Worker → Postgres (update interaction)
AI Worker → Postgres (mark job complete)

---

# 1️⃣4️⃣ Development Order

Phase 1:
- DB tables
- MinIO setup

Phase 2:
- Interaction API
- Audio upload logic

Phase 3:
- AI job insertion

Phase 4:
- Manual job simulation

AI worker built later.

---

# 1️⃣5️⃣ Core Guarantee

After this feature is complete:

- Every audio interaction automatically creates an AI job.
- AI worker can start immediately when implemented.
- CRM is fully operational without AI.
- System is scalable and safe.

---

# ✅ Definition of Done

✔ Interaction API works  
✔ Audio uploads to MinIO  
✔ Interaction row created  
✔ AI job row created  
✔ No blocking operations  
✔ Fully testable without frontend  

---

This document defines the exact system design and flow for the AI interaction ingestion and job scheduling feature.
