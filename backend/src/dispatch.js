// MOCK routing only. Nothing here sends email/SMS or contacts any server - it prints to the terminal.
const DEPARTMENTS = {
  Water: 'Water Works Department',
  Roads: 'Roads & Public Works Department',
  Electricity: 'Electricity Distribution Department',
  Sanitation: 'Sanitation Department',
  Uncategorised: 'Triage Desk',
};

export function buildDispatchPayload(report) {
  return {
    mock: true,
    department: DEPARTMENTS[report.category] ?? DEPARTMENTS.Uncategorised,
    priority: report.severity >= 9 ? 'immediate' : 'urgent',
    note: 'MOCK DISPATCH - nothing was sent to any external system.',
    report,
  };
}

export function mockDispatch(report, log = console.log) {
  const payload = buildDispatchPayload(report);
  log(`[MOCK DISPATCH] ${JSON.stringify(payload, null, 2)}`);
  return payload;
}
