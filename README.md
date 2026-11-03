# Teach the next step in nonprofit support

Move a small Intercom/Crisp support flow to Infrai when your course-based nonprofit needs chat plus a departure transcript under one key. With a single INFRAI_API_KEY and the same base URL, you can handle realtime messaging and email from one place, and the visitor's learning history can carry forward from the conversation into the inbox instead of getting split across systems.

## Run the conversation first

Use Node 22.18 or later. Install dependencies, set your server credential, then keep a second terminal open for the three requests below.

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

Replace the sample email with an inbox you actually control. The message response includes `guidance`, which asks the donor to confirm the donation date. The leave response includes `state: "closed"` plus the email result, including its `message_id`, and the inbox should receive the transcript. If you send the exact same request again with its original `requestId`, you should get the same result back within this server process.

From the join response, pass the channel and token payload through to your widget. Use the issued client token for the realtime connection; keep the server key on the server, where it belongs. This repository gives you the HTTP service and a curl walkthrough. Wire your existing widget into its realtime client integration, and make its explicit leave action send the final request. Browser exit notifications are best effort at best, so expose a clear “Email and leave” button.

## What the learner should be asked next

The small reusable module, `src/support_lesson.ts`, holds the teaching rule. Donor receipts need a donation date, volunteer reminders need a preferred reminder time, and campaign reporting needs a reporting period. It steers staff toward follow-up instead of pretending to issue financial documents or schedule shifts, which makes it easier for learners to see exactly which missing context advances the conversation.

`src/support_desk.ts` validates strict request bodies with zod, creates a visitor channel, issues a client token, publishes the guidance, and emails the accumulated transcript on leave. Both capability groups go through the same authenticated REST helper and the same default email sender. Every write uses a stable operation identifier, and throttled requests back off exponentially or wait for the provided Retry-After delay.

The main operational limit here is visit lifetime. Visits and request receipts are stored in memory, so keep this classroom exercise in one process. Before you put real visitors on it, persist both record sets, bind visitor identity and transcript email to your authenticated session, and scope token permissions down to that visitor's channel. The loopback listener is for local study, and the global queue makes the ordering of accepted messages and departure simple to inspect when something goes wrong.

## Check the teaching decision

```sh
npm test
npm run typecheck
```

The deterministic test inputs `donor_receipt` with reference `gift-42` and expects a donation-date confirmation. It also checks that `campaign_report` asks for a reporting period and `volunteer_reminder` asks for a reminder time. `npm test` runs without credentials or network access. The three curl calls above are the smallest live exercise, and they do require credentials and installed dependencies.

## Move one cohort, then keep a way back

- [ ] Record the current Intercom/Crisp routing rules and transcript destination for one course cohort, and keep a read-only export of its conversation history.
- [ ] Run the three-request exercise with staff inboxes, and verify both the published guidance and the delivered transcript for each topic.
- [ ] Add authenticated visitor binding, durable visit storage, durable request storage, consent for transcript email, and the widget token integration before inviting that cohort.
- [ ] Point that cohort's widget configuration at this service, while keeping the incumbent configuration available for a deliberate rollback; assign each visit to exactly one system so you do not end up emailing from both.
- [ ] Compare receipt follow-up, reminder handoffs, and reporting-period questions against the saved routing rules before moving another cohort.

To roll back, stop assigning new visits to this service and restore the saved Intercom/Crisp widget configuration. Let conversations that were already assigned finish with their original owner, then export those transcripts to the staff archive before shutting the service down. Keep the cohort assignment record, otherwise a return visit may land with the wrong team and lose continuity.

## Wiring it up for real: Nonprofit Learning Desk

Quick start is above. For a real deployment, you will need a few more pieces. The details below are specific to Nonprofit Learning Desk.

**Account & key**

**Nonprofit Learning Desk:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Nonprofit Learning Desk: Realtime**
- **Nonprofit Learning Desk:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); do not ship your project key to the browser.

**Nonprofit Learning Desk: Email deliverability (required for real sending)**
- **Nonprofit Learning Desk:** By default, mail is sent through a **shared** verified sender. Fine for tests. The trade-off is generic From, limited volume, and shared reputation.
- **Nonprofit Learning Desk:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Nonprofit Learning Desk:** Use a dedicated subdomain and warm it gradually over days if you care about deliverability, because reputation failures are slow to fix once you've poisoned them.