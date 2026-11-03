import assert from "node:assert/strict";
import test from "node:test";
import { nextStep, transcript } from "../src/support_lesson.ts";

test("donor questions require date confirmation; reports require a period", () => {
  const receipt = nextStep({ topic: "donor_receipt", reference: "gift-42", message: "Please resend" });
  assert.match(receipt, /confirm the donation date/);
  assert.match(receipt, /gift-42/);
  const report = nextStep({ topic: "campaign_report", reference: "literacy", message: "Totals?" });
  assert.match(report, /reporting period/);
  const reminder = nextStep({ topic: "volunteer_reminder", reference: "reading", message: "Remind me" });
  assert.match(reminder, /preferred reminder time/);
  assert.ok(transcript([receipt, report, reminder]).includes(report));
});
