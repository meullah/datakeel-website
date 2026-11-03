// ponytail: local list until Story 3.5 swaps it for the `industries` collection.
export const industries = [
  {
    id: 'healthcare',
    name: 'Healthcare',
    h1: 'Data and AI for healthcare',
    title: 'Data and AI for Healthcare',
    description: 'Data platforms and forecasting for hospitals and healthcare providers: patient, clinical and operational data in one trusted model.',
    summary: 'Hospitals often run on data spread across departments and systems, so every team keeps its own numbers. We bring that data into one trusted model, then use it to plan ahead, such as forecasting the beds and staff each unit will need.',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    h1: 'Data and AI for insurance',
    title: 'Data and AI for Insurance',
    description: 'Data integration and AI for insurers: claims linked to the records behind them, so reviewers see what doesn’t add up before payout.',
    summary: 'When claims are checked by hand, it’s hard to see which ones don’t add up before money goes out. We link claims to the records behind them, so reviewers can spot the ones that need a closer look.',
  },
  {
    id: 'automotive',
    name: 'Automotive',
    h1: 'Data and AI for automotive',
    title: 'Data and AI for Automotive',
    description: 'Data integration for automotive businesses: dealer and inventory feeds in different formats, cleaned into one model and kept up to date.',
    summary: 'Dealer and inventory data often arrives in many different formats, which makes it hard to keep listings accurate. We clean those feeds into one model, so your listings stay accurate without manual fixes.',
  },
  {
    id: 'finance',
    name: 'Finance',
    h1: 'Data and AI for finance',
    title: 'Data and AI for Finance',
    description: 'Data platforms for finance teams on Microsoft Fabric: payroll, timecards and finance data in one model, without spreadsheet matching.',
    summary: 'Finance teams often spend hours matching spreadsheets from different systems before they can answer a simple question. We bring that data into one model, so the numbers line up without spreadsheet work.',
  },
] as const;

export type Industry = (typeof industries)[number];
