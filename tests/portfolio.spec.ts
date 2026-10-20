import { expect, test, type Page } from "@playwright/test";

const repositoryUrls = {
  WordyChain: "https://github.com/FlaBBB/WordyChain",
  JMC: "https://github.com/FlaBBB/JMC",
  "harness-agentic-sdlc": "https://github.com/FlaBBB/harness-agentic-sdlc",
  "OOT-AI-Agent-Practice": "https://github.com/FlaBBB/OOT-AI-Agent-Practice",
  Cybers_security: "https://github.com/FlaBBB/Cybers_security",
};

const profileRows = (page: Page) =>
  page
    .getByRole("list", { name: "Technical Profile evidence ledger" })
    .getByRole("listitem");

const CAPABILITIES = [
  "TypeScript web applications",
  "Modular application design with automated tests",
  "Project-specific web-stack exposure",
  "Agentic SDLC workflow tooling",
  "Security-learning archive",
  "Reconciled professional and competition profile",
];

const OBSERVED_EVIDENCE = [
  "TypeScript web and realtime application structure is publicly visible across WordyChain, JMC, and the harness-agentic-sdlc workflow tooling.",
  "WordyChain visibly separates realtime and web applications from shared, dictionary, and game-core packages, with unit-flow, end-to-end, and package-level tests; OOT-AI-Agent-Practice pairs a Java store with JUnit 5 tests and a business-rule verifier.",
  "JMC documents Next.js App Router, TypeScript, PostgreSQL/Prisma, NextAuth.js v5, Tailwind CSS v4, Bun, Docker, Piston-backed code execution, and multiple submission languages.",
  "harness-agentic-sdlc publishes a TypeScript CLI and repository-local governance: a request-to-deploy lifecycle, structured YAML workflows, approval and CI evidence, a Mission Control projection, and machine-readable JSON output.",
  "A public cybersecurity archive spans cryptography, digital forensics, reverse engineering, binary exploitation, and smart-contract security, drawn from many CTF platforms and paired with supporting tools and cheatsheets.",
  "The LinkedIn Source Profile lists an engineering role at Six Zenith Digital, study at Politeknik Negeri Malang, and active Capture The Flag participation; the linked CTFtime profile records competition teams and published writeups since 2023.",
];

const QUALIFICATIONS = [
  "Public repositories establish hosted project material, not individual proficiency level, employment history, or sole authorship.",
  "Visible project structure and tests do not establish authorship of every component.",
  "This is JMC’s documented stack, not a personal proficiency claim; the README says the project was written by AI.",
  "This describes the project’s documented capabilities, not verified personal authorship, adoption, or production use.",
  "A learning archive, not professional security work, a certification, or production security responsibility.",
  "Profile-stated and self-reported; not independently verified, and not a claim of seniority, employment terms, or professional security responsibility.",
];

test.describe("static content without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("serves the complete reconciled profile and project records", async ({
    page,
  }) => {
    // The opening keeps the name, the Malang note and the static mark.
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle("flab — Fikri Muhammad Abdillah");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fikri Muhammad Abdillah.",
    );
    await expect(page.locator(".intro-note").first()).toContainText(
      "Malang, Indonesia",
    );

    // No-JS shows the real mark, not an empty stage or a dead control.
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    // The six reconciled capability records, with their limits.
    const rows = profileRows(page);
    await expect(rows).toHaveCount(6);
    await expect(rows.locator("summary .ledger-capability")).toHaveText(
      CAPABILITIES,
    );
    for (let index = 0; index < 6; index += 1) {
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
        OBSERVED_EVIDENCE[index],
      );
      await expect(row.locator("dd").last()).toHaveText(QUALIFICATIONS[index]);
      await expect(row.locator(".ledger-source")).toBeVisible();
    }

    // Two of the reconciled repositories are cited only by the ledger.
    for (const project of [
      "OOT-AI-Agent-Practice",
      "Cybers_security",
    ] as const) {
      await expect(
        page.getByRole("link", { name: new RegExp(project) }).first(),
      ).toHaveAttribute("href", repositoryUrls[project]);
    }

    // The three real project records.
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await expect(page.locator(".work-index h3")).toHaveText([
      "WordyChain",
      "JMC",
      "harness-agentic-sdlc",
    ]);
    for (const project of [
      "WordyChain",
      "JMC",
      "harness-agentic-sdlc",
    ] as const) {
      await expect(
        page.getByRole("link", { name: new RegExp(project) }).first(),
      ).toHaveAttribute("href", repositoryUrls[project]);
    }

    // The archive's CTFtime record and its own source link.
    await expect(
      page.getByRole("link", { name: /CTFtime/ }).first(),
    ).toHaveAttribute("href", "https://ctftime.org/user/156246");
    await expect(
      page.getByRole("link", { name: /Cybers_security/ }).first(),
    ).toHaveAttribute("href", "https://github.com/FlaBBB/Cybers_security");
  });
});

test("publishes canonical metadata, the mark favicon, and direct Contact Paths", async ({
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
    /Fikri Muhammad Abdillah.*TypeScript.*public source material/,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://flab.my.id/",
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "flab — Fikri Muhammad Abdillah",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#17131e",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary",
  );

  const icon = await request.get("/favicon.svg");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");

  // The Contact Paths close the same document.
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
});

