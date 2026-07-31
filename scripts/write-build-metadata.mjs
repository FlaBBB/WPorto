import { writeFile } from "node:fs/promises";

const commit = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";

await writeFile("dist/.build-metadata.json", `${JSON.stringify({ commit })}\n`);
