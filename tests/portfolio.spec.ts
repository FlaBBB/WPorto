import { expect, test, type Page } from "@playwright/test";

const repositoryUrls = {
  WordyChain: "https://github.com/FlaBBB/WordyChain",
  JMC: "https://github.com/FlaBBB/JMC",
  Cybers_security: "https://github.com/FlaBBB/Cybers_security",
};

const technicalProfileRows = (page: Page) =>
  page
    .getByRole("list", { name: "Technical Profile evidence ledger" })
    .getByRole("listitem");

test.describe("static Technical Profile output", () => {
  test.use({ javaScriptEnabled: false });

  test("serves complete evidence and working disclosures without JavaScript", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle("Signal Ledger — Fikri Flab");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fikri Flab",
    );
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "00 / identity",
      "01 / Technical Profile",
      "02 / selected evidence",
      "03 / learning archive",
      "04 / Contact Path",
    ]);

    const rows = technicalProfileRows(page);
    await expect(rows).toHaveCount(4);
    await expect(rows.locator("summary .ledger-capability")).toHaveText([
      "TypeScript web applications",
      "Modular application design with automated tests",
      "Project-specific web-stack exposure",
      "Security-learning archive",
    ]);
    const observedEvidence = [
      "TypeScript web and realtime application structure is publicly visible across JMC and WordyChain.",
      "WordyChain visibly separates realtime, web, shared, dictionary, and game-core packages; its public tree includes unit-flow, end-to-end, and package-level tests.",
      "JMC documents Next.js App Router, TypeScript, PostgreSQL/Prisma, NextAuth.js v5, Tailwind CSS v4, Bun, Docker, Piston-backed code execution, and multiple submission languages.",
      "A public cybersecurity archive contains CTF-oriented material for cryptography, digital forensics, reverse engineering, and binary exploitation.",
    ];
    const qualifications = [
      "Public repositories establish hosted project material, not individual proficiency level, employment history, or sole authorship.",
      "Visible project structure and tests do not establish authorship of every component.",
      "This is JMC’s documented stack, not a personal proficiency claim; the README says the project was written by AI.",
      "A learning archive, not professional security work, a certification, or production security responsibility.",
    ];

    for (let index = 0; index < 4; index += 1) {
      const row = rows.nth(index);
      if (index > 0) {
        await row.locator("summary").focus();
        await page.keyboard.press("Space");
      }
      await expect(row.locator(".ledger-details")).toBeVisible();
      await expect(row.locator("dt")).toHaveText([
        "Observed evidence",
        "Qualification",
      ]);
      await expect(row.locator("dd").first()).toHaveText(
        observedEvidence[index],
      );
      await expect(row.locator("dd").last()).toHaveText(qualifications[index]);
      await expect(row.locator(".ledger-source")).toBeVisible();
    }
    for (const [project, href] of Object.entries(repositoryUrls)) {
      await expect(
        page.getByRole("link", { name: new RegExp(project) }).first(),
      ).toHaveAttribute("href", href);
    }
    await expect(page.locator(".signal-field svg")).toBeVisible();
    await expect(page.locator(".signal-field canvas")).toHaveCount(0);
  });
});

test("publishes canonical metadata, a favicon, and direct Contact Paths", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://flab.my.id/",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Fikri Flab.*TypeScript.*public source material/,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://flab.my.id/",
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Signal Ledger — Fikri Flab",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary",
  );
  const icon = await request.get("/favicon.svg");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");

  const contact = page.locator("#contact-path");
  await expect(
    contact.getByRole("link", { name: "GitHub Inspect public work" }),
  ).toHaveAttribute("href", "https://github.com/FlaBBB");
  await expect(
    contact.getByRole("link", { name: "LinkedIn Professional profile" }),
  ).toHaveAttribute("href", "https://www.linkedin.com/in/fikri-flab/");
  await expect(
    contact.getByRole("link", { name: "Email Start a conversation" }),
  ).toHaveAttribute("href", "mailto:f12345ff67@gmail.com");
  await expect(
    page.getByRole("link", {
      name: "Inspect public work (opens in a new tab)",
    }),
  ).toHaveAttribute("target", "_blank");
});

test("makes the skip link and numbered navigation keyboard reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Explore selected evidence" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#selected-evidence$/);
  const headingTop = await page
    .locator("#selected-evidence-heading")
    .evaluate((el) => el.getBoundingClientRect().top);
  const headerBottom = await page
    .locator(".site-header")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(headingTop).toBeGreaterThanOrEqual(headerBottom);
  const navigationLabels = await page
    .getByRole("navigation")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("aria-label")),
    );
  expect(navigationLabels).toEqual([
    "00 / identity",
    "01 / Technical Profile",
    "02 / selected evidence",
    "03 / learning archive",
    "04 / Contact Path",
  ]);
});

