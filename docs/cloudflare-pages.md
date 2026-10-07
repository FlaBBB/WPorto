# Cloudflare Pages release configuration

The Portfolio Site deploys only through Cloudflare Pages' GitHub integration. There is no Wrangler deployment command, Pages Action, runtime secret, Pages Function, Worker binding, database, or server adapter.

## One-time Cloudflare setup

In **Workers & Pages**, create the `wporto` Pages project by connecting the Cloudflare Workers & Pages GitHub App to `FlaBBB/WPorto`. Configure its Git integration as follows:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | repository root (`/`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Dependency installation | Cloudflare's npm install step using the committed `package-lock.json` |
| Preview branch control | all branches |

Do not add environment variables, bindings, Functions, a Worker, or a direct-upload deployment path. The GitHub integration creates the Pages build check and a public preview URL for each same-repository pull request. Pushes to `main` use the identical static build configuration for production; a failed build does not replace the previous successful deployment.

## Production custom domain

In the same Cloudflare account as `wporto`, make `flab.my.id` an active zone. In **Workers & Pages** → `wporto` → **Custom domains**, attach `flab.my.id` as the apex domain. Cloudflare then manages the apex Pages DNS record and certificate.

Keep the Astro `site` configuration and rendered canonical URL at `https://flab.my.id`; do not configure a repository base path.

Create two **Bulk Redirects** lists and rules:

| Source URL | Target URL | Status | Required options |
| --- | --- | --- | --- |
| `https://www.flab.my.id` | `https://flab.my.id` | 301 | Preserve query string, subpath matching, preserve path suffix |
| `https://wporto.pages.dev` | `https://flab.my.id` | 301 | Preserve query string, subpath matching, preserve path suffix |

For the `www` rule to receive traffic, add a DNS `A` record named `www` with content `192.0.2.1` and **Proxied** status. It is a redirect placeholder, not an origin address.

Do not attach `www.flab.my.id` to Pages: the Bulk Redirect rule owns that hostname.

The redirect rules and the active zone are Cloudflare account state. They cannot be provisioned by this repository's Git integration, which deliberately has no Cloudflare credentials.

Do not add a catch-all `_redirects` rule to solve these hostname redirects. Pages does not support domain-level redirects in that file; an unconditional path rule would also affect the canonical host and public previews. Use the account-managed rules above. See [Cloudflare Pages redirect documentation](https://developers.cloudflare.com/pages/configuration/redirects/).

`production-acceptance.yml` runs after each `main` push and on manual dispatch. Its browser job waits for the exact deployed commit, then runs Chromium, Firefox, and WebKit acceptance against `https://flab.my.id`. Two independent jobs check the 301 redirect contracts, so an account-level DNS failure cannot prevent UI verification and neither redirect failure hides the other. Redirect failures still fail the workflow; they are not waived. Curl's default certificate verification makes a failed or invalid TLS certificate fail the check.

The owner-approved Direction A uses warm off-white paper, plum typography, purple surfaces, and cyan/amber accents. Angular cut contours and solid offset edges carry the thick-paper material through selected surfaces, with one FF identity in the header, footer, favicon, and 404 page. The fox appears only in the hero: distant crystals, the character, and near crystals sit over an irregular CSS paper backdrop. GSAP gives the four layers different pointer and scroll depths, with bounded pointer movement at narrow widths; touch input does not drive pointer motion. The Reduced-Motion Alternate disables these effects and handles preference changes after load. Content remains available without JavaScript.

The Evidence Ledger renders as native HTML disclosures inside Sources & scope, with the first evidence record open and source links exposed whenever Sources & scope is expanded. The sticky horizontal navigation exposes Work, Profile, and Contact at every tested width. These owner-approved decisions supersede the corresponding older layout and hydration decisions in [specification #6](https://github.com/FlaBBB/WPorto/issues/6); its factual content boundaries remain unchanged.

## Preview browser acceptance

`.github/workflows/pages-preview-acceptance.yml` waits for the public branch alias at `https://<normalized-branch>.wporto.pages.dev`, then runs the existing browser acceptance suite with `PLAYWRIGHT_BASE_URL` set to that URL. The workflow needs no Cloudflare credentials because Cloudflare's GitHub integration performs the deployment. Fork pull requests are skipped because Cloudflare Pages does not create Git-integration previews for them.
The production build writes the public `/.build-metadata.json` file with Cloudflare's `CF_PAGES_COMMIT_SHA`; before testing, the workflow requires that value to equal the pull request head SHA. This prevents a mutable branch alias from passing tests against an earlier deployment.

Cloudflare lowercases a branch alias and replaces non-alphanumeric characters with `-`; the workflow applies the same transformation. Keep the Pages project name `wporto`, or update the workflow URL if the project name changes.

## Verification

`static-acceptance.yml` checks types and builds/tests the static output in all three browser engines on pull requests and `main` pushes, independently of Cloudflare availability. Locally, run `npm ci`, `npx playwright install chromium firefox webkit`, `npm run check`, and `npm test`. Linux CI installs browser system dependencies with `--with-deps`; unsupported local distributions may need a supported runner for WebKit.

1. For a pull request from `FlaBBB/WPorto`, confirm `Static acceptance`, the Cloudflare Pages build check, and `Pages preview acceptance` pass. Forks still receive static acceptance without Cloudflare credentials.
2. After the approved change reaches `main`, confirm the Pages production deployment completes from the same `npm run build` and `dist` configuration.
3. Confirm `https://flab.my.id/.build-metadata.json` reports that exact commit, `Production acceptance` passes, and a missing nested URL returns the Portfolio Site's recovery page with HTTP 404, not the homepage with HTTP 200.
4. Inspect the deployed desktop and mobile presentation. Treat unresolved DNS or redirect checks as outstanding host configuration, even when the canonical deployment and browser checks succeed.
