import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    /** Frames recorded by the reading-position regression, from inside the page. */
    __reading: {
      t: number;
      reserved: boolean;
      top: number;
      y: number;
      height: number;
    }[];
    /** Frames recorded by the reserved-geometry regression. */
    __geometry: {
      t: number;
      reserved: boolean;
      fonts: string;
      docH: number;
      workTop: number;
      profileTop: number;
      archiveTop: number;
      stage: string;
      inline: string;
    }[];
  }
}

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
    // Each record keeps its own copy, its technology labels and its source links,
    // and carries no scope note: the notes that used to restate a disclaimer under
    // every Work record are gone, while the qualifications that belong to the
    // Profile ledger and the Archive stay.
    await expect(page.locator(".work-index .project-copy")).toHaveCount(3);
    await expect(page.locator(".work-index .project-structure span")).toHaveCount(15);
    await expect(page.locator(".work-index .scope-note")).toHaveCount(0);
    await expect(page.locator("#learning-archive .scope-note")).toHaveText(
      "Learning material, not professional security experience.",
    );
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
    // Both hover sizes expose the complete content; scrolling only brings it
    // into view and does not need to complete a reveal first.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.locator(".contact-surface")).toHaveCSS("clip-path", "none");

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
      /*
        The ring has to read against the surface actually painted behind it. That
        is the violet band inside the section, not the section itself: the section
        is deliberately transparent, because its own box is what the scroll-driven
        scale measures. Sampling the section would compare the ring with the page
        background and would pass on a band that was never painted.
      */
      let painted: Element | null = el;
      while (
        painted &&
        getComputedStyle(painted).backgroundColor === "rgba(0, 0, 0, 0)"
      ) {
        painted = painted.parentElement;
      }
      const surfaceColor = getComputedStyle(painted!).backgroundColor;
      const surface = luminance(surfaceColor);
      const outline = luminance(style.outlineColor);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
        surfaceColor,
        ratio:
          (Math.max(outline, surface) + 0.05) /
          (Math.min(outline, surface) + 0.05),
      };
    });

    // An accent-coloured ring would be invisible on the violet band.
    expect(ring.style, `link ${index}`).toBe("solid");
    expect(ring.width, `link ${index}`).toBe("2px");
    // The sampled surface really is the violet band, not an unpainted parent.
    expect(ring.surfaceColor, `link ${index}`).toBe("rgb(167, 139, 250)");
    expect(ring.ratio, `link ${index} ring=${ring.color}`).toBeGreaterThanOrEqual(
      3,
    );
  }
});

