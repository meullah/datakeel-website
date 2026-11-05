# DataKeel AI website: operations

How the site is published, how to launch it on datakeelai.com, and what to check every month.

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
   - hello@datakeelai.com receives email; `web3formsKey` in `src/lib/config.ts` swapped for a key tied to hello@; the Web3Forms form's website set to datakeelai.com.
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

   Then in the repo: Settings → Pages → Custom domain → `datakeelai.com` → Save. When the certificate is issued (minutes to a day), tick **Enforce HTTPS**. Check that http://datakeelai.com, https://www.datakeelai.com and http://www.datakeelai.com all end at https://datakeelai.com/.
4. **Analytics (8.4):** Cloudflare dashboard → Web Analytics → Add a site → `datakeelai.com` → copy the token into `cloudflareAnalyticsToken` in `src/lib/config.ts` → push. The beacon loads only on datakeelai.com and sets no cookies.
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
