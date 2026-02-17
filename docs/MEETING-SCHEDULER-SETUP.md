# Automatic Meeting Scheduler (Gmail + Google Meet)

The meeting scheduler detects **positive replies** in Gmail (e.g. to your follow-up emails), classifies them with **Gemma3**, and automatically creates a **Google Calendar** event with a **Google Meet** link at the next convenient time.

## Flow

1. **Gmail**: Read inbox (unread threads). For each thread with at least 2 messages, the latest message is treated as the "reply".
2. **LLM (Gemma3)**: Classify whether the reply indicates the person wants to schedule a meeting (`/api/classify-meeting-reply` on the Python backend).
3. **Calendar**: Find the next free slot (business hours, next 7 days) using the Calendar API freebusy.
4. **Meet**: Create a calendar event with `conferenceData.createRequest` (type `hangoutsMeet`) so Google generates a Meet link. Optionally add the replier as an attendee.

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable **Gmail API** and **Google Calendar API**: APIs & Services → Library → enable both.
3. Create **OAuth 2.0 credentials** (APIs & Services → Credentials → Create Credentials → OAuth client ID).
   - Application type: **Desktop** (or Web if you have a redirect URL).
   - Note the **Client ID** and **Client Secret**.

### 2. Get a refresh token

Use the OAuth 2.0 Playground or a small script to authenticate once and get a **refresh token**:

- Scopes needed (all of them): `gmail.readonly`, `gmail.modify`, `gmail.send`, `calendar`, `calendar.events`
- Full scope URLs are in `lib/google/client.ts`. **Request every scope** when authorizing.

You can use [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) (set your client ID/secret in the gear, then authorize and exchange for tokens). Copy the **Refresh token** into `.env`.

**If you see "Request had insufficient authentication scopes"**: your current refresh token was created with fewer scopes. You must **re-authorize** and get a **new refresh token** with all of the scopes above (add `gmail.send` and any missing ones in the Playground, then authorize again and copy the new refresh token into `.env`).

### 3. Environment variables

Add to `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_CALENDAR_ID=primary
```

- `GOOGLE_CALENDAR_ID`: Calendar where events are created. Use `primary` for the main calendar, or an email like `user@company.com` for a shared calendar.
- Optional: `GOOGLE_MEETING_SCHEDULER_OUR_EMAIL` (or `SMTP_USER`): Your sending email. Used to skip messages sent by you when treating the last message in a thread as the "reply".

### 4. Python backend (Ollama + Gemma3)

The classifier runs on the existing Python backend. Ensure Ollama is running with `gemma3:4b` and the Python backend is reachable (`TRANSCRIBE_API_URL` / `NEXT_PUBLIC_TRANSCRIBE_API_URL`).

## Running the scheduler

- **Manual / UI**: Call `POST /api/integrations/meeting-schedule/run` with moderator/admin auth. Body (optional): `{ "maxThreads": 10, "inboxQuery": "in:inbox is:unread" }`.
- **Cron**: Call `GET /api/integrations/meeting-schedule/run` with the same auth (e.g. cron job with a bearer token or cookie) on a schedule (e.g. every 15 minutes).

Response shape:

```json
{
  "success": true,
  "data": {
    "processed": 5,
    "scheduled": [
      {
        "threadId": "...",
        "subject": "Re: FinIdeas – Follow-up",
        "attendeeEmail": "contact@example.com",
        "eventId": "...",
        "meetLink": "https://meet.google.com/xxx-xxxx-xxx",
        "start": "2026-02-18T10:00:00.000Z",
        "end": "2026-02-18T11:00:00.000Z"
      }
    ],
    "errors": []
  }
}
```

## Files

- `lib/google/client.ts` – OAuth2 client (refresh token from env).
- `lib/google/gmail.ts` – List inbox threads, get thread messages, decode body.
- `lib/google/calendar.ts` – Freebusy query, create event with Meet link.
- `lib/google/meeting-scheduler.ts` – Orchestration: inbox → classify → slot → create event.
- `app/api/integrations/meeting-schedule/run/route.ts` – POST/GET endpoint (moderator/admin).
- Python: `utils/llm_utils.py` (`classify_meeting_reply`), `api/transcribe.py` (`/api/classify-meeting-reply`).