test("centers each technology pill's label in its own pill", async ({ page }) => {
  /*
    A Work record reserves a minimum height, so it is taller than its content. That
    spare space used to be absorbed by the record's own grid rows, and the flex
    items inside a stretched row — the technology pills — inherited the extra
    height: at 1440px a pill measured 42.56px with its label 7.19px above the
    centre of the box it was centred in. The rows now pack at their intrinsic size,
    so each pill is exactly as tall as the one line of text it holds.
  */
  for (const [width, height] of [
    [1920, 1200],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    const pills = await page
      .locator(".project-structure span")
      .evaluateAll((spans) =>
        spans.map((span) => {
          const box = span.getBoundingClientRect();
          const style = getComputedStyle(span);
          const range = document.createRange();
          range.selectNodeContents(span);
          const ink = range.getBoundingClientRect();
          return {
            label: span.textContent ?? "",
            // The box the label is actually laid out in, once the pill's own
            // padding and border are taken back out.
            contentBox:
              box.height -
              Number.parseFloat(style.paddingTop) -
              Number.parseFloat(style.paddingBottom) -
              Number.parseFloat(style.borderTopWidth) -
              Number.parseFloat(style.borderBottomWidth),
            lineHeight: Number.parseFloat(style.lineHeight),
            inkOffset: Math.abs(
              ink.top + ink.height / 2 - (box.top + box.height / 2),
            ),
          };
        }),
      );

    // Every label of every record, so a single fixed pill cannot pass for all of
    // them.
    expect(pills.length, `${width}px`).toBe(15);
    for (const pill of pills) {
      expect(pill.label.length, `${width}px`).toBeGreaterThan(0);
      // One line of text, no stretch.
      expect(pill.contentBox, `${width}px ${pill.label}`).toBeCloseTo(
        pill.lineHeight,
        1,
      );
      // ...and the label reads in the middle of the pill rather than at its top.
      expect(pill.inkOffset, `${width}px ${pill.label}`).toBeLessThan(3);
    }
  }
});

test.describe("Contact's directional focus expansion", () => {
  /**
   * Everything the contract is stated over, in one round trip.
   *
   * Document-relative positions are used for the geometry that must not move, so the
   * comparison is between layouts rather than between scroll positions.
   */
  const bandState = (page: Page) =>
    page.evaluate(() => {
      const section = document.querySelector("#contact-path")!;
      const surface = document.querySelector<HTMLElement>(".contact-surface")!;
      const footer = document.querySelector(".site-footer")!;
      const heading = document.querySelector("#contact-path-heading")!;
      const style = getComputedStyle(surface);
      const sectionBox = section.getBoundingClientRect();
      const surfaceBox = surface.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      return {
        clipPath: style.clipPath,
        transform: style.transform,
        sectionTop: sectionBox.top,
        sectionBottom: sectionBox.bottom,
        midpoint: sectionBox.top + sectionBox.height / 2,
        scrollY: window.scrollY,
        sectionDocTop: sectionBox.top + window.scrollY,
        sectionWidth: sectionBox.width,
        sectionHeight: sectionBox.height,
        surfaceWidth: surfaceBox.width,
        surfaceHeight: surfaceBox.height,
        docHeight: document.documentElement.scrollHeight,
        footerDocTop: footerBox.top + window.scrollY,
        footerGap: footerBox.top - surfaceBox.bottom,
        headerBottom: document.querySelector(".site-header")!.getBoundingClientRect().bottom,
        headingWidth: headingBox.width,
        headingHeight: headingBox.height,
        headingTop: headingBox.top,
        headingFontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        viewport: window.innerHeight,
        links: [
          ...document.querySelectorAll<HTMLElement>("#contact-path a"),
        ].map((link) => {
          const box = link.getBoundingClientRect();
          const linkStyle = getComputedStyle(link);
          return {
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
            display: linkStyle.display,
            visibility: linkStyle.visibility,
            pointerEvents: linkStyle.pointerEvents,
          };
        }),
      };
    });

  /** Deliver native scroll before advancing the controller's frozen frame. */
  const scrollSectionTop = async (page: Page, top: number) => {
    const delivery = await page.evaluateHandle((offset) => {
      document.documentElement.style.scrollBehavior = "auto";
      const section = document.querySelector("#contact-path")!;
      let resolve!: () => void;
      const scrolled = new Promise<void>((done) => { resolve = done; });
      const finish = () => {
        window.removeEventListener("scroll", finish);
        resolve();
      };
      window.addEventListener("scroll", finish, { once: true });
      const before = window.scrollY;
      window.scrollTo(
        0,
        section.getBoundingClientRect().top + window.scrollY - offset,
      );
      if (window.scrollY === before) finish();
      return { scrolled };
    }, top);
    try {
      await delivery.evaluate(({ scrolled }) => scrolled);
    } finally {
      await delivery.dispose();
    }
  };

  /** Enter the real painted box, without locator scrolling changing the fixture. */
  const enterBand = async (page: Page) => {
    const state = await bandState(page);
    await page.mouse.move(
      state.surfaceWidth / 2,
      Math.max(state.headerBottom + 20, Math.min(state.viewport - 120, state.sectionTop + state.surfaceHeight / 2)),
    );
  };

  const heightOf = async (page: Page) => (await bandState(page)).surfaceHeight;

  const expectHeight = (page: Page, height: number) =>
    expect.poll(async () => {
      await page.clock.fastForward(80);
      return await heightOf(page);
    }, { intervals: [32] }).toBeCloseTo(height, 3);

  /** Keep frames under test control, after both modules have arrived. */
  const freezeContact = async (page: Page) => {
    await page.mouse.move(0, 0);
    await freezeForHydration(page);
    await expect
      .poll(
        () => page.evaluate(() =>
          Boolean(window.__afterHoursMotionReady && window.__workPreviewReady),
        ),
        {
          timeout: 20_000,
          message: "the islands hydrated before Contact's clock advances",
        },
      )
      .toBe(true);
    await page.clock.fastForward(2_500);
  };

  /** Position the entry boundary using the compact box, not an animated height. */
  const scrollVisible = (page: Page, compact: number, fraction: number) =>
    scrollSectionTop(page, page.viewportSize()!.height - compact * fraction);

  /** Position the compact focus box against the edge held during this visit. */
  const scrollCenter = async (page: Page, fraction: number, compact?: number, edge: "top" | "bottom" = "bottom") => {
    const height = await heightOf(page);
    const compactHeight = compact ?? height;
    const extra = edge === "bottom" ? height - compactHeight : 0;
    await scrollSectionTop(page, page.viewportSize()!.height * fraction - compactHeight / 2 - extra);
  };

  /** An automatic transition must paint intermediate sizes without more scroll. */
  const expectIntermediate = async (page: Page, from: number, to: number, anchor?: { edge: "sectionTop" | "sectionBottom"; position: number }) => {
    let height = from;
    await expect.poll(async () => {
      await page.clock.fastForward(32);
      const state = await bandState(page);
      height = state.surfaceHeight;
      expect(state.footerGap, "the footer follows every intermediate size").toBeCloseTo(0, 1);
      expect(state.sectionHeight, "no reserved outer height").toBeCloseTo(height, 1);
      expect(state.clipPath, "this changes size, not clipping").toBe("none");
      if (anchor) {
        expect(Math.abs(state[anchor.edge] - anchor.position), "the opposite edge stays in place throughout the transition").toBeLessThan(0.6);
      }
      return height > Math.min(from, to) && height < Math.max(from, to);
    }, { intervals: [32] }).toBe(true);
    return height;
  };

  for (const [width, height, entry] of [
    [1440, 900, "above"],
    [1366, 768, "above"],
    [1440, 900, "below"],
    [1366, 768, "below"],
  ] as const) {
    test(`waits for full visibility and focus, then opens from ${entry} and reverses on closing at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      try {
        await freezeContact(page);
        const initial = await bandState(page);
        await scrollSectionTop(page, height - 40);
        await page.clock.fastForward(800);
        expect(await heightOf(page), "partial scroll entry cannot expand it").toBe(initial.surfaceHeight);
        for (const fraction of [0.85, 0.995]) {
          await scrollVisible(page, initial.surfaceHeight, fraction);
          await page.clock.fastForward(800);
          const partial = await bandState(page);
          expect(partial.sectionBottom, "some of the compact box is still outside the viewport").toBeGreaterThan(height);
          expect(partial.surfaceHeight, `${fraction * 100}% visibility cannot trigger expansion`).toBe(initial.surfaceHeight);
        }
        await scrollCenter(page, 0.68);
        await page.clock.fastForward(800);
        const visible = await bandState(page);
        expect(visible.sectionTop).toBeGreaterThanOrEqual(visible.headerBottom);
        expect(visible.sectionBottom, "100% visible, but not yet centered").toBeLessThanOrEqual(height);
        expect(visible.surfaceHeight, "full visibility alone is not the focus trigger").toBe(initial.surfaceHeight);
        await scrollCenter(page, 0.655);
        await page.clock.fastForward(800);
        const compact = await bandState(page);
        expect(compact.surfaceHeight, "the midpoint has not reached the 65% focus boundary").toBe(initial.surfaceHeight);
        expect((compact.sectionTop + compact.sectionHeight / 2) / height).toBeGreaterThan(0.65);
        expect(compact.footerGap).toBeCloseTo(0, 1);
        expect(compact.clipPath).toBe("none");
        expect(compact.links).toHaveLength(3);
        for (const link of compact.links) {
          expect(link.height).toBeGreaterThanOrEqual(44);
          expect(link.visibility).not.toBe("hidden");
          expect(link.display).not.toBe("none");
          expect(link.pointerEvents).not.toBe("none");
        }

        // Pointer entry, of any kind, no longer chooses the size.
        await enterBand(page);
        for (const pointerType of ["mouse", "touch", "pen"]) {
          await page.locator("#contact-path").dispatchEvent("pointerenter", { pointerType });
          await page.clock.fastForward(600);
          expect(await heightOf(page), pointerType).toBe(compact.surfaceHeight);
        }
        await page.mouse.move(0, 0);
        let lowerScrollY = 0;
        if (entry === "below") {
          // Native scroll can reverse before the next controller frame. Move
          // below the final entry point with JS frames still paused, then come
          // back up; only that final approach may choose the expanding edge.
          await scrollCenter(page, 0.642);
          lowerScrollY = (await bandState(page)).scrollY;
        }
        await scrollCenter(page, 0.648);
        const triggered = await bandState(page);
        if (entry === "below") expect(triggered.scrollY).toBeLessThan(lowerScrollY);
        else expect(triggered.scrollY).toBeGreaterThan(compact.scrollY);
        expect(triggered.sectionTop).toBeGreaterThanOrEqual(triggered.headerBottom);
        expect(triggered.sectionTop + compact.surfaceHeight).toBeLessThanOrEqual(height);
        const midpoint = (triggered.sectionTop + compact.surfaceHeight / 2) / height;
        expect(midpoint, "the compact midpoint really entered the focus zone").toBeGreaterThanOrEqual(0.45);
        expect(midpoint).toBeLessThanOrEqual(0.65);
        const edge = entry === "above" ? "sectionBottom" : "sectionTop";
        await expectIntermediate(page, compact.surfaceHeight, compact.surfaceHeight + 224, { edge, position: triggered[edge] });
        // No second scroll, mouse movement or changing progress value: elapsed
        // time alone must carry the first triggered animation to its full height.
        await expectHeight(page, compact.surfaceHeight + 224);
        const expanded = await bandState(page);
        const growth = expanded.surfaceHeight - compact.surfaceHeight;
        expect(Math.abs(triggered.sectionTop - expanded.sectionTop - (entry === "above" ? growth : 0)), "all upward growth comes from the top edge").toBeLessThan(0.6);
        expect(Math.abs(expanded.sectionBottom - triggered.sectionBottom - (entry === "below" ? growth : 0)), "all downward growth comes from the bottom edge").toBeLessThan(0.6);
        expect(Math.abs(expanded.headingTop - triggered.headingTop - (entry === "above" ? -growth / 2 : growth / 2)), "content stays naturally centered without scaling").toBeLessThan(0.6);
        expect(expanded.surfaceHeight, "a clearly taller focus band").toBeGreaterThanOrEqual(height * 0.7);
        expect(expanded.sectionHeight, "the section grows, not a reserved clip").toBe(expanded.surfaceHeight);
        expect(expanded.footerGap).toBeCloseTo(0, 1);
        expect(expanded.footerDocTop - compact.footerDocTop).toBeCloseTo(growth, 1);
        expect(Math.abs(expanded.docHeight - compact.docHeight - growth)).toBeLessThanOrEqual(1);
        expect(expanded.sectionDocTop, "no overlap with the section above").toBeCloseTo(compact.sectionDocTop, 1);
        expect(expanded.surfaceWidth).toBe(compact.surfaceWidth);
        expect(expanded.surfaceWidth).toBeCloseTo(expanded.sectionWidth, 1);
        expect(expanded.headingWidth).toBe(compact.headingWidth);
        expect(expanded.headingHeight).toBeCloseTo(compact.headingHeight, 3);
        expect(expanded.headingFontSize).toBe(compact.headingFontSize);
        expect(expanded.transform).toBe("none");
        expect(expanded.clipPath).toBe("none");
        expanded.links.forEach((link, index) => {
          expect(link.width).toBeCloseTo(compact.links[index].width, 3);
          expect(link.height).toBeCloseTo(compact.links[index].height, 3);
        });

        await enterBand(page);
        await page.mouse.move(0, 0);
        await page.clock.fastForward(1200);
        expect(await heightOf(page), "growth itself and mouse exit cannot close the band").toBe(expanded.surfaceHeight);
        await scrollSectionTop(page, -height);
        await page.clock.fastForward(1200);
        expect(await heightOf(page), "passing the focus zone toward the footer keeps it open").toBe(expanded.surfaceHeight);
        expect((await bandState(page)).footerGap).toBeCloseTo(0, 1);
        await scrollCenter(page, 0.655, compact.surfaceHeight, entry === "above" ? "bottom" : "top");
        const closing = await bandState(page);
        await expectIntermediate(page, expanded.surfaceHeight, compact.surfaceHeight, { edge, position: closing[edge] });
        await expectHeight(page, compact.surfaceHeight);
        const closed = await bandState(page);
        expect(Math.abs(closed.sectionTop - closing.sectionTop - (entry === "above" ? growth : 0)), "closing reverses upward expansion").toBeLessThan(0.6);
        expect(Math.abs(closing.sectionBottom - closed.sectionBottom - (entry === "below" ? growth : 0)), "closing reverses downward expansion").toBeLessThan(0.6);
        expect(Math.abs(closed[edge] - closing[edge])).toBeLessThan(0.6);
        expect(closed.footerGap).toBeCloseTo(0, 1);
      } finally {
        await page.clock.resume();
      }
    });
  }

  test("finishes a triggered expansion before honoring a reversed scroll and can trigger again", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      await freezeContact(page);
      const compact = await heightOf(page);
      const full = compact + 224;
      await scrollCenter(page, 0.648);
      const opening = await expectIntermediate(page, compact, full);
      await scrollCenter(page, 0.68, compact);
      const reversed = await bandState(page);
      await page.clock.fastForward(32);
      expect(await heightOf(page), "crossing back cannot interrupt the opening").toBeGreaterThan(opening);
      let peak = 0;
      for (let elapsed = 0; elapsed < 900; elapsed += 40) {
        await page.clock.fastForward(40);
        const current = await bandState(page);
        peak = Math.max(peak, current.surfaceHeight);
        expect(current.footerGap).toBeCloseTo(0, 1);
        expect(Math.abs(current.sectionBottom - reversed.sectionBottom), "the held edge preserves the visitor's own scroll change").toBeLessThan(0.6);
      }
      expect(peak, "the opening reaches full height before the queued contraction").toBeGreaterThan(full - 2);
      await expectHeight(page, compact);
      await scrollCenter(page, 0.648);
      await expectIntermediate(page, compact, full);
      await expectHeight(page, full);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expectHeight(page, full);
    } finally {
      await page.clock.resume();
    }
  });

  test("runs to completion after a real wheel crossing in either direction without hover", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady && window.__workPreviewReady);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    const compact = await heightOf(page);
    await scrollCenter(page, 0.655);
    await page.mouse.move(720, 880);
    expect(await heightOf(page), "a resting mouse cannot expand it").toBe(compact);
    await page.mouse.wheel(0, 20);
    // The wheel stops here. A scrub would remain near its starting size.
    await expect.poll(() => heightOf(page)).toBeCloseTo(compact + 224, 1);
    await page.mouse.wheel(0, -20);
    await expect.poll(() => heightOf(page)).toBeCloseTo(compact, 1);
  });

  test("honors native section navigation, including an unchanged fragment, during expansion", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      await freezeContact(page);
      const compact = await heightOf(page);
      // The URL can still name Work after scrolling down manually. Clicking its
      // link again must work without relying on a hashchange event.
      await page.evaluate(() => history.replaceState(null, "", "#selected-evidence"));
      await scrollCenter(page, 0.648);
      await expectIntermediate(page, compact, compact + 224);
      const expected = await page.evaluate(() => {
        // Geometry fixtures use instant scrolling; restore the product's native
        // smooth anchor behavior before exercising the navigation itself.
        document.documentElement.style.removeProperty("scroll-behavior");
        return Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) +
          Number.parseFloat(getComputedStyle(document.querySelector("#selected-evidence")!).scrollMarginTop);
      });
      await page.locator('.site-nav a[href="#selected-evidence"]').evaluate((link: HTMLAnchorElement) => link.click());
      await page.clock.resume();
      await expect.poll(() => page.locator("#selected-evidence").evaluate((section) =>
        section.getBoundingClientRect().top,
      ), { message: "Contact's scroll compensation must not cancel native section navigation" }).toBeCloseTo(expected, 0);

      const contactLanding = await page.locator("#contact-path").evaluate((section) =>
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) +
          Number.parseFloat(getComputedStyle(section).scrollMarginTop),
      );
      await page.locator('.site-nav a[href="#contact-path"]').evaluate((link: HTMLAnchorElement) => link.click());
      await expect.poll(() => page.locator("#contact-path").evaluate((section) =>
        section.getBoundingClientRect().top,
      ), { message: "Contact must be full before native navigation calculates its end-of-document limit" }).toBeCloseTo(contactLanding, 0);
    } finally {
      await page.clock.resume();
    }
  });

  test("replaces an in-flight expansion with static reduced motion and restores centered focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      await freezeContact(page);
      const compact = await heightOf(page);
      await scrollCenter(page, 0.648);
      await expectIntermediate(page, compact, compact + 224);
      for (const reducedMotion of ["reduce", "no-preference"] as const) {
        // The media query's native delivery is not a fake animation frame. Await
        // that event without spending the rest of the reveal's controlled time.
        const delivery = await page.evaluateHandle(() => ({
          changed: new Promise<void>((resolve) => {
            window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
              "change",
              () => resolve(),
              { once: true },
            );
          }),
        }));
        try {
          await page.emulateMedia({ reducedMotion });
          await delivery.evaluate(({ changed }) => changed);
          if (reducedMotion === "reduce") {
            expect(await heightOf(page), "reduced motion immediately restores the full box").toBeCloseTo(compact + 224, 1);
            await scrollSectionTop(page, 860);
            await page.clock.fastForward(800);
            expect(await heightOf(page), "scroll cannot shrink the static band").toBeCloseTo(compact + 224, 1);
          } else {
            // Other sections also restore their scroll layouts. Re-establish
            // the below-trigger position rather than assuming their resize left
            // this section at the reduced-motion offset.
            await scrollCenter(page, 0.68);
            await expectHeight(page, compact);
          }
        } finally {
          await delivery.dispose();
        }
      }
      await scrollCenter(page, 0.648);
      await expectIntermediate(page, compact, compact + 224);
      await expectHeight(page, compact + 224);
    } finally {
      await page.clock.resume();
    }
  });

  test("keeps direct Contact entry full and responds to centered focus without pointer movement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#contact-path");
    await page.waitForFunction(() => window.__afterHoursMotionReady && window.__workPreviewReady);
    await page.evaluate(() => document.fonts.ready);
    // Keep native fragment landing and the subsequent animations on one real
    // rendering clock instead of switching to a mocked clock after loading.
    await page.evaluate(() => new Promise<void>((resolve) => {
      let position = window.scrollY;
      let height = 0;
      let since = performance.now();
      const landed = () => {
        const box = document.querySelector("#contact-path")!.getBoundingClientRect();
        if (window.scrollY !== position || Math.abs(box.height - height) > 0.01) {
          position = window.scrollY;
          height = box.height;
          since = performance.now();
        }
        if (box.top < window.innerHeight && performance.now() - since >= 160) resolve();
        else requestAnimationFrame(landed);
      };
      requestAnimationFrame(landed);
    }));
    const direct = await bandState(page);
    expect(direct.sectionTop).toBeGreaterThanOrEqual(direct.headerBottom);
    expect(direct.surfaceHeight).toBeGreaterThanOrEqual(900 * 0.7);
    expect(direct.links).toHaveLength(3);
    expect(direct.footerGap).toBeCloseTo(0, 1);
    await enterBand(page);
    await page.mouse.move(0, 0);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    expect(await heightOf(page), "hover does not take ownership after a fragment landing").toBeCloseTo(direct.surfaceHeight, 3);
    const compact = direct.surfaceHeight - 224;
    await scrollCenter(page, 0.68, compact, "top");
    await expect.poll(() => heightOf(page)).toBeCloseTo(compact, 3);
    await scrollCenter(page, 0.648);
    await expect.poll(() => heightOf(page)).toBeCloseTo(direct.surfaceHeight, 3);
  });

  test("keeps an already fully visible band full when the module arrives late", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const releasePageModule = await gatePageModule(page);
    try {
      await freezeForHydration(page);
      expect(
        await page.evaluate(() => Boolean(window.__afterHoursMotionReady)),
        "the page module is genuinely absent before the gate opens",
      ).toBe(false);
      await scrollSectionTop(page, 100);
      const painted = await bandState(page);
      expect(painted.surfaceHeight).toBeGreaterThanOrEqual(900 * 0.7);
      expect(painted.clipPath).toBe("none");

      releasePageModule();
      await expect.poll(() => page.evaluate(() => Boolean(window.__afterHoursMotionReady))).toBe(true);
      const afterInit = await bandState(page);
      expect(afterInit.surfaceHeight, "no close/reopen entrance in an already visible band").toBe(painted.surfaceHeight);
      expect(afterInit.footerGap).toBeCloseTo(0, 1);
      expect(afterInit.headingHeight).toBeCloseTo(painted.headingHeight, 1);
      await scrollCenter(page, 0.68);
      await expectIntermediate(page, painted.surfaceHeight, painted.surfaceHeight - 224);
      await expectHeight(page, painted.surfaceHeight - 224);
      await scrollCenter(page, 0.648);
      await expectHeight(page, painted.surfaceHeight);
    } finally {
      releasePageModule();
      await page.clock.resume();
    }
  });

  test("leaves the band complete without the module, and under reduced motion from the start", async ({
    page,
  }) => {
    /*
      Two ways the module does not run its reveal, both of which have to leave an
      ordinary complete band: the chunk never arrives, and the preference is already
      set when the page loads.
    */
    await page.route(/Portfolio\.astro_astro_type_script/, (route) => route.abort());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(600);

    await scrollSectionTop(page, 0);
    const noModule = await bandState(page);
    expect(noModule.clipPath).toBe("none");
    expect(noModule.surfaceHeight).toBeGreaterThanOrEqual(900 * 0.7);
    expect(noModule.footerGap).toBeCloseTo(0, 1);
    expect(
      await page
        .locator(".contact-surface")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(167, 139, 250)");
    expect(noModule.links.length).toBe(3);

    await page.unroute(/Portfolio\.astro_astro_type_script/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(600);
    await scrollSectionTop(page, 0);
    const reduced = await bandState(page);
    expect(reduced.clipPath).toBe("none");
    expect(reduced.surfaceHeight).toBeGreaterThanOrEqual(900 * 0.7);
    expect(reduced.footerGap).toBeCloseTo(0, 1);
    expect(reduced.links.length).toBe(3);
    await enterBand(page);
    await scrollSectionTop(page, 860);
    await page.waitForTimeout(600);
    expect(await heightOf(page), "reduced motion has no scroll expansion").toBe(reduced.surfaceHeight);
  });

  test("keeps mobile static and cancels desktop expansion at the layout breakpoint", async ({
    page,
  }) => {
    // Cover a mobile first load as well as live layout changes; there is no reason
    // to initialize the unrelated desktop opening before checking mobile sizing.
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await freezeContact(page);
      for (const [width, height] of [[390, 844], [320, 640], [1100, 768]]) {
        await page.mouse.move(0, 0);
        await page.setViewportSize({ width, height });
        await scrollSectionTop(page, 100);
        const mobile = await bandState(page);
        await enterBand(page);
        await scrollSectionTop(page, height - 40);
        await page.clock.fastForward(800);
        expect(await heightOf(page), `${width}px scroll and mouse entry cannot resize mobile`).toBe(mobile.surfaceHeight);
        await page.mouse.move(0, 0);
        await scrollSectionTop(page, 0);
        await page.clock.fastForward(800);
        expect(await heightOf(page), `${width}px return scroll cannot resize mobile`).toBe(mobile.surfaceHeight);
        expect(mobile.clipPath).toBe("none");
        expect(mobile.footerGap).toBeCloseTo(0, 1);
        expect(mobile.surfaceWidth).toBeCloseTo(width, 1);
        expect(mobile.links).toHaveLength(3);
        for (const link of mobile.links) {
          expect(link.height).toBeGreaterThanOrEqual(44);
          expect(link.visibility).not.toBe("hidden");
          expect(link.display).not.toBe("none");
          expect(link.pointerEvents).not.toBe("none");
          expect(link.left).toBeGreaterThanOrEqual(0);
          expect(link.right).toBeLessThanOrEqual(width);
        }
      }

      await page.setViewportSize({ width: 1101, height: 768 });
      await scrollSectionTop(page, 728);
      await page.clock.fastForward(80);
      const desktop = await heightOf(page);
      await scrollCenter(page, 0.648);
      await expectIntermediate(page, desktop, desktop + 224);
      await page.setViewportSize({ width: 1100, height: 768 });
      const mobile = await bandState(page);
      await page.clock.fastForward(800);
      expect(await heightOf(page), "queued desktop work cannot resize mobile").toBe(mobile.surfaceHeight);
      expect(mobile.footerGap).toBeCloseTo(0, 1);
    } finally {
      await page.clock.resume();
    }
  });
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

    // Static sections keep their substantial rhythm. Contact's compact/expanded
    // spacing is covered separately by its hover contract.
    for (const selector of [
      "#intro",
      "#selected-evidence",
      "#learning-archive",
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
      const layout = await page.evaluate(() => {
        const box = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const paths = box(".contact-paths");
        const intro = box(".contact-intro-block");
        const content = document.querySelector(".contact-layout")!;
        const surface = document.querySelector(".contact-surface")!;
        const style = getComputedStyle(surface);
        const available = surface.getBoundingClientRect().width -
          Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
        const maximum = Number.parseFloat(getComputedStyle(content).maxWidth);
        return {
          delta: Math.abs(paths.top + paths.height / 2 - (intro.top + intro.height / 2)),
          width: content.getBoundingClientRect().width,
          expectedWidth: Math.min(available, Number.isFinite(maximum) ? maximum : available),
        };
      });
      expect(layout.delta, `${width}px`).toBeLessThan(8);
      // A centered, max-width child of the taller band must not shrink-wrap to
      // its text at the wide breakpoint, leaving the paths stranded in the middle.
      expect(layout.width, `${width}px fills the available content measure`).toBeCloseTo(
        layout.expectedWidth,
        1,
      );
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

  for (const width of [1440, 390]) {
    test(`keeps the header translucent and borderless at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      const header = page.locator(".site-header");

      // The backing must survive entry, body content, and returning to the top;
      // neither a missing nor a fully opaque background satisfies this contract.
      for (const id of ["identity", "technical-profile", "identity"]) {
        await page.evaluate((sectionId) => {
          document.documentElement.style.scrollBehavior = "auto";
          const section = document.getElementById(sectionId)!;
          window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY);
        }, id);
        const painted = await header.evaluate((el) => {
          const style = getComputedStyle(el);
          const background = style.backgroundColor;
          // CSSOM can serialize color-mix as color(srgb ... / alpha) or rgba().
          const alpha = /\/\s*([\d.]+)\s*\)$/.exec(background) ??
            /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/.exec(background);
          return {
            alpha: alpha ? Number(alpha[1]) : 1,
            backdrop: style.backdropFilter,
            borderBottomWidth: style.borderBottomWidth,
            borderBottomStyle: style.borderBottomStyle,
          };
        });

        expect(painted.alpha, `${id}: a visible backing`).toBeGreaterThan(0);
        expect(painted.alpha, `${id}: still semi-transparent`).toBeLessThan(1);
        expect(painted.backdrop, `${id}: retain the blur`).toContain("blur(");
        expect(
          painted.borderBottomWidth === "0px" || painted.borderBottomStyle === "none",
          `${id}: no bottom lane rule`,
        ).toBe(true);
      }
    });
  }
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

