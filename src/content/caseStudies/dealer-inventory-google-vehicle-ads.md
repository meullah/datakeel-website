---
headline: "220+ dealers. 10,500+ vehicles. Live on Google every day."
subtitle: "One ingestion platform turned every dealer's stock feed, whatever its format, into accurate Google Vehicle Ads, refreshed twice a day."
industry: automotive
service: data-integration
serviceLabel: "Data integration"
seoTitle: "220+ dealers live on Google every day | DataKeel AI"
cardLine: "Hundreds of differently shaped dealer feeds → one inventory model, live on Google · 220+ dealers, 10,500+ vehicles"
cardSummary: "Hundreds of dealer feeds in different formats, cleaned into one inventory model and published to Google automatically."
metaDescription: "How DataKeel AI built a multi-source ingestion platform that keeps 10,500+ vehicles from 220+ dealers live and accurate on Google Vehicle Ads."
before: "Every dealer sent stock differently: a web link, a file uploaded to our SFTP, or files we had to collect from theirs. Each used its own column names, and key details like registration dates were often missing. Onboarding a new dealer was slow and messy, and keeping Google Merchant Center accurate got harder as the dealer list grew."
built: "One ingestion platform that accepts every format (CSV, XML, JSON, APIs, webhooks, SFTP) and turns it into a single inventory model. It matches each dealer correctly, fills in missing details through an API, applies business rules automatically (minimum stock, custom labels, finance pricing) and publishes to Google Vehicle Ads through the Merchant API. Every dealer refreshes twice a day."
found: "The hard part wasn't volume. It was variety: the same field had many different names, and important details were often missing. Fixing that once, in one model, made every new dealer easier."
after:
  - "10,500+ vehicles from 220+ dealers live on Google every day."
  - "Dealers' ads match their real stock, refreshed automatically twice a day."
  - "New dealers plug into the same model instead of needing a custom build."
stack: ["Azure Data Factory", "Azure Functions", ".NET", "Google Merchant API", "Auto Trader API"]
visual: { kind: diagram, id: dealer-feeds-to-google }
stats:
  - { value: 220, suffix: "+", display: "220+", label: "dealers live on Google", homepage: true }
  - { value: 10500, suffix: "+", display: "10,500+", label: "vehicles refreshed daily", homepage: true }
  - { value: null, display: "2×", label: "daily automated refresh", homepage: true }
published: 2026-11-03
updated: 2026-11-03
draft: false
---
