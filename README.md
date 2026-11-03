# DataKeel AI website

Static Astro site for datakeelai.com. Requires **Node 24** (see `.nvmrc`) and npm.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server at http://localhost:4321 |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run check` | Type and template check (`astro check`) |
| `npm run test` | Unit tests (Node's built-in test runner) |
| `npm run audit` | Run the complete local quality audit |

## Quality audit

Run `npm run audit` with a local Chrome or Chromium installation. The command runs Astro checks, builds the site, runs the unit and built-output tests, starts `astro preview`, and audits the built pages without using a hosted service.

The audit fails for a failed check, build, test, or internal-link test; Lighthouse mobile Performance below 90 on a key page; a critical or serious axe violation on any built page in either theme; horizontal overflow at 360px or 1024px; or an unavailable Chrome installation. Detailed local results are written to `.audit/`.

Every story must pass `npm run audit` before it is done.