/*
  The pinned-path fixtures.
  ---------------------------------------------------------------------------
  Work's editorial preview reserves its geometry before paint and is released
  after a 2000ms hold if its module has not confirmed itself. That hold is a race
  the section is designed to lose gracefully — a slow module gets the readable
  in-flow layout for that visit, permanently — but a test that needs the *pinned*
  layout cannot leave winning that race to how fast a shared, two-CPU runner
  happens to hydrate four islands. In a combined run it does not: Work's island is
  requested last, around 824ms in, leaving it roughly a second to hydrate.

  These fixtures remove the race without touching the production policy. The clock
  is frozen before navigation, so the hold cannot expire while the islands hydrate;
  it is then advanced deliberately, with the module ready, which is the branch that
  keeps the reservation. Every assertion the tests make stays a real one, against
  the real controller and the real DOM.
*/

/**
 * Hold a module's chunk behind an explicit gate, released by the caller.
 *
 * This follows this file's existing page.route convention for a held module, with
 * one difference: the release is a promise the caller resolves rather than a fixed
 * delay. A delay can expire during hydration setup — which is exactly the race
 * these fixtures exist to remove — so a gate that only opens when the caller says
 * so is what makes "still absent" a fact the test can assert.
 */
const gateModule = async (page: Page, pattern: RegExp) => {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    await opened;
    await route.continue();
  });
  return release;
};

