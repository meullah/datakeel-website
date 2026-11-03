---
headline: "Suspicious claims caught before payout."
subtitle: "A proof of concept for a health insurance claims company that checks every claim against the patient's own medical record."
industry: insurance
service: data-integration
serviceLabel: "Data integration + AI scoring"
framingLabel: "Proof of concept"
client: "A company that processes health insurance claims on behalf of patients."
seoTitle: "Suspicious health claims caught before payout | DataKeel AI"
cardLine: "Every claim checked by hand → the riskiest claims flagged before payout · health insurance claims company"
cardSummary: "Claims linked to medical records, prescriptions and history, so reviewers see which claims don't add up, before money goes out."
metaDescription: "A DataKeel AI proof of concept that links health insurance claims to patient records and flags unsupported claims before payout."
before: "Every claim was checked by hand, one at a time. Reviewers had no quick way to see whether an expensive test or procedure matched the doctor's prescription or the patient's history. Claims that didn't add up were often paid anyway."
built: "A proof of concept that links each claim to the patient's medical records, history and prescriptions. Business rules and a scoring model compare what was claimed with what the record supports, and flag any claim where the test or procedure doesn't fit the diagnosis, the prescription or the patient's history."
found: "Most unsupported claims weren't hidden. They were simply never compared with the patient's record. Joining the data was what made them visible."
after:
  # Removed until the founder confirms what it measured (deferred-work.md): the "around 30%" line.
  - "Reviewers spend their time on the riskiest claims instead of checking every one."
  - "Each flag shows *why*: the claimed test next to the prescription and history it doesn't match."
# Founder-supplied tools; the exact-tools marker is removed until confirmed (deferred-work.md).
stack: ["Python", "SQL", "rules engine and scoring model"]
visual: { kind: dashboard, id: claim-record-check }
published: 2026-11-03
updated: 2026-11-03
draft: false
---
