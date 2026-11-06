# DataKeel AI website: operations

How the site is published, how to launch it on datakeelai.com, and what to check every month.

## Email
- hello@datakeelai.com is a Hostinger Email mailbox (Starter plan, 1 mailbox), with info@ as an alias. Webmail: https://mail.hostinger.com.
- DNS at Hostinger: MX `mx1/mx2.hostinger.com`, SPF `v=spf1 include:_spf.mail.hostinger.com ~all`, DKIM `hostingermail-a/-b/-c._domainkey` CNAMEs, DMARC `v=DMARC1; p=none`. mail-tester.com score 9.5/10 on 2026-11-06.
- After 2-4 weeks of clean sending, raise DMARC to `p=quarantine`.
- Email signature: `email-signature/signature.html` (outside this repo); its logo is served from `/email/datakeel-ai-logo.png` in this site.

## Publishing
- Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `astro check`, `npm test` (unit + browser tests, builds first), then the GitHub Pages build and deploy. Any failing step stops the deploy, so the live site never changes.
- Before a change: run `npx astro check`, `npm test` and `npm run audit` locally (the audit adds Lighthouse and axe in both themes).
- `main` is protected: changes arrive by pull request, and the Deploy check must pass before merging.
- Run a deploy by hand: Actions → Deploy → Run workflow.

## Launch checklist (Stories 9.1, 9.3, 9.4)
Do these in order. Until step 3, the github.io address shows unstyled pages, because the site is built for datakeelai.com.

1. **Sign-off (9.1)**
   - Every copy item in `_bmad-output/planning-artifacts/content/epic6-8-copy-review.md` approved; each `reviewed: false` set to `true`.
   - Lawyer-reviewed Privacy and Terms in `src/content/pages.json` (open points in `deferred-work.md`); the draft notice disappears when `reviewed` is `true`.
   - hello@datakeelai.com receives email (done 2026-11-06, Hostinger Email). In the Web3Forms dashboard, the form delivers to hello@ and its allowed website is datakeelai.com.
   - Optional: LinkedIn and Upwork URLs in `profileUrls`.
   - Click through the three key flows on a phone and a desktop (Chrome, Edge, Safari, Firefox, mobile Safari/Chrome):
     - **Sara:** home → How We Work → a case study → Readiness Review → send the form.
     - **Omar:** What We Do → Stack Diagram → two case studies → The DataKeel Standard.
     - **Priya:** home → Self-Assessment → Snapshot → print/save the snapshot.
2. **Verify the domain on GitHub (9.3):** GitHub → your profile Settings → Pages → Add a verified domain → `datakeelai.com`. Add the TXT record it shows in Hostinger (below), then click Verify.
3. **Point the domain at GitHub Pages (9.3):** in Hostinger, remove any old A/AAAA/CNAME records for `@` and `www` (including Hostinger's parking records), then add:

   | Type | Name | Value |
   |------|------|-------|
   | TXT | `_github-pages-challenge-meullah` | (the code GitHub shows) |
   | A | `@` | 185.199.108.153 |
   | A | `@` | 185.199.109.153 |
   | A | `@` | 185.199.110.153 |
   | A | `@` | 185.199.111.153 |
   | AAAA | `@` | 2606:50c0:8000::153 |
   | AAAA | `@` | 2606:50c0:8001::153 |
   | AAAA | `@` | 2606:50c0:8002::153 |
   | AAAA | `@` | 2606:50c0:8003::153 |
   | CNAME | `www` | meullah.github.io |

   Done 2026-11-05. Then in the repo: Settings → Pages → Custom domain → `datakeelai.com` → Save. When the certificate is issued (minutes to a day), tick **Enforce HTTPS**. Check that http://datakeelai.com, https://www.datakeelai.com and http://www.datakeelai.com all end at https://datakeelai.com/.
4. **Analytics (8.4):** done 2026-11-06. Cloudflare Web Analytics site `datakeelai.com` (manual JS snippet, DNS stays at Hostinger); token in `cloudflareAnalyticsToken`. The beacon loads only on datakeelai.com and sets no cookies.
5. **Search engines (9.4):**
   - Google Search Console → Add property → Domain → `datakeelai.com` → add its TXT record in Hostinger (Name `@`) → Verify → Sitemaps → submit `https://datakeelai.com/sitemap-index.xml`.
   - Bing Webmaster Tools → Add site → import from Search Console (or verify by DNS) → submit the same sitemap.
6. **Live smoke test (9.4):**
   - https://datakeelai.com/ loads over HTTPS.
   - One real submission per form arrives at hello@datakeelai.com ("New Readiness Review request", "New contact message").
   - Cloudflare Web Analytics shows the visit.
   - The canonical link on a few pages matches the address bar.

## Monthly checks
- **Web3Forms quota:** the free plan has a monthly submission limit. Check usage in the Web3Forms dashboard and upgrade before it runs out.
- **Dependencies:** run `npm outdated` and update Astro and the test tools; run the three checks, then push.
- **Deploys:** Actions tab, every run of the last month green.
- **Search:** Search Console and Bing, coverage errors and the sitemap status.
- **Analytics:** visits to `/readiness-review/sent/` and `/contact/sent/` (each one is a sent form), plus referrals from chatgpt.com, perplexity.ai, copilot.microsoft.com and gemini.google.com (AI-search traffic). Both show in Cloudflare Web Analytics under Paths and Referrers.
- **AI visibility:** ask 10-20 buyer questions in ChatGPT, Perplexity, Copilot, Gemini and Claude. Examples: "How do I make my company's data AI-ready?", "Microsoft Fabric or Databricks for a mid-size company?", "data platform consultancy for healthcare". Log in the table below whether DataKeel AI is mentioned or cited.

| Month | Prompt | Assistant | Mentioned? | Cited page |
|-------|--------|-----------|------------|------------|
| | | | | |