/** The page-reveal module's own chunk, which the header script's hold watches. */
const gatePageModule = (page: Page) => gateModule(page, /Portfolio\.astro_astro_type_script/);

/** The Work section's island chunk, which owns the reservation. */
const gateWorkModule = (page: Page) => gateModule(page, /WorkShowcase\./);

/**
 * Freeze the page's clock and load the document, so the hold cannot expire while
 * the islands hydrate.
 *
 * The clock is paused *before* navigation, which is deliberately the opposite of
 * Playwright's general advice to pause only after load. The reason is specific to
 * this page: the hold's timer is registered by an inline script in the document's
 * head, so a clock paused after load would let it fire first — the release these
 * fixtures exist to avoid. Pausing this early is safe here because nothing in the
 * load path needs a timer: Astro's `client:load` hydration is `await import(...)`
 * then hydrate, and the runtime bundle contains no timer call but `queueMicrotask`.
 * That was confirmed empirically on Chromium, Firefox and WebKit — the islands
 * hydrate under the freeze, and the hold fires only once time is advanced.
 *
 * Navigation stops at `commit`, and the fixture is read from Node through
 * `page.evaluate` rather than through locators, because a paused clock freezes the
 * page's animation frames and that is what locator polling waits on.
 */
const freezeForHydration = async (page: Page, path = "/") => {
  await page.clock.install();
  /*
    The pause target is a second ahead rather than `Date.now()`. A zero margin is a
    race with the clock's own bookkeeping — the fake clock advances by the browser's
    elapsed time since install, so a target equal to "now" can already be in the past
    by the time it is applied, which Firefox rejects outright as "cannot fast-forward
    to the past". Nothing asserts wall time, so the offset is free.
  */
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.goto(path, { waitUntil: "commit" });
  /*
    The fixture is read from Node through `page.evaluate`, not through locators,
    because a paused clock freezes the page's animation frames and that is what
    locator polling waits on.

    The font check counts faces still loading rather than reading
    `document.fonts.status`: under a frozen clock Firefox leaves that aggregate at
    "loading" for good even once every face has arrived, so the aggregate would time
    out on a page whose fonts are in fact fully loaded. Counting the faces is the
    condition that actually matters — the layout must be settled before any geometry
    is sampled — and it reads the same on all three engines.
  */
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          records: document.querySelectorAll(".work-index > li").length,
          loading: [...document.fonts].filter((face) => face.status !== "loaded").length,
        })),
      {
        timeout: 20_000,
        message: "the server-rendered document parsed and the fonts landed",
      },
    )
    .toEqual({ records: 3, loading: 0 });
};

/**
 * Wait for the islands to hydrate, then let the hold run with them ready — the
 * branch that keeps the reservation — and hand the clock back.
 *
 * `fastForward` fires each due timer at most once, which is all the hold needs, and
 * costs a fraction of `runFor`'s time: `runFor` renders every frame in the advanced
 * window, driving the opening's canvas loop about 150 times. Measured on this
 * runner, that is 85-1177ms against 2551ms and more. `fastForward` alone is not
 * enough, because with the clock already paused it leaves the page frozen — every
 * page-side timer stops — so the clock is resumed explicitly afterwards. Locators
 * are usable again once it is.
 */
const settleReservation = async (page: Page, { awaitPageModule = true } = {}) => {
  await expect
    .poll(
      () =>
        page.evaluate(
          (waitPage) => ({
            work: Boolean(window.__workPreviewReady),
            page: waitPage ? Boolean(window.__afterHoursMotionReady) : true,
          }),
          awaitPageModule,
        ),
      {
        timeout: 30_000,
        message: "the islands hydrated before the hold was advanced",
      },
    )
    .toEqual({ work: true, page: true });
  await page.clock.fastForward(2_500);
  await page.clock.resume();
  await expect(page.locator(".work-preview-stage")).toBeVisible();
};

/**
 * The section in its pinned layout, established deterministically.
 *
 * Because the hold early-returns once `__workPreviewReady` is set, the pinned layout
 * then stands for the rest of the test.
 */
const establishPinnedLayout = async (page: Page) => {
  await freezeForHydration(page);
  await settleReservation(page);
};

