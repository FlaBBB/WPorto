import { expect, test } from "@playwright/test";

const repositoryUrls = {
  WordyChain: "https://github.com/FlaBBB/WordyChain",
  JMC: "https://github.com/FlaBBB/JMC",
  Cybers_security: "https://github.com/FlaBBB/Cybers_security",
};

test("serves the complete Technical Profile from static output without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();

  await expect(page).toHaveTitle("Signal Ledger — Fikri Flab");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Fikri Flab" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "00 / identity",
    "01 / Technical Profile",
    "02 / selected evidence",
    "03 / learning archive",
    "04 / Contact Path",
  ]);

  const ledger = page.getByRole("list", { name: "Technical Profile evidence ledger" });
  await expect(ledger.getByRole("listitem")).toHaveCount(4);
  const profileRows = ledger.getByRole("listitem");
  await expect(profileRows).toHaveText([
    /TypeScript web applications/,
    /Modular application design with automated tests/,
    /Project-specific web-stack exposure/,
    /Security-learning archive/,
  ]);

  for (const row of await profileRows.all()) {
    await expect(row.locator("dt")).toHaveText(["Capability", "Observed evidence", "Qualification", "Source"]);
  }
  await expect(profileRows.nth(0)).toContainText(
    "TypeScript web and realtime application structure is publicly visible across JMC and WordyChain.",
  );
  await expect(profileRows.nth(1)).toContainText(
    "WordyChain visibly separates realtime, web, shared, dictionary, and game-core packages; its public tree includes unit-flow, end-to-end, and package-level tests.",
  );
  await expect(profileRows.nth(2)).toContainText(
    "JMC documents Next.js App Router, TypeScript, PostgreSQL/Prisma, NextAuth.js v5, Tailwind CSS v4, Bun, Docker, Piston-backed code execution, and multiple submission languages.",
  );
  await expect(profileRows.nth(3)).toContainText(
    "A public cybersecurity archive contains CTF-oriented material for cryptography, digital forensics, reverse engineering, and binary exploitation.",
  );


  await expect(profileRows.nth(0)).toContainText(
    "Public repositories establish hosted project material, not individual proficiency level, employment history, or sole authorship.",
  );
  await expect(profileRows.nth(1)).toContainText(
    "Present this as visible project structure and test coverage, not a blanket claim about every component’s authorship.",
  );
  await expect(profileRows.nth(2)).toContainText("the README says the project was written by AI.");
  await expect(profileRows.nth(3)).toContainText(
    "Label it a learning archive, not professional security work, a certification, or a claim of production security responsibility.",
  );

  for (const [project, href] of Object.entries(repositoryUrls)) {
    await expect(page.getByRole("link", { name: new RegExp(project) }).first()).toHaveAttribute("href", href);
  }

  await expect(page.getByRole("link", { name: "Inspect public work (opens in a new tab)" })).toHaveAttribute(
    "href",
    "https://github.com/FlaBBB",
  );
  await expect(page.getByRole("link", { name: "GitHub — inspect public work ↗" })).toHaveAttribute(
    "href",
    "https://github.com/FlaBBB",
  );
  await expect(page.getByRole("link", { name: "LinkedIn — professional profile ↗" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/fikri-flab/",
  );
  await expect(page.getByRole("link", { name: "Email — start a conversation ↗" })).toHaveAttribute(
    "href",
    "mailto:f12345ff67@gmail.com",
  );

  await context.close();
});

test("keeps the numbered navigation and external source links keyboard reachable", async ({ page }) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Portfolio sections" });
  await expect(navigation.getByRole("link")).toHaveText([
    "00 / identity",
    "01 / Technical Profile",
    "02 / selected evidence",
    "03 / learning archive",
    "04 / Contact Path",
  ]);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "00 / identity" })).toBeFocused();

  await page.getByRole("link", { name: "Inspect WordyChain ↗" }).focus();
  await expect(page.getByRole("link", { name: "Inspect WordyChain ↗" })).toBeFocused();
});
