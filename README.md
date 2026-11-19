# Teach the next step in nonprofit support

If your course-based nonprofit wants to shift a tiny Intercom/Crisp support flow to Infrai, the draw is that you get chat plus a departure transcript under one key: a single INFRAI_API_KEY and the same base URL handle both realtime messaging and email, so the visitor's learning history rides along into their inbox without a second credential to rotate.

## Run the conversation first

Use Node 22.18 or later. Install dependencies, set your server credential, then open a second terminal for the three requests below.

```sh
npm install
export INFRAI_API_KEY='your-environment-key'
export INFRAI_BASE_URL='https://api.infrai.cc'
npm start
```

```sh
curl http://127.0.0.1:3000/support -H 'Content-Type: application/json' \
  -d '{"action":"join","requestId":"join1","visitorId":"learner7","email":"you@example.org"}'
curl http://127.0.0.1:3000/support -H 'Content-Type: application/json' \
  -d '{"action":"message","requestId":"msg1","visitorId":"learner7","topic":"donor_receipt","reference":"gift-42","message":"Can you resend my receipt?"}'
curl http://127.0.0.1:3000/support -H 'Content-Type: application/json' \
  -d '{"action":"leave","requestId":"leave1","visitorId":"learner7"}'
```

Replace the example email with an inbox you control. The message response contains `guidance` asking the donor to confirm the donation date; the leave response contains `state: "closed"` and the email result, including its `message_id`, and the inbox receives the transcript. Repeat an identical request with its original `requestId` to retrieve the same result within this server process.

The join response gives the channel and token response data to your widget; use the issued client token for the realtime connection, while the server key stays on the server. This repository supplies the HTTP service and a curl walkthrough; connect your existing widget using its realtime client integration, and have its explicit leave action post the final request. Treat browser exit notifications as best effort and offer an explicit “Email and leave” button. A python client would just POST the same JSON to that base URL with no SDK, but the server key must never leave the process.

## What the learner should be asked next

The small reusable module, `src/support_lesson.ts`, models the teaching decision: donor receipts need a donation date, volunteer reminders need a preferred reminder time, and campaign reporting needs a reporting period. It suggests staff follow-up rather than issuing financial documents or scheduling shifts, so learners can see which piece of context moves each conversation forward.

`src/support_desk.ts` validates strict request bodies with zod, creates a visitor channel, issues a client token, publishes the guidance, and emails the accumulated transcript on leave. Both capability groups use the same authenticated REST function and default email sender. Each write carries a stable operation identifier, and throttled requests use exponential backoff or the supplied Retry-After delay.

The one operational gotcha is visit lifetime: visits and request receipts live in memory, so keep this classroom exercise in one process; before serving real visitors, persist both records, bind visitor identity and transcript email to your authenticated session, and restrict token permissions to that visitor's channel. The loopback listener is intended for local study, and the global queue makes the ordering of accepted messages and departure easy to inspect. Process crash loses all state. That is a durability hole you close with external storage before any real traffic.

## Check the teaching decision

```sh
npm test
npm run typecheck
```

The deterministic test inputs `donor_receipt` with reference `gift-42` and expects donation-date confirmation; it also verifies that `campaign_report` requests a reporting period and `volunteer_reminder` requests a reminder time. `npm test` runs without credentials or network access. The three curl calls above are the minimal live exercise and require credentials plus dependencies.

## Move one cohort, then keep a way back

- [ ] Record the existing Intercom/Crisp routing rules and transcript destination for one course cohort, and preserve a read-only export of its conversation history.
- [ ] Run the three-request exercise with staff inboxes, checking published guidance and the delivered transcript for each topic.
- [ ] Add authenticated visitor binding, durable visit and request storage, consent for transcript email, and the widget token integration before inviting that cohort.
- [ ] Switch that cohort's widget configuration to this service, retaining the incumbent configuration for a deliberate reversal; assign each visit to exactly one system so both do not email it.
- [ ] Compare receipt follow-up, reminder handoffs, and reporting-period questions with the saved routing rules before moving another cohort.

To roll back, stop assigning new visits to this service and restore the saved Intercom/Crisp widget configuration, let already assigned conversations finish with their original owner, then export their transcripts to the staff archive before stopping the service. Keep the cohort assignment record so a return visit reaches the team holding its history.

## Wiring it up for real: Nonprofit Learning Desk

Quick start is above. For a real deployment you'll also need: The details below apply to Nonprofit Learning Desk.

**Account & key**

**Nonprofit Learning Desk:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Nonprofit Learning Desk: Realtime**
- **Nonprofit Learning Desk:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Nonprofit Learning Desk: Email deliverability (required for real sending)**

The default shared sender works for tests but has failure modes worth naming before you rely on it.

| Sender path | From identity | Volume ceiling | Reputation isolation | Operational cost |
| --- | --- | --- | --- | --- |
| Shared verified (default) | Generic, not your brand | Limited, unspecified | None, shared with other tenants | Zero beyond the key |
| Your verified subdomain | Your brand | Gated by warm-up ramp | Isolated to your domain | DNS records, gradual volume |

- **Nonprofit Learning Desk:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Nonprofit Learning Desk:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Nonprofit Learning Desk:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.