test("uses native keyboard disclosure without hiding sources", async ({
  page,
}) => {
  await page.goto("/");
  const rows = technicalProfileRows(page);
  await expect(rows.locator("details[open]")).toHaveCount(1);
  await expect(rows.first().locator("details")).toHaveAttribute("open", "");
  await expect(page.locator(".signal-field canvas")).toHaveCount(1);
  await expect(rows.locator("details[open]")).toHaveCount(1);

  const second = rows.nth(1);
  const summary = second.locator("summary");
  await expect(second.locator(".ledger-details")).toBeHidden();
  await summary.focus();
  await expect(summary).toHaveCSS("outline-width", "2px");
  await expect(summary).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(second.locator("details")).toHaveAttribute("open", "");
  await expect(second.locator(".ledger-details")).toBeVisible();
  await expect(rows.first().locator(".ledger-details")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(second.locator(".ledger-details")).toBeHidden();
  for (const row of await rows.all())
    await expect(row.locator(".ledger-source")).toBeVisible();
});

test("provides the Reduced-Motion Alternate and handles preference changes after load", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".signal-field canvas")).toHaveCount(0);
  await expect(page.locator(".signal-field svg")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  const thirdRow = technicalProfileRows(page).nth(2);
  await thirdRow.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(thirdRow.locator(".ledger-details")).toBeVisible();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".signal-field canvas")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".signal-field canvas")).toHaveCount(0);
  await expect(page.locator(".signal-field svg")).toBeVisible();
  await expect(thirdRow.locator("details")).toHaveAttribute("open", "");
});

test("moves the signal within its bounds and resets on pointer leave", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const canvas = page.locator(".signal-field canvas");
  await expect(canvas).toBeVisible();
  const field = await page.locator(".signal-field").boundingBox();
  if (!field) throw new Error("Signal field missing");
  await page.mouse.move(
    field.x + field.width * 0.9,
    field.y + field.height * 0.2,
  );
  const translation = () =>
    canvas.evaluate((el) => {
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
  await expect
    .poll(async () => Math.abs((await translation()).x - 19.2))
    .toBeLessThan(0.2);
  await expect
    .poll(async () => Math.abs((await translation()).y + 14.4))
    .toBeLessThan(0.2);
  await page.mouse.move(1, 1);
  await expect
    .poll(async () => Math.abs((await translation()).x))
    .toBeLessThan(0.1);
  await expect
    .poll(async () => Math.abs((await translation()).y))
    .toBeLessThan(0.1);
});

for (const width of [320, 390, 768, 801, 1100, 1440]) {
  test(`keeps navigation, content, and touch targets usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(page.getByRole("navigation")).toBeVisible();
    if (width <= 800) {
      for (const link of await page
        .getByRole("navigation")
        .getByRole("link")
        .all()) {
        const bounds = await link.boundingBox();
        expect(bounds?.x).toBeGreaterThanOrEqual(0);
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
          width,
        );
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator(".nav-short")).toHaveText([
        "Identity",
        "Profile",
        "Evidence",
        "Archive",
        "Contact",
      ]);
    }
    const contactNav = page
      .getByRole("navigation")
      .getByRole("link", { name: "04 / Contact Path" });
    await contactNav.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contact-path$/);
    const header = await page.locator(".site-header").boundingBox();
    const heading = await page.locator("#contact-path-heading").boundingBox();
    expect(heading?.y).toBeGreaterThanOrEqual(
      (header?.y ?? 0) + (header?.height ?? 0),
    );
    for (const link of await page.locator("#contact-path a").all()) {
      await expect(link).toBeVisible();
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    const thirdRow = technicalProfileRows(page).nth(2);
    await thirdRow.locator("summary").click();
    await expect(thirdRow.locator(".ledger-details")).toBeVisible();
    expect(
      (await thirdRow.locator("summary").boundingBox())?.height,
    ).toBeGreaterThanOrEqual(44);
    const observed = await thirdRow
      .locator(".ledger-field")
      .first()
      .boundingBox();
    const qualification = await thirdRow
      .locator(".ledger-qualification")
      .boundingBox();
    if (width <= 800)
      expect(qualification?.y).toBeGreaterThan(observed?.y ?? 0);
    else expect(qualification?.y).toBe(observed?.y);

    const panels = await page.locator("#selected-evidence article").all();
    const first = await panels[0].boundingBox();
    const second = await panels[1].boundingBox();
    if (width <= 800) {
      expect(first?.x).toBe(second?.x);
      expect(second?.y).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0));
    } else {
      expect(first?.y).toBe(second?.y);
      expect(second?.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
    }
    const overflow = await page
      .locator("#selected-evidence h3, #selected-evidence p, .contact-title")
      .evaluateAll((elements) =>
        elements
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent),
      );
    expect(overflow).toEqual([]);
  });
}

test("keeps text contrast readable on dark and blue surfaces", async ({
  page,
}) => {
  await page.goto("/");
  const contrast = await page
    .locator(
      ".hero-note, .primary-link, .section-intro, .ledger-qualification dd, #contact-path a, nav a",
    )
    .evaluateAll((elements) => {
      const luminance = (color: string) => {
        const [red, green, blue] = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      return elements.map((el) => {
        let background: Element | null = el;
        while (
          background &&
          getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)"
        ) {
          background = background.parentElement;
        }
        const ink = luminance(getComputedStyle(el).color);
        const surface = luminance(
          getComputedStyle(background!).backgroundColor,
        );
        return (
          (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05)
        );
      });
    });
  for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("returns a real 404 with a working recovery path", async ({ page }) => {
  const response = await page.goto("/missing-portfolio-page/nested");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found — Fikri Flab");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "No signal here.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  await page.getByRole("link", { name: "Back to the Portfolio Site" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fikri Flab",
  );
});

test("loads the page and its local assets without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(page.locator(".signal-field canvas")).toBeVisible();
  await page.locator("#technical-profile summary").nth(3).click();
  await expect(page.locator("#evidence-detail-3")).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