test("makes the section navigation keyboard reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // The Skip to content link was removed, so the wordmark is the first tab stop
  // and forward order continues into the header's section links.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "flab — back to the top" }),
  ).toBeFocused();
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(0);

  const headerNav = page.locator(".site-nav");
  const labels = (scope: typeof headerNav) =>
    scope
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => link.textContent?.trim()),
      );

  await page.keyboard.press("Tab");
  await expect(
    headerNav.getByRole("link", { name: "Work", exact: true }),
  ).toBeFocused();
  expect(await labels(headerNav)).toEqual([
    "Work",
    "Writing",
    "Profile",
    "Archive",
    "Contact",
  ]);

  // The header's five links are the only in-page section route now, so they are
  // the route to every section for a visitor who already knows which one they
  // want. Writing also has a page of its own, which is linked from the section.
  const contactNav = headerNav.getByRole("link", { name: "Contact", exact: true });
  await expect(contactNav).toHaveAttribute("href", "#contact-path");
  await contactNav.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contact-path$/);

  // The jump lands the heading clear of the fixed header.
  const header = await page.locator(".site-header").boundingBox();
  const heading = await page.locator("#contact-path-heading").boundingBox();
  expect(heading?.y).toBeGreaterThanOrEqual(
    (header?.y ?? 0) + (header?.height ?? 0) - 1,
  );

  // Continuing forward from the navigation reaches the page content: the
  // wordmark, the five section links, then the Intro's own link, in that order.
  await page.goto("/");
  const order = [
    page.locator(".flab-logo"),
    headerNav.getByRole("link", { name: "Work", exact: true }),
    headerNav.getByRole("link", { name: "Writing", exact: true }),
    headerNav.getByRole("link", { name: "Profile", exact: true }),
    headerNav.getByRole("link", { name: "Archive", exact: true }),
    headerNav.getByRole("link", { name: "Contact", exact: true }),
    page.getByRole("link", { name: "Selected work" }),
  ];
  for (const [index, locator] of order.entries()) {
    await page.keyboard.press("Tab");
    await expect(locator, `tab ${index + 1}`).toBeFocused();
  }
});

test("uses native keyboard disclosure without hiding sources", async ({
  page,
}) => {
  await page.goto("/");
  const rows = profileRows(page);
  await expect(rows.locator("details[open]")).toHaveCount(1);
  await expect(rows.first().locator("details")).toHaveAttribute("open", "");

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

    // The header's section links must stay inside the viewport with real touch
    // targets.
    const headerNav = page.locator(".site-nav");
    await expect(headerNav).toBeVisible();
    for (const link of await headerNav.getByRole("link").all()) {
      const bounds = await link.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }

    for (const link of await page.locator("#contact-path a").all()) {
      await expect(link).toBeVisible();
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    // The ledger keeps its touch targets.
    const thirdRow = profileRows(page).nth(2);
    await thirdRow.locator("summary").click();
    await expect(thirdRow.locator(".ledger-details")).toBeVisible();
    expect(
      (await thirdRow.locator("summary").boundingBox())?.height,
    ).toBeGreaterThanOrEqual(44);

    // The project names, the project copy and the contact heading never
    // overflow their own column.
    const overflow = await page
      .locator(".work-index h3, .work-index p, #contact-path .section-title")
      .evaluateAll((elements) =>
        elements
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent),
      );
    expect(overflow).toEqual([]);
  });
}

test("keeps the 320px labels inside the viewport with a wide system font", async ({
  page,
}) => {
  // DejaVu Sans is wider than the default stack and reproduced a real overflow
  // at 320px before the mobile header gap was narrowed to 1rem. The header's
  // section links are the labels that carry it.
  await page.setViewportSize({ width: 320, height: 900 });
  // Reduced motion keeps the labels laid out in flow, which is the state where a
  // wider face can actually push a label out of the viewport.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // The labels that can overflow at 320px are the monospace ones, so the wider
  // face is forced through the font variable they actually read.
  await page.addStyleTag({
    content:
      'html { --font-mono: "DejaVu Sans", sans-serif !important; font-family: "DejaVu Sans", sans-serif !important; }',
  });
  await page.waitForTimeout(300);

  const applied = await page
    .locator(".site-nav a")
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(applied).toContain("DejaVu Sans");

  // No horizontal overflow, and the labels are retained and still fit on the header
  // surface that carries them.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  const headerNav = page.locator(".site-nav");
  expect(
    (await headerNav.getByRole("link").allTextContents()).map((label) =>
      label.trim(),
    ),
  ).toEqual(["Work", "Writing", "Profile", "Archive", "Contact"]);
  for (const link of await headerNav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    // Targets stay at least 44px tall; the fix narrows the gap, not the targets.
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

/** Painted contrast ratio of each match against the surface behind it. */
const contrastRatios = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) => {
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
      const surface = luminance(getComputedStyle(background!).backgroundColor);
      return (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05);
    });
  });

