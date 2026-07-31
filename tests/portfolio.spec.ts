import { expect, test, type Page } from "@playwright/test";

const repositoryUrls = {
  WordyChain: "https://github.com/FlaBBB/WordyChain",
  JMC: "https://github.com/FlaBBB/JMC",
  Cybers_security: "https://github.com/FlaBBB/Cybers_security",
};

const technicalProfileRows = (page: Page) =>
  page.getByRole("list", { name: "Technical Profile evidence ledger" }).getByRole("listitem");

test.describe("static Technical Profile output", () => {
  test.use({ javaScriptEnabled: false });

  test("serves the complete Technical Profile from static output without JavaScript", async ({ page }) => {

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

});
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
  await expect(page.getByRole("link", { name: "Inspect public work (opens in a new tab)" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "00 / identity" })).toBeFocused();

  await page.getByRole("link", { name: "Inspect WordyChain ↗" }).focus();
  await expect(page.getByRole("link", { name: "Inspect WordyChain ↗" })).toBeFocused();
});

test("stacks the Technical Profile in order and keeps Contact Path targets usable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Portfolio sections" })).toBeHidden();

  const profileRows = technicalProfileRows(page);
  await expect(profileRows).toHaveCount(4);

  for (const row of await profileRows.all()) {
    const fieldPositions = await row.locator("dl > div").evaluateAll((fields) =>
      fields.map((field) => field.getBoundingClientRect().top),
    );
    for (let fieldIndex = 1; fieldIndex < fieldPositions.length; fieldIndex += 1) {
      expect(fieldPositions[fieldIndex]).toBeGreaterThan(fieldPositions[fieldIndex - 1]);
    }
    await expect(row.locator("dl > div").nth(2)).toBeVisible();
  }

  const evidencePanels = page.locator("#selected-evidence article");
  const panelPositions = await evidencePanels.evaluateAll((panels) =>
    panels.map((panel) => {
      const { left, top } = panel.getBoundingClientRect();
      return { left, top };
    }),
  );
  expect(panelPositions[0].top).toBeLessThan(panelPositions[1].top);
  expect(panelPositions[0].left).toBe(panelPositions[1].left);

  for (const contactLink of await page.locator("#contact-path a").all()) {
    await expect(contactLink).toBeVisible();
    expect(await contactLink.evaluate((link) => link.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
});

test("presents the desktop Technical Profile as a ruled Signal Ledger", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  const stickyNavigationIndex = page.getByRole("navigation", { name: "Portfolio sections" }).locator("..");
  await expect(stickyNavigationIndex).toHaveCSS("position", "sticky");
  expect((await stickyNavigationIndex.boundingBox())?.y).toBeGreaterThanOrEqual(1000);
  await page.locator("#technical-profile").scrollIntoViewIfNeeded();
  expect((await stickyNavigationIndex.boundingBox())?.y).toBeLessThanOrEqual(32);

  const firstLedgerRow = technicalProfileRows(page).first();
  const firstFieldPositions = await firstLedgerRow.locator("dl > div").evaluateAll((fields) =>
    fields.slice(0, 3).map((field) => field.getBoundingClientRect().top),
  );
  expect(new Set(firstFieldPositions).size).toBe(1);

  const [wordyChainPanel, jmcPanel] = await page.locator("#selected-evidence article").all();
  const wordyChainBounds = await wordyChainPanel.boundingBox();
  const jmcBounds = await jmcPanel.boundingBox();
  expect(wordyChainBounds?.x).toBeLessThan(jmcBounds?.x ?? 0);
  expect(wordyChainBounds?.y).toBeLessThan(jmcBounds?.y ?? 0);

  const contactPath = page.locator("#contact-path");
  await contactPath.scrollIntoViewIfNeeded();
  await expect(contactPath).toHaveCSS("background-color", "rgb(34, 70, 255)");
});