test.describe("editorial Work preview", () => {
  /**
   * The reading line the preview follows, as a fraction of the viewport. It is
   * the same 0.48 the controller uses, and it is written down here so the test
   * states the contract rather than mirroring the implementation.
   */
  const READING_LINE = 0.48;

  /** Which panel the stage is showing, and which record owns it. */
  const previewState = (page: Page) =>
    page.evaluate(() => ({
      active: [...document.querySelectorAll(".work-index > li")].findIndex((row) =>
        row.hasAttribute("data-active"),
      ),
      shown: [
        ...document.querySelectorAll<HTMLElement>(".work-preview-panel"),
      ]
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.dataset.preview),
    }));

  test("reserves the preview's geometry before the Work module hydrates", async ({
    page,
  }) => {
    // The section reserves its pinned geometry before paint, so the document is
    // the same height whether or not the Work module has hydrated: a deep link, a
    // restored scroll position, or a section link that lands below Work would
    // otherwise be aimed at an offset that moves after the page settles.
    //
    // The samples are taken inside the page, from the first frame, because the
    // reserved window is short and a round trip through the test runner would
    // observe it only by luck. What must never happen is the section showing one
    // layout and then swapping back to the other: that shrinks the document and
    // moves everything below it.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(/WorkShowcase\./, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.addInitScript(() => {
      window.__geometry = [];
      const sample = () => {
        const root = document.documentElement;
        const stage = document.querySelector(".work-preview-stage");
        const inline = document.querySelector(".work-inline-preview");
        if (!stage || !inline) return;
        const offset = (selector: string) =>
          Math.round(
            document.querySelector(selector)!.getBoundingClientRect().top +
              window.scrollY,
          );
        window.__geometry.push({
          t: Math.round(performance.now()),
          reserved: root.classList.contains("work-preview"),
          // The web font arrives shortly after first paint and legitimately
          // changes the document's height; the settled window is what the
          // reservation has to hold.
          fonts: document.fonts.status,
          docH: root.scrollHeight,
          workTop: offset("#selected-evidence"),
          profileTop: offset("#technical-profile"),
          archiveTop: offset("#learning-archive"),
          stage: getComputedStyle(stage).display,
          inline: getComputedStyle(inline).display,
        });
      };
      // Two clocks, because this window is short and a single one can be
      // throttled on a loaded machine: frames are the natural rate, and the timer
      // is the backstop that still lands samples if frames are starved.
      const tick = () => {
        sample();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setInterval(sample, 40);
    });

    await page.goto("/");
    await expect(page.locator(".work-inline-preview .project-preview")).toHaveCount(3);
    await page.waitForTimeout(1500);

    const samples = await page.evaluate(() => window.__geometry);
    expect(samples.length, "frames observed").toBeGreaterThan(5);

    // The reservation is what makes the geometry stable before the module runs.
    // How long the module takes is the machine's business, so the test does not
    // require every sample to be reserved: it requires the reservation to have been
    // held at least once, and the geometry to be the reserved geometry for as long
    // as it was held.
    const reservedSamples = samples.filter((sample) => sample.reserved);
    expect(reservedSamples.length, "reserved samples").toBeGreaterThan(0);

    // The page's own arrival — the web font's metrics applying — legitimately moves
    // the document, so "settled" is where the height has stopped changing. The
    // reserved geometry is asserted from there; everything before it is the page
    // still arriving, not the reservation doing its job.
    const settled = samples.findIndex((sample, index) =>
      samples.slice(index, index + 4).every((next) => next.docH === sample.docH),
    );
    expect(settled, "the page settled").toBeGreaterThanOrEqual(0);
    const settledReserved = samples.slice(settled).filter((sample) => sample.reserved);

    // The last reserved sample is the reserved geometry at its most settled.
    const reserved = reservedSamples[reservedSamples.length - 1];

    for (const sample of settledReserved) {
      // Not the document's total height: Contact's band is sized by the page
      // module, so that number belongs to a different section and moves when the
      // page module arrives. The offsets below Work are what the reservation owns.
      expect(sample.workTop, "reserved Work offset").toBe(settledReserved[0].workTop);
      expect(sample.profileTop, "reserved Profile offset").toBe(
        settledReserved[0].profileTop,
      );
      expect(sample.archiveTop, "reserved Archive offset").toBe(
        settledReserved[0].archiveTop,
      );
    }

    // The one-way rule itself: the section never swaps back out of a layout it has
    // already shown. A stage that comes back after it has gone is the reclaim this
    // guards against, and it is independent of how long the module takes.
    const goneAt = samples.findIndex((sample) => sample.stage === "none");
    if (goneAt >= 0) {
      for (let index = goneAt; index < samples.length; index += 1) {
        expect(
          samples[index].stage,
          `sample ${index}: the stage came back after the section had fallen back`,
        ).toBe("none");
      }
    }

    // The section ends in exactly one of its two layouts, and its geometry matches
    // that layout.
    const last = samples[samples.length - 1];
    const reference = settledReserved[0] ?? reserved;
    if (last.stage === "block") {
      expect(last.inline).toBe("none");
      expect(last.profileTop).toBe(reference.profileTop);
      expect(last.archiveTop).toBe(reference.archiveTop);
      await expect(page.locator(".work-preview-stage")).toBeVisible();
      await expect(
        page.locator(".work-preview-panel:not([hidden]) .project-preview"),
      ).toBeVisible();
    } else {
      expect(last.inline).toBe("block");
      // The in-flow layout is the taller one: every study is in the document, so
      // everything below the section sits further down.
      expect(last.archiveTop).toBeGreaterThan(reference.archiveTop);
      await expect(page.locator(".work-preview-stage")).toBeHidden();
      await expect(page.locator(".work-inline-preview .project-preview")).toHaveCount(3);
    }
  });

  test("keeps a complete in-flow preview when the Work module never arrives", async ({
    page,
  }) => {
    // The stage is reserved before paint, so a module that never loads must hand
    // the reservation back rather than leaving an empty frame behind: every project
    // keeps a complete, visible study in its own record.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(/WorkShowcase\./, (route) => route.abort());
    await page.goto("/");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            getComputedStyle(document.querySelector(".work-inline-preview")!).display,
          ),
        { timeout: 10_000 },
      )
      .toBe("block");

    await expect(page.locator(".work-preview-stage")).toBeHidden();
    // Three records, each with its own study, and none of the studies left in a
    // pre-paint state by a controller that never ran.
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await expect(page.locator(".work-inline-preview .project-preview")).toHaveCount(3);
    const faded = await page
      .locator(".work-inline-preview [data-art-node]")
      .evaluateAll((nodes) =>
        nodes.filter((node) => Number(getComputedStyle(node).opacity) < 0.99).length,
      );
    expect(faded).toBe(0);
    // The source-derived studies still name their references.
    await expect(
      page.getByRole("link", { name: /Preview reference: AGENTS\.md/ }),
    ).toHaveAttribute(
      "href",
      "https://github.com/FlaBBB/WordyChain/blob/HEAD/AGENTS.md#L9-L11",
    );
  });

  test("follows the record crossing the reading line forward, in reverse, and after a jump", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // The pinned layout, established deterministically rather than by winning the
    // 2000ms hold race. What the test asserts is unchanged: the reading index
    // driving the stage.
    await establishPinnedLayout(page);
    await expect(
      page.locator(".work-preview-panel:not([hidden]) .project-preview"),
    ).toBeVisible();

    // Put a given record's own top just past the reading line: the last record
    // crossing it is the one that owns the preview.
    //
    // The alignment is deliberately a few pixels past the line rather than exactly
    // on it. A record's top landing exactly on the line is a knife-edge: scroll
    // positions round to a device pixel, so on a 2x display the top lands half a
    // CSS pixel on one side or the other, and "has this record crossed?" then
    // depends on which way it rounded — WebKit rounds it to 432.56 against a
    // 432 line, where the record legitimately has not crossed. A few pixels past
    // the line is unambiguous on every engine and still exercises the same
    // contract: the last record that has crossed owns the preview.
    const READING_LINE_PAST = 8;
    const alignToReadingLine = async (index: number) => {
      await page.evaluate(
        async ({ index, line, past }) => {
          document.documentElement.style.scrollBehavior = "auto";
          const row = document.querySelectorAll(".work-index > li")[index];
          const readingLine = window.innerHeight * line;
          const target =
            row.getBoundingClientRect().top + window.scrollY - readingLine + past;
          window.scrollTo(0, target);
          /*
            Wait for the precondition rather than for a duration: the record has to
            have actually crossed the reading line, and the controller selects from
            a scroll-scheduled animation frame. A wall-clock wait races both — under
            a loaded engine the frame lands after it — so this waits for the scroll
            to be applied and the record to be past the line, then gives the
            controller two frames of its own.
          */
          const frame = () =>
            new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          /*
            Wait for the input to have arrived and for the preview to have settled,
            rather than for a fixed duration. Two things are asynchronous here: the
            engine dispatches the scroll event on its own schedule (WebKit delivers it
            tens of milliseconds after the scroll), and the controller then decides on
            a scroll-scheduled animation frame and wipes between records for half a
            second.

            "Settled" means exactly the active record's panel is visible — during the
            wipe the outgoing panel is deliberately still shown, so a read then would
            report two records. That is a precondition, not the assertion: the
            assertion below is *which* record is active, so a controller that settles
            on the wrong one settles just the same and fails there. The time floor
            keeps the run of settled frames from starting before the controller has
            had its turn, and a controller that never settles exhausts the bound.
          */
          let sawScroll = false;
          const onScroll = () => { sawScroll = true; };
          window.addEventListener("scroll", onScroll, { passive: true, once: true });
          for (let attempt = 0; attempt < 60 && !sawScroll; attempt += 1) await frame();
          window.removeEventListener("scroll", onScroll);
          const since = performance.now();

          const settled = () => {
            const rows = [...document.querySelectorAll(".work-index > li")];
            const panels = [
              ...document.querySelectorAll<HTMLElement>(".work-preview-panel"),
            ];
            const active = rows.findIndex((row) => row.hasAttribute("data-active"));
            const shown = panels
              .map((panel, position) => (panel.hidden ? -1 : position))
              .filter((position) => position >= 0);
            return active >= 0 && shown.length === 1 && shown[0] === active;
          };
          let stable = 0;
          for (let attempt = 0; attempt < 240 && stable < 8; attempt += 1) {
            await frame();
            if (!settled()) {
              stable = 0;
              continue;
            }
            // The floor is only about not reading before the controller's turn; once
            // the preview is settled and staying settled, this is satisfied.
            stable = performance.now() - since >= 600 ? stable + 1 : 0;
          }
          await frame();
        },
        { index, line: READING_LINE, past: READING_LINE_PAST },
      );
    };

    // The panels in reading order, so each expectation names the project it means.
    const ids = await page
      .locator(".work-preview-panel")
      .evaluateAll((panels) =>
        panels.map((panel) => (panel as HTMLElement).dataset.preview),
      );
    expect(ids).toEqual(["wordychain", "jmc", "harness"]);

    for (const index of [0, 1, 2]) {
      await alignToReadingLine(index);
      const state = await previewState(page);
      expect(state.active, `record ${index}`).toBe(index);
      expect(state.shown, `record ${index}`).toEqual([ids[index]]);
    }

    // Reversing walks the preview back through the records it came through.
    await alignToReadingLine(1);
    expect((await previewState(page)).active).toBe(1);
    await alignToReadingLine(0);
    expect((await previewState(page)).active).toBe(0);

    // A jump straight to the last record selects it without passing through the
    // others, and only that record is left open.
    await alignToReadingLine(2);
    expect(await previewState(page)).toEqual({ active: 2, shown: ["harness"] });

    // A jump back to the top of the section returns to the first record.
    await alignToReadingLine(0);
    expect(await previewState(page)).toEqual({ active: 0, shown: ["wordychain"] });

    // Every record stays reachable in reading order regardless of the preview.
    for (const name of ["WordyChain", "JMC", "harness-agentic-sdlc"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`Source: ${name}`) }).first(),
      ).toBeVisible();
    }
  });
});