test("keeps text contrast readable on the plum and violet surfaces", async ({
  page,
}) => {
  // Every surface is on the one page, so each is checked where it is painted;
  // every ratio still has to clear 4.5:1.
  const surfaces: [string, string][] = [
    ["#intro", ".intro-note, .intro-link"],
    ["#selected-evidence", "#selected-evidence .section-intro"],
    [
      "#technical-profile",
      "#technical-profile .section-intro, .ledger-qualification dd",
    ],
    ["#contact-path", "#contact-path a"],
    ["header", ".site-nav a"],
  ];
  await page.goto("/");
  for (const [surface, selector] of surfaces) {
    const contrast = await contrastRatios(page, selector);
    expect(contrast.length, `${surface} ${selector}`).toBeGreaterThan(0);
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

/** Painted geometry of one contact row: its box, arrow ink and label ink. */
const contactRowGeometry = (page: Page, index: number) =>
  page.evaluate((row) => {
    const ink = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      if (!rects.length) {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }
      return {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
      };
    };
    const li = document.querySelectorAll(".contact-paths li")[row];
    const box = li.getBoundingClientRect();
    const arrow = ink(li.querySelector(".contact-arrow")!);
    const label = li.querySelector(".contact-label")!;
    const labelRight = Math.max(
      ink(label.querySelector("strong")!).right,
      ink(label.querySelector("span")!).right,
    );
    return {
      boxRight: box.right,
      boxLeft: box.left,
      arrowLeft: arrow.left,
      arrowRight: arrow.right,
      labelRight,
    };
  }, index);

for (const width of [1440, 1101, 1100, 700, 390, 320]) {
  test(`insets the contact arrows from their column edge at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    // Bring the contact band into view with native smooth scrolling disabled so
    // its reveal targets actually enter the viewport and settle before measuring.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    // Settle the reveal so a translateY does not offset the measurement.
    await expect
      .poll(async () =>
        page
          .locator("#contact-path [data-reveal]")
          .evaluateAll((els) =>
            els.every(
              (el) => Number(getComputedStyle(el).opacity) >= 0.999,
            ),
          ),
      )
      .toBe(true);

    const rows = page.locator(".contact-paths li");
    await expect(rows).toHaveCount(3);

    for (let index = 0; index < 3; index += 1) {
      const resting = await contactRowGeometry(page, index);

      // The painted arrow keeps a real inset from its own column/row right edge,
      // so it never sits on the edge touching the next column's separator.
      expect(resting.boxRight - resting.arrowRight).toBeGreaterThanOrEqual(12);
      // It also never overlaps its own label ink.
      expect(resting.arrowLeft - resting.labelRight).toBeGreaterThanOrEqual(8);

      // The 4px hover nudge must not undo the inset.
      await rows.nth(index).locator("a").hover();
      await page.waitForTimeout(450);
      const hovered = await contactRowGeometry(page, index);
      expect(hovered.boxRight - hovered.arrowRight).toBeGreaterThanOrEqual(12);
      expect(hovered.arrowLeft - hovered.labelRight).toBeGreaterThanOrEqual(8);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);
    }

    // The inset must not introduce any horizontal overflow.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      width,
    );
  });
}

test("keeps a visible focus ring on the violet contact band", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const links = page.locator("#contact-path a");
  await expect(links).toHaveCount(3);

  // Keyboard intent is required for :focus-visible to apply at all.
  await page.keyboard.press("Tab");

  for (let index = 0; index < 3; index += 1) {
    const link = links.nth(index);
    await link.focus();
    await expect(link).toBeFocused();

    const ring = await link.evaluate((el) => {
      const luminance = (color: string) => {
        const [r, g, b] = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((c) => {
            const v = c / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const style = getComputedStyle(el);
      // The band's own background is the surface the ring must read against.
      const band = document.querySelector("#contact-path")!;
      const surface = luminance(getComputedStyle(band).backgroundColor);
      const outline = luminance(style.outlineColor);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
        ratio:
          (Math.max(outline, surface) + 0.05) /
          (Math.min(outline, surface) + 0.05),
      };
    });

    // An accent-coloured ring would be invisible on the violet band.
    expect(ring.style, `link ${index}`).toBe("solid");
    expect(ring.width, `link ${index}`).toBe("2px");
    expect(ring.ratio, `link ${index} ring=${ring.color}`).toBeGreaterThanOrEqual(
      3,
    );
  }
});

test("returns a real 404 that carries the same mark and a recovery path", async ({
  page,
}) => {
  const response = await page.goto("/missing-portfolio-page/nested");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found — Fikri Muhammad Abdillah");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nothing here after hours.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  await expect(page.locator(".flab-logo svg")).toBeVisible();
  await page.locator(".return-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fikri Muhammad Abdillah.",
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
  // The one page has to load its own bundle and local assets cleanly.
  await page.goto("/");
  await expect(page.locator(".sculpture-canvas")).toBeVisible();
  await page.locator("#technical-profile summary").nth(3).click();
  await expect(page.locator("#evidence-detail-3")).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test.describe("section refinement", () => {
  test("opens an Evidence Ledger record on desktop hover, without a click", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#technical-profile")?.scrollIntoView();
    });
    await page.waitForTimeout(400);

    // The +/- indicator is gone entirely, including its column.
    await expect(page.locator(".ledger-indicator")).toHaveCount(0);

    const rows = page.locator(".evidence-ledger details");
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toHaveAttribute("open", "");

    // Hovering a record opens it and closes the previously open one.
    await rows.nth(3).locator("summary").hover();
    await expect(rows.nth(3)).toHaveAttribute("open", "");
    await expect(rows.nth(0)).not.toHaveAttribute("open", "");

    // The first real mouse click, without leaving the row, is absorbed...
    await rows.nth(3).locator("summary").click();
    await expect(rows.nth(3)).toHaveAttribute("open", "");

    // ...and a second real mouse click closes it normally.
    await rows.nth(3).locator("summary").click();
    await expect(rows.nth(3)).not.toHaveAttribute("open", "");

    // Leaving and returning does not strand the row: it re-opens on hover.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    await rows.nth(3).locator("summary").hover();
    await expect(rows.nth(3)).toHaveAttribute("open", "");
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    await expect(rows.nth(3)).toHaveAttribute("open", "");
  });

  // Bring the Profile section into view and wait for its reveals to settle on
  // observable opacity/transform, rather than a fixed sleep.
  const openProfile = async (page: Page) => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      const el = document.querySelector("#technical-profile")!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
    });
    await page.waitForFunction(
      () => {
        const targets = [
          ...document.querySelectorAll("#technical-profile [data-reveal]"),
        ];
        return targets.every((el) => {
          const box = el.getBoundingClientRect();
          if (box.bottom <= 0 || box.top >= window.innerHeight * 0.9) return true;
          const style = getComputedStyle(el);
          const matrix =
            style.transform === "none" ? null : new DOMMatrix(style.transform);
          return (
            Number(style.opacity) >= 0.999 && Math.abs(matrix?.m42 ?? 0) < 0.5
          );
        });
      },
      undefined,
      { timeout: 10_000 },
    );
  };

  const pointAt = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

  test("opens a record from a Source-link hover, animating open and closed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.install();
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await openProfile(page);

    // The row owns the hover surface; the Source paragraph is a sibling of
    // `details`, so the links are addressed on the row.
    const rows = page.locator(".evidence-ledger > li");
    const details = (index: number) => rows.nth(index).locator("details");
    const panel = (index: number) => rows.nth(index).locator(".ledger-panel");
    // A details' painted height is summary-only when closed and summary+panel
    // when open, so it is the public measure of the disclosure's motion. (The
    // panel's own box keeps a size while the details is closed, so it cannot be
    // used for that.)
    const detailsHeight = (index: number) =>
      details(index).evaluate((el) => el.getBoundingClientRect().height);
    const sample = async (index: number) => {
      const values = [await detailsHeight(index)];
      let elapsed = 0;
      for (const time of [140, 220, 380, 700]) {
        await page.clock.runFor(time - elapsed);
        values.push(await detailsHeight(index));
        elapsed = time;
      }
      return values;
    };

    await expect(details(0)).toHaveAttribute("open", "");
    const closedHeight = await detailsHeight(1);
    const contentHeight = await panel(1).evaluate((el) => el.scrollHeight);
    const openHeight = closedHeight + contentHeight;

    // Drive tween frames after real intersection delivery. A software renderer
    // can otherwise skip the entire 0.38s transition between recorded frames.
    // Pointer and keyboard input remain genuine; a snapping panel still fails.
    await page.clock.pauseAt(new Date(Date.now() + 1000));

    // Hovering the second row's Source link (not its summary) opens the row.
    const source = rows.nth(1).locator(".ledger-source a").first();
    const sourcePoint = await pointAt(source);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    const openSamples = await sample(1);
    await expect(details(1)).toHaveAttribute("open", "");
    await expect(details(0)).not.toHaveAttribute("open", "");
    // Smooth open: the painted height passed through a real intermediate value
    // between the closed and open heights.
    expect(
      openSamples.some((h) => h > closedHeight + 1 && h < openHeight - 1),
      `open heights: ${openSamples.map((h) => h.toFixed(0)).slice(0, 16).join(",")}`,
    ).toBe(true);
    await expect
      .poll(() => detailsHeight(1))
      .toBeGreaterThan(openHeight - 1.5);

    // Close by keyboard: move the pointer away first, then focus the summary and
    // press Enter. (A genuine mouse click right after a hover open is absorbed,
    // and a stationary pointer left over another row would re-open it.)
    await page.mouse.move(2, 2);
    await rows.nth(1).locator("summary").focus();
    await page.keyboard.press("Enter");
    const closeSamples = await sample(1);
    await expect(details(1)).not.toHaveAttribute("open", "");
    expect(
      closeSamples.some((h) => h > closedHeight + 1 && h < openHeight - 1),
      `close heights: ${closeSamples.map((h) => h.toFixed(0)).slice(0, 16).join(",")}`,
    ).toBe(true);
    await expect.poll(() => detailsHeight(1)).toBeCloseTo(closedHeight, 0);
    // No stranded row: nothing else opened during the keyboard close.
    await expect(page.locator(".evidence-ledger details[open]")).toHaveCount(0);
  });

  test("keeps keyboard Space and Enter working after a hover open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await openProfile(page);

    const rows = page.locator(".evidence-ledger details");

    // Hover-open a row, then activate with the keyboard: the native toggle must
    // still apply (the mouse-absorption path must not swallow it).
    const hovered = rows.nth(2).locator("summary");
    await hovered.hover();
    await expect(rows.nth(2)).toHaveAttribute("open", "");
    await hovered.focus();
    await page.keyboard.press("Space");
    await expect(rows.nth(2)).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(rows.nth(2)).toHaveAttribute("open", "");

    // Fresh load: the default-open row, activated by keyboard during the pending
    // hover window, must stay closed — the delayed hover callback cannot reopen it.
    // A reload retains the pointer; keep it outside the ledger so it cannot
    // hover-open another row and start closing the default row during setup.
    await page.mouse.move(2, 2);
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await openProfile(page);
    const fresh = page.locator(".evidence-ledger details");
    const defaultOpen = fresh.nth(0).locator("summary");
    await expect(fresh.nth(0)).toHaveAttribute("open", "");
    await defaultOpen.hover();
    await defaultOpen.focus();
    await page.keyboard.press("Space");
    await expect(fresh.nth(0)).not.toHaveAttribute("open", "");
    await page.waitForTimeout(300);
    await expect(fresh.nth(0)).not.toHaveAttribute("open", "");

    // Keyboard activation of a closed row keeps exclusivity: the row opened by
    // keyboard is the only open one, with the default row closed.
    const second = fresh.nth(2).locator("summary");
    await second.focus();
    await page.keyboard.press("Space");
    await expect(fresh.nth(2)).toHaveAttribute("open", "");
    await expect(fresh.nth(0)).not.toHaveAttribute("open", "");
    await expect(page.locator(".evidence-ledger details[open]")).toHaveCount(1);
  });

  test("keeps the Evidence Ledger usable by touch, toggling once per tap", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 393, height: 727 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#technical-profile")?.scrollIntoView();
    });
    await page.waitForTimeout(400);

    const second = page.locator(".evidence-ledger details").nth(1);
    const summary = second.locator("summary");
    await expect(second).not.toHaveAttribute("open", "");

    // Three consecutive taps: one toggle each, never a doubled toggle.
    await summary.tap();
    await expect(second).toHaveAttribute("open", "");
    // Touch keeps exclusivity too: the tapped row is the only open one.
    await expect(page.locator(".evidence-ledger details[open]")).toHaveCount(1);
    await page.waitForTimeout(200);
    await expect(second).toHaveAttribute("open", "");
    await summary.tap();
    await expect(second).not.toHaveAttribute("open", "");
    await summary.tap();
    await expect(second).toHaveAttribute("open", "");
    await page.waitForTimeout(200);
    await expect(second).toHaveAttribute("open", "");
    await context.close();
  });

  test("renders per-section sparse star layers as decorative, non-interactive DOM", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });

    // One local layer per lower section, all in the one document, so the same
    // public DOM contract is read for every section that carries it.
    const sections = [
      "#intro",
      "#selected-evidence",
      "#writing",
      "#technical-profile",
      "#learning-archive",
      "#contact-path",
      ".site-footer",
    ];
    // Read the same public DOM contract in one round trip; repeated protocol
    // reads can consume the entire test budget on a software-rendered browser.
    const layers = await page.evaluate((selectors) => selectors.map((selector) => {
      const fields = document.querySelectorAll(`${selector} .starfield`);
      const field = fields[0];
      return {
        selector,
        count: fields.length,
        ariaHidden: field?.getAttribute("aria-hidden"),
        pointerEvents: field ? getComputedStyle(field).pointerEvents : null,
        stars: field?.querySelectorAll(".star").length ?? 0,
      };
    }), sections);
    for (const { selector, count, ariaHidden, pointerEvents, stars } of layers) {
      expect(count, selector).toBe(1);
      expect(ariaHidden, selector).toBe("true");
      expect(pointerEvents, selector).toBe("none");
      // A moderate budget per section: more presence than the first sparse pass,
      // still far below the opening's full field.
      expect(stars, selector).toBeGreaterThanOrEqual(4);
      expect(stars, selector).toBeLessThanOrEqual(10);
    }
    // No canvas is used for the lower-page decoration.
    expect(await page.locator(".page-body canvas").count()).toBe(0);
    expect(await page.locator(".site-footer canvas").count()).toBe(0);

    // Every star is inside its own section's painted box, and really visible.
    const bounds = await page.evaluate(() =>
      [...document.querySelectorAll(".page-body > section, .site-footer")].map(
        (section) => {
          const box = section.getBoundingClientRect();
          return [...section.querySelectorAll(".starfield .star")].map((star) => {
            const rect = star.getBoundingClientRect();
            return {
              withinX: rect.left >= box.left - 2 && rect.right <= box.right + 2,
              withinY: rect.top >= box.top - 2 && rect.bottom <= box.bottom + 2,
              size: rect.width * rect.height,
              opacity: Number(getComputedStyle(star).opacity),
            };
          });
        },
      ),
    );
    for (const sectionStars of bounds) {
      for (const star of sectionStars) {
        expect(star.withinX).toBe(true);
        expect(star.withinY).toBe(true);
        expect(star.size).toBeGreaterThan(0);
        expect(star.opacity).toBeGreaterThan(0);
      }
    }

    // The glyph clock is the same component in every section, so its liveness is
    // asserted once rather than five times over.
    const stars = page.locator(".starfield .star");
    const before = await stars.evaluateAll((els) =>
      els.map((el) => el.textContent).join(""),
    );
    await expect
      .poll(
        async () =>
          stars.evaluateAll((els) => els.map((el) => el.textContent).join("")),
        { timeout: 5_000 },
      )
      .not.toBe(before);

    // The contact surface uses plum stars.
    const contactColor = await page
      .locator("#contact-path .starfield .star")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(contactColor).toBe("rgb(27, 20, 48)");

    // A real hit test on a *visible* star: scroll it into view manually (the star
    // is always animating, so Playwright's stability wait would never settle),
    // then confirm the point does not resolve to the decorative star.
    const target = page.locator("#contact-path .starfield .star").first();
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#contact-path")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(200);
    const hit = await target.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hitEl = document.elementFromPoint(x, y);
      return {
        inViewport: y > 0 && y < window.innerHeight && x > 0 && x < window.innerWidth,
        isStar: hitEl?.classList.contains("star") ?? false,
      };
    });
    expect(hit.inViewport).toBe(true);
    expect(hit.isStar).toBe(false);
  });

  test("freezes the sparse stars under reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });

    const stars = page.locator(".starfield .star");
    // CSS animation is not applied under reduced motion.
    await expect(stars.first()).toHaveCSS("animation-name", "none");

    const before = await stars.evaluateAll((els) =>
      els.map((el) => el.textContent).join(""),
    );
    await page.waitForTimeout(1200);
    const after = await stars.evaluateAll((els) =>
      els.map((el) => el.textContent).join(""),
    );
    // The glyph clock is stopped too, so nothing moves.
    expect(after).toBe(before);
  });

  test("pauses and resumes the sparse stars on visibility and preference changes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });
    await page.waitForTimeout(400);

    const stars = page.locator(".starfield .star");
    const snapshot = () =>
      stars.evaluateAll((els) => els.map((el) => el.textContent).join(""));
    // A star carries two animations (drift + twinkle), so the computed value is
    // a comma-separated list; assert on the shared state.
    const animationState = () =>
      stars
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState);
    const paused = async () => (await animationState()).includes("paused");
    const running = async () =>
      (await animationState()).split(",").every((s) => s.trim() === "running");

    // Running by default.
    expect(await running()).toBe(true);
    const first = await snapshot();
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(first);

    // Hidden document: both the CSS motion and the glyph clock pause.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await paused()).toBe(true);
    const hidden = await snapshot();
    await page.waitForTimeout(1200);
    expect(await snapshot()).toBe(hidden);

    // Visible again: it resumes.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(running, { timeout: 5_000 }).toBe(true);
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(hidden);

    // A live reduced-motion change stops it, and returning resumes it.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(stars.first()).toHaveCSS("animation-name", "none");
    // CSS media rules can apply before the browser delivers JS media listeners.
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
    const reduced = await snapshot();
    await page.waitForTimeout(900);
    expect(await snapshot()).toBe(reduced);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(reduced);
  });

  test("gives the body sections generous space and a full-width archive", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    // Every body section keeps a substantial vertical rhythm (~12vh at 1000px).
    for (const selector of [
      "#intro",
      "#selected-evidence",
      "#learning-archive",
      "#contact-path",
    ]) {
      const padding = await page
        .locator(selector)
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingTop));
      expect(padding, selector).toBeGreaterThanOrEqual(100);
    }

    // Bring the archive into view so its reveals settle before the statement and
    // its aside are measured against each other.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#learning-archive")?.scrollIntoView();
    });
    await page.waitForTimeout(400);

    // The archive copy is deliberately grouped, never one very long line.
    const lines = await page
      .locator(".archive-statement")
      .evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length;
      });
    expect(lines).toBeGreaterThanOrEqual(3);

    // Bound the rendered gap, not only the grid gutter: the old layout left
    // about 380px of empty space at 1920px despite a normal CSS column gap.
    for (const width of [1920, 1440, 1101]) {
      await page.setViewportSize({ width, height: 1000 });
      const gap = await page.evaluate(() => {
        const ink = (selector: string) => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector(selector)!);
          const rects = [...range.getClientRects()];
          return {
            left: Math.min(...rects.map((r) => r.left)),
            right: Math.max(...rects.map((r) => r.right)),
          };
        };
        return ink(".archive-aside").left - ink(".archive-statement").right;
      });
      expect(gap, `${width}px`).toBeGreaterThan(8);
      expect(gap, `${width}px`).toBeLessThan(200);
    }
  });

  test("keeps the Contact paths vertically aligned with the heading and copy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      const el = document.querySelector("#contact-path")!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
    });

    // The paths group is centered against the heading + copy block, not pinned
    // near the eyebrow. At the two-column breakpoints the two centers coincide.
    for (const width of [1920, 1440, 1101]) {
      await page.setViewportSize({ width, height: 1000 });
      const delta = await page.evaluate(() => {
        const box = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const paths = box(".contact-paths");
        const intro = box(".contact-intro-block");
        return Math.abs(
          paths.top + paths.height / 2 - (intro.top + intro.height / 2),
        );
      });
      expect(delta, `${width}px`).toBeLessThan(8);
    }
  });

  test("pins the Work title column while the project list scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.evaluate(() => document.fonts.ready);

    const geometry = () =>
      page.evaluate(() => {
        const section = document.querySelector("#selected-evidence")!;
        const intro = document.querySelector(".work-intro")!;
        const index = document.querySelector(".work-index")!;
        const box = (el: Element) => el.getBoundingClientRect();
        return {
          sectionTop: box(section).top,
          sectionBottom: box(section).bottom,
          introTop: box(intro).top,
          introPosition: getComputedStyle(intro).position,
          indexTop: box(index).top,
          indexBottom: box(index).bottom,
          viewport: window.innerHeight,
        };
      });

    // Bring the section top under the header, where the title column first sticks.
    await page.evaluate(() => {
      const el = document.querySelector("#selected-evidence")!;
      const top = el.getBoundingClientRect().top + window.scrollY;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, top + 60);
    });
    const first = await geometry();
    expect(first.introPosition).toBe("sticky");
    // The title column is pinned a fixed distance under the header while the
    // project list is still passing through.
    const pinnedTop = first.introTop;
    expect(pinnedTop).toBeGreaterThan(0);
    expect(pinnedTop).toBeLessThan(140);
    expect(first.indexBottom).toBeGreaterThan(first.viewport * 0.5);

    // Scroll deeper into the list: the title stays pinned at the same viewport
    // offset while the list content moves up.
    await page.evaluate(() => window.scrollBy(0, 300));
    const second = await geometry();
    expect(Math.abs(second.introTop - pinnedTop)).toBeLessThan(2);
    expect(second.indexTop).toBeLessThan(first.indexTop);

    // Past the section, the title column releases normally with the section.
    await page.evaluate(() => {
      const el = document.querySelector("#selected-evidence")!;
      window.scrollTo(
        0,
        el.getBoundingClientRect().top + window.scrollY + el.getBoundingClientRect().height,
      );
    });
    const released = await geometry();
    expect(released.introTop).toBeLessThan(-10);

    // Below 900px the title column is static: no native pinning.
    await page.setViewportSize({ width: 800, height: 1000 });
    expect(await page.locator(".work-intro").evaluate((el) => getComputedStyle(el).position)).toBe(
      "static",
    );
  });

  test("gives Let's talk. dominant, heavy, unclipped type", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    const heading = page.locator("#contact-path-heading");
    const desktop = await heading.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        size: Number.parseFloat(style.fontSize),
        weight: Number(style.fontWeight),
      };
    });
    expect(desktop.size).toBeGreaterThanOrEqual(104);
    expect(desktop.weight).toBeGreaterThanOrEqual(800);

    // Responsive down, and never clipped by the band at any breakpoint.
    for (const width of [1101, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      const info = await heading.evaluate((el) => {
        const style = getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const ink = range.getBoundingClientRect();
        const band = el.closest("section")!.getBoundingClientRect();
        return {
          size: Number.parseFloat(style.fontSize),
          clippedRight: ink.right > band.right + 1,
          clippedLeft: ink.left < band.left - 1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(info.size, `${width}`).toBeGreaterThanOrEqual(46);
      expect(info.size, `${width}`).toBeLessThanOrEqual(112);
      expect(info.clippedRight, `${width}`).toBe(false);
      expect(info.clippedLeft, `${width}`).toBe(false);
      expect(info.overflow, `${width}`).toBe(0);
    }
  });

  test("center-aligns the intro so the name is not markedly lower than its copy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForTimeout(300);

    const delta = await page.evaluate(() => {
      const lead = document.querySelector(".intro-lead")!.getBoundingClientRect();
      const body = document.querySelector(".intro-body")!.getBoundingClientRect();
      return Math.abs(
        lead.top + lead.height / 2 - (body.top + body.height / 2),
      );
    });
    expect(delta).toBeLessThanOrEqual(8);
  });

  test("publishes the full personal name in metadata and the h1", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("flab — Fikri Muhammad Abdillah");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fikri Muhammad Abdillah.",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "flab — Fikri Muhammad Abdillah",
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      /Fikri Muhammad Abdillah.*TypeScript.*public source material/,
    );
  });

  test("matches the two-group footer reference and keeps the opening reachable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    const year = new Date().getFullYear();
    const footer = page.locator(".site-footer");
    await expect(footer.locator(".footer-name")).toHaveText(
      "Fikri Muhammad Abdillah",
    );
    await expect(footer.locator(".footer-copy")).toHaveText(`© ${year}`);
    await expect(footer.locator(".footer-note")).toContainText("Still learning.");

    // Exactly two groups: identity and the right-hand link.
    const groups = footer.locator(".footer-inner > *");
    await expect(groups).toHaveCount(2);

    // Section Links belong in the header, not in a second footer menu or an empty
    // menu container that still draws a divider.
    await expect(footer.locator("nav")).toHaveCount(0);
    for (const label of ["Work", "Profile", "Archive", "Contact"]) {
      await expect(
        footer.getByRole("link", { name: label, exact: true }),
        `the footer no longer repeats ${label}`,
      ).toHaveCount(0);
    }

    // The right group IS the link back to the opening, with the visible label kept
    // in its accessible name (Label in Name) and a matching title.
    const top = footer.locator(".footer-top");
    await expect(top).toHaveAttribute("aria-label", "Back to the opening — Still learning.");
    await expect(top).toHaveAttribute("title", "Back to the opening");
    await expect(top).toContainText("Still learning.");
    await expect(top.locator(".footer-dash")).toHaveCount(1);
    // No separate visible "Back to top" text group remains.
    await expect(footer.getByText("Back to top", { exact: true })).toHaveCount(0);

    // A thin violet rule on a near-black plum surface.
    const rule = await footer.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(rule).not.toBe("rgba(0, 0, 0, 0)");

    const box = await top.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // The foot of the page is a long way from the opening now, so the link has to
    // bring the visitor back to it rather than merely being present.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await top.click();
    await expect(page).toHaveURL(/#identity$/);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThan(2);
  });

  test("keeps the footer rule full-bleed with a constrained inner layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/");
    const metrics = await page.evaluate(() => {
      const footer = document.querySelector(".site-footer")!;
      const inner = document.querySelector(".footer-inner")!;
      return {
        footerWidth: Math.round(footer.getBoundingClientRect().width),
        innerWidth: Math.round(inner.getBoundingClientRect().width),
        viewport: window.innerWidth,
      };
    });
    // The surface spans the viewport; the readable measure is constrained.
    expect(metrics.footerWidth).toBe(metrics.viewport);
    expect(metrics.innerWidth).toBeLessThan(metrics.footerWidth);
  });
});

for (const width of [1440, 1101, 1100, 700, 390, 320]) {
  test(`keeps the refined sections intact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(500);

    // No horizontal overflow, even scrolled to the end of the page.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    // The name reaches the footer at every width.
    await expect(page.locator(".footer-name")).toHaveText(
      "Fikri Muhammad Abdillah",
    );

    // The archive statement stays a multi-line block, not a single long line.
    const lines = await page.locator(".archive-statement").evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length;
    });
    expect(lines).toBeGreaterThanOrEqual(2);

    // All six evidence records, three projects and three contact paths survive.
    await expect(page.locator(".evidence-ledger > li")).toHaveCount(6);
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    // The project names are display type, not the browser's default for their
    // heading level. They are an h3 again, so the rule has to name the h3: the
    // level was demoted back from h2, and a rule left on the h2 would silently
    // drop them to a default and still pass every layout check here.
    for (const size of await page
      .locator(".work-index h3")
      .evaluateAll((els) =>
        els.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
      )) {
      expect(size).toBeGreaterThanOrEqual(28);
    }
    await expect(page.locator("#contact-path a")).toHaveCount(3);
  });
}
test.describe("Writing", () => {
  test("reads the newest entries as a feed with a plate for each", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const section = page.locator("#writing");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(
      "Latest writing.",
    );

    // The feed is driven by whatever is published, so the assertion is about the
    // relationship between the list and the plates, not about one article.
    const rows = section.locator(".writing-row");
    const plates = section.locator(".writing-plate");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(plates).toHaveCount(count);

    // Each row is a real route to its writeup, and the first entry is the
    // one the plate opens on.
    for (const row of await rows.all()) {
      expect(await row.getAttribute("href")).toMatch(/^\/writing\/[a-z0-9-]+$/);
    }
    await expect(section.locator(".writing-row[data-active]")).toHaveCount(1);
    await expect(section.locator(".writing-plate[data-active]")).toHaveCount(1);
    await expect(section.locator(".writing-plate img").first()).toHaveAttribute(
      "src",
      /^\/images\/writing\/.+\.webp$/,
    );

    // The plate is decoration; the feed carries the content.
    await expect(section.locator(".writing-plate-frame")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(section.getByRole("link", { name: /All writing/ })).toHaveAttribute(
      "href",
      "/writing",
    );
  });

  test("swaps the plate to the entry a visitor is on, by hover and by focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#writing")?.scrollIntoView();
    });
    await expect(page.locator(".writing-plate").first()).toHaveCSS("opacity", "1");

    const rows = page.locator(".writing-row");
    if ((await rows.count()) > 1) {
      // A real second entry: pointing at it brings its plate forward.
      await rows.nth(1).hover();
      await expect(page.locator(".writing-plate").nth(1)).toHaveCSS("opacity", "1");
      await expect(page.locator(".writing-plate").first()).toHaveCSS("opacity", "0");
    }

    // Keyboard focus drives the same state, so the plate is not mouse-only.
    await page.mouse.move(2, 2);
    await rows.first().focus();
    await expect(page.locator(".writing-plate").first()).toHaveCSS("opacity", "1");
    await expect(page.locator(".writing-row[data-active]")).toHaveCount(1);
  });

  test("serves the index and the writeup, and returns to the home sections", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/writing");

    await expect(page).toHaveTitle("Writing — Fikri Muhammad Abdillah");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Writeups, kept in the open.",
    );
    // One published writeup, with its five challenges listed as its contents.
    await expect(page.locator(".writing-index-feature")).toHaveCount(1);
    await expect(page.locator(".writing-index-thumb img")).toHaveAttribute(
      "src",
      /^\/images\/writing\/.+\.webp$/,
    );
    await expect(page.locator(".writing-chapters .writing-chapter")).toHaveCount(5);

    // Writing is the current page, and the other links return to the one-page
    // document's own sections rather than pretending to be routes.
    const nav = page.locator(".site-nav");
    await expect(
      nav.getByRole("link", { name: "Writing", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Profile", exact: true }),
    ).toHaveAttribute("href", "/#technical-profile");

    await page.locator(".writing-index-feature").click();
    await expect(page).toHaveURL(/\/writing\/tcp1p-international-2024$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Writeup RE TCP1P International 2024",
    );
    await expect(page.locator(".challenge")).toHaveCount(5);
    await expect(page.locator(".challenge h3").first()).toHaveText("Rev / Serial");
    // Each challenge links to its own full post on Medium.
    for (const link of await page.locator(".challenge .text-link").all()) {
      expect(await link.getAttribute("href")).toMatch(
        /^https:\/\/medium\.com\/@f12345ff67\//,
      );
    }

    // A chapter deep link lands clear of the fixed header.
    await page.goto("/writing/tcp1p-international-2024#wannaflag");
    const header = await page.locator(".site-header").boundingBox();
    const chapter = await page.locator("#wannaflag").boundingBox();
    expect(chapter?.y).toBeGreaterThanOrEqual(
      (header?.y ?? 0) + (header?.height ?? 0) - 1,
    );

    // A document page never stages the opening's loader.
    await expect(page.locator("#loading-screen")).toHaveCount(0);
  });
});

