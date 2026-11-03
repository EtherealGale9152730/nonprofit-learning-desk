export type SupportTopic = "donor_receipt" | "volunteer_reminder" | "campaign_report";

export type SupportMessage = {
  topic: SupportTopic;
  reference: string;
  message: string;
};

export function nextStep(input: SupportMessage): string {
  switch (input.topic) {
    case "donor_receipt":
      return `Receipt ${input.reference}: ask the donor to confirm the donation date before staff resend the receipt.`;
    case "volunteer_reminder":
      return `Volunteer shift ${input.reference}: ask for the volunteer's preferred reminder time before scheduling with staff.`;
    case "campaign_report":
      return `Campaign ${input.reference}: ask which reporting period the coordinator needs before sharing totals.`;
  }
}

export function transcript(lines: readonly string[]): string {
  return ["Your nonprofit learning desk conversation", "", ...lines, "", "Reply to your nonprofit support team for the next step."].join("\n");
}