test.describe("editorial Work preview under a slow Work module", () => {
  /**
   * Hold the Work module's own chunk past the section's pre-paint hold, so the
   * section has already fallen back to its readable in-flow layout by the time the
   * module arrives. Returns once the module has had time to finish.
   */
  const holdWorkModule = async (page: Page, holdMs: number) => {
    await page.route(/WorkShowcase\./, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      await route.continue();
    });
  };

  const layout = (page: Page) =>
    page.evaluate(() => ({
      html: document.querySelector("html")!.className,
      height: document.documentElement.scrollHeight,
      stage: getComputedStyle(document.querySelector(".work-preview-stage")!).display,
      inline: getComputedStyle(document.querySelector(".work-inline-preview")!).display,
    }));

  test("keeps the in-flow layout when the Work module arrives after the fallback", async ({
    page,
  }) => {
    // A module slower than the hold is a predictable slower-network case, not a
    // broken one. Once the section has fallen back, a late module must not take the
    // pinned layout: that would reformat the page under a visitor who may already be
    // reading it, and would move everything below the section a second time.
    await page.setViewportSize({ width: 1440, height: 900 });
    await holdWorkModule(page, 4000);
    await page.goto("/");
    await expect(page.locator(".work-inline-preview").first()).toBeVisible();
    const fallenBack = await layout(page);
    expect(fallenBack.stage).toBe("none");
    expect(fallenBack.inline).toBe("block");

    // Wait for the module to have loaded and had its chance to take over.
    await page.waitForTimeout(4000);
    const settled = await layout(page);
    expect(settled.stage).toBe("none");
    expect(settled.inline).toBe("block");
    // The document does not shrink back under the visitor.
    expect(settled.height).toBe(fallenBack.height);

    // ...and the studies the fallback showed are complete, not left mid-draw by a
    // controller that never ran.
    await expect(page.locator(".work-inline-preview .project-preview")).toHaveCount(3);
    const faded = await page
      .locator(".work-inline-preview [data-art-node]")
      .evaluateAll((nodes) =>
        nodes.filter((node) => Number(getComputedStyle(node).opacity) < 0.99).length,
      );
    expect(faded).toBe(0);
  });

  for (const [label, align] of [
    ["a reader inside Work", ".work-index > li:nth-child(2) .project-copy"],
    ["a reader in a section below Work", "#learning-archive"],
  ] as const) {
    test(`keeps the reading position of ${label} across the fallback`, async ({
      page,
    }) => {
      // The fallback changes the document's height, so anything the visitor is
      // already reading would slide under them. Their place on the screen is
      // restored across the handoff.
      //
      // The hold is a wall-clock two seconds, so the reading has to be taken from
      // inside the page rather than through a round trip: the page scrolls to the
      // watched element as soon as it exists, then records its place on every
      // frame. The samples are what is asserted on, so a slow engine cannot turn
      // this into a race.
      await page.setViewportSize({ width: 1440, height: 900 });
      await holdWorkModule(page, 5000);
      await page.addInitScript((selector) => {
        window.__reading = [];
        // Re-place the watched element on the reading line every frame until the
        // hold is nearly over. An early placement would be computed against a
        // layout that is still settling — the fonts, and the section's own reserved
        // geometry — and would leave the line somewhere other than where it was
        // aimed.
        const HOLD_MS = 2000;
        const PLACE_UNTIL = HOLD_MS - 500;
        const started = performance.now();
        let placed = false;
        const tick = () => {
          const el = document.querySelector(selector);
          const root = document.documentElement;
          const line = window.innerHeight * 0.35;
          if (el && performance.now() - started < PLACE_UNTIL) {
            root.style.scrollBehavior = "auto";
            window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - line);
            placed = true;
          }
          if (el && placed) {
            window.__reading.push({
              t: Math.round(performance.now()),
              reserved: root.classList.contains("work-preview"),
              top: Math.round(el.getBoundingClientRect().top),
              y: Math.round(window.scrollY),
              height: root.scrollHeight,
            });
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, align);

      await page.goto("/");
      await expect(page.locator(".work-inline-preview").first()).toBeVisible();
      await page.waitForTimeout(3000);

      const samples = await page.evaluate(() => window.__reading);
      const flip = samples.findIndex(
        (sample, index) => index > 0 && samples[index - 1].reserved && !sample.reserved,
      );
      // The scenario is real: the reservation was held while the visitor was
      // reading, and it was then released.
      expect(flip, "the fallback was observed while the visitor was reading").toBeGreaterThan(
        0,
      );

      // Compare the settled state on each side: where the visitor was reading
      // before the fallback, and where they are reading after it.
      const before = samples[flip - 1];
      const after = samples[samples.length - 1];
      expect(after.reserved, "the fallback landed").toBe(false);
      expect(after.height, "document height across the fallback").not.toBe(before.height);
      expect(
        Math.abs(after.top - before.top),
        `reading-line drift across the fallback (${before.top} -> ${after.top})`,
      ).toBeLessThanOrEqual(4);
    });
  }

  test("keeps the reserved geometry stable when the module loads promptly", async ({
    page,
  }) => {
    /*
      The correction above must not have been bought by giving up the fast path:
      with a prompt module the document's height and every section offset are the
      same before and after hydration, so nothing moves under the visitor at all.

      The baseline is therefore taken from the server-rendered document *before*
      Work hydrates, which is the whole point of the contract: the reservation is
      what makes the pre-hydration geometry correct, so a baseline measured after
      the layout was established would be measuring the thing it is supposed to
      predict. Work's chunk is gated until the reserved geometry has been read, and
      released while clock time is still before the hold, so the module arrives with
      the reservation still standing.
    */
    await page.setViewportSize({ width: 1440, height: 900 });
    const releaseWork = await gateWorkModule(page);
    await freezeForHydration(page);

    const geometry = () =>
      page.evaluate(() => {
        const at = (selector: string) =>
          Math.round(
            document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY,
          );
        return {
          height: document.documentElement.scrollHeight,
          work: at("#selected-evidence"),
          profile: at("#technical-profile"),
          archive: at("#learning-archive"),
        };
      });

    // The reserved, pre-hydration geometry: the section is in its pinned layout on
    // the strength of the pre-paint class alone, with no module involved.
    const reserved = await page.evaluate(() => ({
      pinned: document.documentElement.classList.contains("work-preview"),
      stage: getComputedStyle(document.querySelector(".work-preview-stage")!).display,
      workReady: Boolean(window.__workPreviewReady),
    }));
    expect(reserved.pinned, "the reservation is standing before hydration").toBe(true);
    expect(reserved.stage, "the pinned stage is painted before hydration").toBe("block");
    expect(reserved.workReady, "Work has not hydrated yet").toBe(false);

    const first = await geometry();
    const samples = [first];

    // Release the module while clock time is still before the hold, and let it
    // hydrate. The clock is frozen, so no wall-clock delay is involved.
    releaseWork();
    await settleReservation(page);

    // Every section offset is the same as it was before hydration: the swap is
    // invisible rather than the swap never happening.
    for (let step = 0; step < 14; step += 1) {
      await page.waitForTimeout(150);
      samples.push(await geometry());
    }
    for (const [index, sample] of samples.entries()) {
      expect(sample, `sample ${index}`).toEqual(first);
    }
  });
});

test.describe("editorial Work studies", () => {
  /** The desktop sizes the pinned column is allowed to run at. */
  const PINNED_SIZES = [
    [1440, 900],
    [1440, 740],
    [1024, 740],
    [901, 740],
    [1920, 1200],
  ] as const;

  for (const [width, height] of PINNED_SIZES) {
    test(`fits every study inside its frame at ${width}x${height}`, async ({ page }) => {
      // A study that is clipped explains nothing: the boundary study's whole point
      // is that its branches reach their packages, and the lifecycle study's is the
      // whole sequence. Every visible node must be painted inside the art box at
      // every size the pinned column runs at.
      //
      // Whichever layout the section is in is measured — the pinned stage when the
      // Work module claimed it, the in-flow studies when it fell back — because both
      // are layouts a visitor can be shown and the requirement is the same for both.
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(
        page.locator(".work-preview-stage:visible, .work-inline-preview:visible").first(),
      ).toBeVisible();
      // Measure at rest rather than mid-draw, and only once the page has settled:
      // the web font arrives shortly after first paint and changes the frame's own
      // geometry, so a measurement taken before it has loaded is a measurement of
      // the page still arriving.
      await page.waitForFunction(() => document.fonts.status === "loaded");
      // Then wait for the document's height to stop changing, which is what
      // "settled" means here.
      await page.waitForFunction(
        () =>
          new Promise<boolean>((resolve) => {
            const first = document.documentElement.scrollHeight;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve(document.documentElement.scrollHeight === first);
              });
            });
          }),
        undefined,
        { timeout: 10_000 },
      );
      await page.addStyleTag({
        content: "[data-art-node] { transform: none !important; opacity: 1 !important; }",
      });
      await page.waitForTimeout(300);

      /** Measure one study: which nodes are painted outside its art box. */
      const measure = (locator: ReturnType<Page["locator"]>) =>
        locator.evaluate((figure) => {
          const art = figure.querySelector(".project-art")!;
          const artBox = art.getBoundingClientRect();
          const nodes = [...figure.querySelectorAll("[data-art-node]")];
          const outside = nodes
            .filter((node) => {
              const box = node.getBoundingClientRect();
              return box.top < artBox.top - 1 || box.bottom > artBox.bottom + 1;
            })
            .map((node) => (node.textContent ?? "").trim().slice(0, 30));
          const overflow = nodes
            .map((node) => node.getBoundingClientRect().bottom - artBox.bottom)
            .reduce((a, b) => Math.max(a, b), 0);
          return {
            kind: figure.getAttribute("data-kind"),
            outside,
            overflow: Math.round(overflow),
          };
        });

      const studies: { kind: string | null; outside: string[]; overflow: number }[] = [];

      if (await page.locator(".work-preview-stage").isVisible()) {
        // Pinned: only one study is in the stage at a time, so all three are
        // exercised by driving the public reading index — the same rule the
        // controller uses, where the last record crossing the reading line owns the
        // preview. Filtering to what happens to be shown at load would leave the
        // compose and lifecycle studies unmeasured, which is exactly where the
        // short-stage rules live.
        for (const index of [0, 1, 2]) {
          await page.evaluate((row) => {
            document.documentElement.style.scrollBehavior = "auto";
            const record = document.querySelectorAll(".work-index > li")[row];
            // Just above the reading line rather than exactly on it: the controller
            // compares with `<=`, so a sub-pixel landing on the line itself can fall
            // on either side of the test. A margin makes the handover unambiguous,
            // and the records are far taller than the margin.
            const readingLine = window.innerHeight * 0.48 - 24;
            window.scrollTo(
              0,
              record.getBoundingClientRect().top + window.scrollY - readingLine,
            );
          }, index);
          // Wait for the index to have handed the preview to this record, so the
          // measurement is of a settled panel rather than one mid-wipe.
          await expect
            .poll(
              () =>
                page.evaluate(() =>
                  [...document.querySelectorAll<HTMLElement>(".work-preview-panel")]
                    .map((panel, position) => (!panel.hidden ? position : -1))
                    .filter((position) => position >= 0),
                ),
              { timeout: 5_000 },
            )
            .toEqual([index]);
          studies.push(
            await measure(
              page.locator(".work-preview-panel:not([hidden]) .project-preview"),
            ),
          );
        }
      } else {
        // Fallen back: every record carries its own in-flow study, so all three are
        // measured directly.
        const figures = page.locator(".work-inline-preview .project-preview");
        await expect(figures.first()).toBeVisible();
        await expect(figures).toHaveCount(3);
        for (let index = 0; index < 3; index += 1) {
          studies.push(await measure(figures.nth(index)));
        }
      }

      // All three studies are covered, whichever layout the section is in. This is
      // what keeps a short-stage rule for one study from going unmeasured.
      expect(
        studies.map((study) => study.kind).sort(),
        "kinds measured",
      ).toEqual(["boundaries", "compose", "lifecycle"]);
      for (const study of studies) {
        expect(study.outside, `${study.kind} outside its art box`).toEqual([]);
        expect(study.overflow, `${study.kind} overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("meets every connector endpoint with its package dot", async ({ page }) => {
    // The illustration exists to explain the package boundaries, so a branch that
    // ends in empty space contradicts it. The endpoint is read from the rendered
    // path's own geometry, so a change to the SVG's fitting is what this catches.
    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      // The study is measured in the pinned column, which is what this test is
      // about, so the pinned layout is established rather than raced for.
      await establishPinnedLayout(page);
      await page.addStyleTag({
        content: "[data-art-node], [data-art-path] { transform: none !important; opacity: 1 !important; }",
      });
      await page.waitForTimeout(200);

      const measured = await page.evaluate(() => {
        const figure = document.querySelector(".work-preview-panel .project-preview")!;
        const paths = [...figure.querySelectorAll<SVGPathElement>("path[data-art-path]")];
        const dots = [...figure.querySelectorAll(".boundary-packages li")].map((li) => {
          const dot = li.querySelector(".boundary-point")!.getBoundingClientRect();
          return {
            name: li.querySelector("strong")!.textContent!.trim(),
            x: dot.left + dot.width / 2,
            y: dot.top + dot.height / 2,
          };
        });
        const ends = paths.map((path) => {
          const point = path.getPointAtLength(path.getTotalLength());
          const matrix = path.getScreenCTM()!;
          return {
            x: matrix.a * point.x + matrix.c * point.y + matrix.e,
            y: matrix.b * point.x + matrix.d * point.y + matrix.f,
          };
        });
        return dots.map((dot) => ({
          name: dot.name,
          distance: Math.min(
            ...ends.map((end) => Math.hypot(end.x - dot.x, end.y - dot.y)),
          ),
        }));
      });

      expect(measured.length, `${width}px dots`).toBe(3);
      for (const dot of measured) {
        expect(dot.distance, `${width}px ${dot.name}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test("paints the connector tree down to its package dots once the draw has settled", async ({
    page,
  }) => {
    // The geometry test above reads each path's own end point, which says nothing
    // about whether the stroke is painted there. The draw is what can leave the
    // visible line short: it carries a dash, and a dash that is measured in the
    // wrong space is consumed before the path ends, so the painted stroke stops
    // short of its dot while the geometry still matches exactly. That is what a
    // visitor sees, so that is what is asserted — the painted ink, read from the
    // rendered study.
    await page.setViewportSize({ width: 1440, height: 900 });
    // The painted stroke is only in the pinned column, and the draw is the study's
    // own timeline, so the pinned layout is established rather than raced for.
    await establishPinnedLayout(page);
    // Bring the study into view and let its draw run to completion.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      const el = document.querySelector("#selected-evidence")!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 40);
    });
    await page.waitForTimeout(3000);

    // 1. The settled study is a plain solid stroke: the dash was the draw's own
    // bookkeeping and nothing may retain it once the draw has finished.
    const dashed = await page.evaluate(() =>
      [
        ...document.querySelectorAll<SVGPathElement>(
          ".work-preview-panel:not([hidden]) path[data-art-path]",
        ),
      ].map((path) => ({
        d: path.getAttribute("d"),
        dash: getComputedStyle(path).strokeDasharray,
        offset: getComputedStyle(path).strokeDashoffset,
      })),
    );
    expect(dashed.length).toBe(3);
    for (const path of dashed) {
      expect(path.dash, `${path.d} dash`).toBe("none");
    }

    // 2. And the painted stroke actually reaches each dot.
    const figure = page.locator(".work-preview-panel:not([hidden]) .project-preview");
    const geometry = await figure.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        clip: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        dots: [...element.querySelectorAll(".boundary-packages li")].map((li) => {
          const dot = li.querySelector(".boundary-point")!.getBoundingClientRect();
          return {
            name: li.querySelector("strong")!.textContent!.trim(),
            x: Math.round(dot.left + dot.width / 2 - box.x),
            top: Math.round(dot.top - box.y),
          };
        }),
      };
    });
    expect(geometry.dots.length).toBe(3);
    const shot = (await page.screenshot({ clip: geometry.clip })).toString("base64");
    const gaps = await page.evaluate(
      async ({ b64, dots, clipWidth }) => {
        const image = await new Promise<HTMLImageElement>((resolve) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.src = "data:image/png;base64," + b64;
        });
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        /*
          The screenshot is in device pixels — at a 2x device pixel ratio the clip
          comes back twice its CSS size — while the dot coordinates are CSS pixels
          read from the layout. Walking the column in the wrong space reads the
          surface far above the dot and reports a gap the height of the whole study,
          which is what this looked like on WebKit, whose device sets a 2x ratio.
          Scaling by the image's own ratio keeps this correct on any ratio.
        */
        const scale = image.width / clipWidth;
        // The connector stroke blends toward the surface as coverage falls, so the
        // window spans a half-covered pixel up to the full stroke colour. It is
        // still narrow enough to exclude the surface and the dots.
        const stroke = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
          const i = (y * canvas.width + x) * 4;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          return b > 55 && b < 200 && r > 40 && r < 140 && g > 30 && g < 125 && b > r + 20;
        };
        return dots.map((dot) => {
          // Walk up from just above the dot: the first painted pixel in this
          // column is where the visible stroke ends.
          const x = Math.round(dot.x * scale);
          const top = Math.round(dot.top * scale);
          let end = -1;
          for (let y = top - 2; y >= 0; y -= 1) {
            let hit = false;
            for (let dx = -1; dx <= 1; dx += 1) if (stroke(x + dx, y)) hit = true;
            if (hit) {
              end = y;
              break;
            }
          }
          // The gap is reported in CSS pixels, the units the bound is stated in.
          return { name: dot.name, end, gap: end < 0 ? null : (top - end) / scale };
        });
      },
      { b64: shot, dots: geometry.dots, clipWidth: geometry.clip.width },
    );

    for (const gap of gaps) {
      // The dot's own edge sits a couple of pixels below the stroke's last painted
      // pixel even with no dash at all, so the bound is that baseline, not zero.
      expect(gap.gap, `${gap.name} painted gap`).not.toBeNull();
      expect(gap.gap, `${gap.name} painted gap`).toBeLessThanOrEqual(4);
    }
  });
});