test.describe("Writing images", () => {
  test("frames a light image and a dark image differently, from the pixels", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/writing/tcp1p-international-2024");

    // The cover is part of the article, not a background: it has alt text and a
    // caption, so it carries meaning rather than decorating.
    const cover = page.locator(".article-cover");
    await expect(cover).toBeVisible();
    await expect(cover.locator("img")).toHaveAttribute("alt", /.+/);
    await expect(cover.locator("figcaption")).not.toBeEmpty();
    // Its tone was read from the image itself.
    await expect(cover).toHaveAttribute("data-tone", /^(light|dark)$/);

    // The two tones are genuinely different frames, not the same rule twice.
    const frame = await page.evaluate(() => {
      const read = (tone: "light" | "dark") => {
        const figure = document.createElement("figure");
        figure.className = "article-figure";
        figure.dataset.tone = tone;
        document.body.append(figure);
        const style = getComputedStyle(figure);
        const box = { border: style.borderTopColor, shadow: style.boxShadow };
        figure.remove();
        return box;
      };
      return { light: read("light"), dark: read("dark") };
    });
    expect(frame.light.border).not.toBe(frame.dark.border);
    expect(frame.light.shadow).not.toBe(frame.dark.shadow);
  });

  test("classifies luminance per channel, so a saturated image is not called light", async () => {
    const { toneOf } = await import("../src/lib/imageTone");
    const pixels = (...rgb: number[]) => {
      const data: number[] = [];
      for (let index = 0; index < 64; index += 1) data.push(...rgb, 255);
      return data;
    };

    expect(toneOf(pixels(247, 247, 249))).toBe("light"); // a white tool window
    expect(toneOf(pixels(12, 10, 18))).toBe("dark"); // a terminal
    // Mid violet: 124, 92, 250. The channel mean is 155/255, which would pass a
    // naive threshold; its perceived luminance is 0.39, which must not.
    expect(toneOf(pixels(124, 92, 250))).toBe("dark");
    expect(toneOf([])).toBe("dark");
  });
});
