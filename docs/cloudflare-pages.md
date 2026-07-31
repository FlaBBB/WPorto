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

## Preview browser acceptance

`.github/workflows/pages-preview-acceptance.yml` waits for the public branch alias at `https://<normalized-branch>.wporto.pages.dev`, then runs the existing browser acceptance suite with `PLAYWRIGHT_BASE_URL` set to that URL. The workflow needs no Cloudflare credentials because Cloudflare's GitHub integration performs the deployment. Fork pull requests are skipped because Cloudflare Pages does not create Git-integration previews for them.
The production build writes the public `/.build-metadata.json` file with Cloudflare's `CF_PAGES_COMMIT_SHA`; before testing, the workflow requires that value to equal the pull request head SHA. This prevents a mutable branch alias from passing tests against an earlier deployment.

Cloudflare lowercases a branch alias and replaces non-alphanumeric characters with `-`; the workflow applies the same transformation. Keep the Pages project name `wporto`, or update the workflow URL if the project name changes.

## Verification

1. Open a pull request from a branch in `FlaBBB/WPorto`.
2. Confirm the Cloudflare Pages build check reports a public preview URL.
3. Confirm `Pages preview acceptance` passes against that URL.
4. Merge the pull request into `main` and confirm the Pages production deployment completes from the same `npm run build` and `dist` configuration.