test.describe("Work's layout ownership is its own", () => {
  /**
   * Everything the invariant is stated over, read in one round trip.
   *
   * `motion` is the page-reveal module's own class and `reserved` is Work's, so they
   * are read separately: the whole point is that they are independent.
   */
  const ownership = (page: Page) =>
    page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector<HTMLElement>(".work-preview-stage")!;
      const section = document.querySelector("#technical-profile")!;
      return {
        motion: /\bmotion\b/.test(root.className),
        reserved: /\bwork-preview\b/.test(root.className),
        height: root.scrollHeight,
        workHeight: Math.round(
          document.querySelector("#selected-evidence")!.getBoundingClientRect().height,
        ),
        stage: getComputedStyle(stage).display,
        inline: getComputedStyle(
          document.querySelector<HTMLElement>(".work-inline-preview")!,
        ).display,
        profileTop: Math.round(section.getBoundingClientRect().top + window.scrollY),
        workReady: Boolean(window.__workPreviewReady),
        pageReady: Boolean(window.__afterHoursMotionReady),
      };
    });

  test("keeps Work's geometry when the page-reveal module is late", async ({ page }) => {
    /*
      This is the other loading order: Work owns the section and has reserved its
      geometry, and then the page-reveal module — which owns the unrelated
      `html.motion` class — is late. Work's layout must not follow it, in either
      direction: a section that collapses when that class drops and re-pins when the
      module arrives moves the whole page under the reader twice.

      The phase that matters is the one where the page module is genuinely still
      absent, so it is observed directly rather than inferred from a fixed delay. The
      module is held behind a gate that only the test opens, which makes "still
      absent" a fact rather than a hope: a delay can expire during hydration setup,
      and the test would then go green without ever exercising the late phase.
    */
    await page.setViewportSize({ width: 1440, height: 900 });
    const releasePageModule = await gatePageModule(page);
    await freezeForHydration(page);

    // Let Work hydrate and settle its reservation while the page module is held.
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__workPreviewReady)), {
        timeout: 30_000,
        message: "Work hydrated while the page module was held",
      })
      .toBe(true);

    // Observation 1 — the late phase, before any time has been advanced. The page
    // module has not run, and Work is pinned on its own reservation.
    const held = await ownership(page);
    expect(held.pageReady, "the page module is still absent").toBe(false);
    expect(held.motion, "the page module has not added its class").toBe(true);
    expect(held.workReady, "Work has hydrated").toBe(true);
    expect(held.reserved, "Work's reservation is standing").toBe(true);
    expect(held.stage, "the pinned stage is painted").toBe("block");

    // Advance the hold with the page module still absent, then hand the clock back.
    await page.clock.fastForward(2_500);
    await page.clock.resume();

    // Observation 2 — the hold has run. It turned its own class off because the page
    // module never arrived, and kept Work's reservation, because Work had confirmed
    // itself. Motion off with Work still pinned is the state this test exists for.
    const afterHold = await ownership(page);
    expect(afterHold.pageReady, "the page module is still absent").toBe(false);
    expect(afterHold.motion, "the hold dropped the page module's class").toBe(false);
    expect(afterHold.reserved, "the hold kept Work's reservation").toBe(true);
    expect(afterHold.stage, "the stage is still pinned").toBe("block");
    expect(afterHold.inline, "the in-flow studies are still out of the flow").toBe("none");
    expect(afterHold.height, "the hold did not change the document height").toBe(
      held.height,
    );

    // Only now release the page module, and let it arrive.
    releasePageModule();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__afterHoursMotionReady)), {
        timeout: 30_000,
        message: "the page module arrived after the gate was opened",
      })
      .toBe(true);
    await page.waitForTimeout(400);

    // Observation 3 — the arrival is the real transition, and it changed nothing
    // about Work. Its class is back, and the section is exactly where it was.
    const arrived = await ownership(page);
    expect(arrived.motion, "the page module added its class").toBe(true);
    expect(arrived.reserved, "Work's reservation survived the arrival").toBe(true);
    expect(arrived.stage, "the page module's class did not take the stage").toBe(
      afterHold.stage,
    );
    expect(arrived.inline, "the page module's class did not restore the in-flow studies")
      .toBe(afterHold.inline);
    // The document's total height is not Work's: Contact's band is sized by this
    // same module, and it legitimately becomes compact when the module arrives.
    // Work's own height is what must not move.
    expect(arrived.workHeight, "the page module's class did not move Work's height").toBe(
      afterHold.workHeight,
    );
    expect(
      arrived.profileTop,
      "the page module's class did not move the Profile offset",
    ).toBe(afterHold.profileTop);
  });

  test("keeps the readable in-flow layout when both modules are late", async ({ page }) => {
    /*
      Both holds expire: Work falls back one way, and the page module arriving
      afterwards must not re-pin the section it no longer owns.

      The fallback height is read as a *baseline* — with both module gates still
      closed, so neither module can have had a hand in it — and then asserted
      unchanged once both have arrived. That is the relationship the contract is
      about, and unlike a written-down number it cannot be invalidated by a content
      edit: this assertion was a hard-coded 8055 until removing the three Work scope
      notes legitimately shortened the document by 183px, which turned a passing test
      into a failing one without anything about the fallback changing.
    */
    await page.setViewportSize({ width: 1440, height: 900 });
    const releasePageModule = await gatePageModule(page);
    const releaseWorkModule = await gateWorkModule(page);
    await freezeForHydration(page);

    // Let Work's own hold run out with its module still held, which is the fallback.
    await page.clock.fastForward(2_500);
    await page.clock.resume();

    // The baseline: the in-flow layout, reached with both modules still absent.
    const baseline = await page.evaluate(() => ({
      stage: getComputedStyle(document.querySelector(".work-preview-stage")!).display,
      inline: getComputedStyle(
        document.querySelector<HTMLElement>(".work-inline-preview")!,
      ).display,
      height: document.documentElement.scrollHeight,
      workHeight: Math.round(
        document.querySelector("#selected-evidence")!.getBoundingClientRect().height,
      ),
      workReady: Boolean(window.__workPreviewReady),
      pageReady: Boolean(window.__afterHoursMotionReady),
    }));
    expect(baseline.workReady, "Work has not arrived at the baseline").toBe(false);
    expect(baseline.pageReady, "the page module has not arrived at the baseline").toBe(
      false,
    );
    expect(baseline.stage, "the section fell back to the in-flow layout").toBe("none");
    expect(baseline.inline, "the in-flow studies are the layout").toBe("block");

    // Now release both, in the order that makes the coupling visible: Work first, so
    // the section has already fallen back when its own module arrives, then the page
    // module, which must not re-pin a section it does not own.
    releaseWorkModule();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__workPreviewReady)), {
        timeout: 30_000,
        message: "Work's module arrived after the fallback",
      })
      .toBe(true);
    releasePageModule();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__afterHoursMotionReady)), {
        timeout: 30_000,
        message: "the page module arrived after the fallback",
      })
      .toBe(true);
    await page.waitForTimeout(400);

    const settled = await page.evaluate(() => ({
      stage: getComputedStyle(document.querySelector(".work-preview-stage")!).display,
      inline: getComputedStyle(
        document.querySelector<HTMLElement>(".work-inline-preview")!,
      ).display,
      height: document.documentElement.scrollHeight,
      workHeight: Math.round(
        document.querySelector("#selected-evidence")!.getBoundingClientRect().height,
      ),
      workReady: Boolean(window.__workPreviewReady),
      pageReady: Boolean(window.__afterHoursMotionReady),
    }));
    // Both modules have loaded...
    expect(settled.workReady).toBe(true);
    expect(settled.pageReady).toBe(true);
    // ...and the section is still the readable in-flow layout it fell back to, at the
    // height that fallback had before either module was involved.
    expect(settled.stage, "a late module re-pinned the section").toBe("none");
    expect(settled.inline, "a late module took the in-flow studies away").toBe("block");
    // Work's own height, not the document's: Contact's band becomes compact when the
    // page module arrives, which is its own contract and not a re-pin of Work.
    expect(settled.workHeight, "a late module reformatted Work").toBe(baseline.workHeight);
    await expect(page.locator(".work-inline-preview .project-preview")).toHaveCount(3);
  });
});

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
      expect(await row.getAttribute("href")).toMatch(/^\/writing\/[a-z0-9-]+\/$/);
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
      "/writing/",
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
    await page.goto("/writing/");

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
    await expect(page).toHaveURL(/\/writing\/tcp1p-international-2024\/$/);
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
    await page.goto("/writing/tcp1p-international-2024/#wannaflag");
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
    await page.goto("/writing/tcp1p-international-2024/");

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
