import { expect, test, type Page } from "@playwright/test";
import { TIMELINE } from "../src/lib/timeline";

/**
 * Scroll the pinned timeline so a scene's screen is settled at the top. The
 * global progress is the single source of truth; native scrollIntoView cannot
 * reach the transformed pinned scenes.
 */
const goToScene = (page: Page, id: string) =>
  page.evaluate(
    ({ sceneId, timeline }) => {
      document.documentElement.style.scrollBehavior = "auto";
      const scene = timeline.find((entry) => entry.id === sceneId);
      const scroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: (scene?.start ?? 0) * scroll,
        behavior: "instant",
      });
    },
    { sceneId: id, timeline: TIMELINE },
  );

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
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle("flab — Fikri Muhammad Abdillah");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fikri Muhammad Abdillah.",
    );

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

    // The three real project records.
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await expect(page.locator(".work-index h3")).toHaveText([
      "WordyChain",
      "JMC",
      "harness-agentic-sdlc",
    ]);
    for (const [project, href] of Object.entries(repositoryUrls)) {
      await expect(
        page.getByRole("link", { name: new RegExp(project) }).first(),
      ).toHaveAttribute("href", href);
    }

    // The Malang identity note and the archive's CTFtime record.
    await expect(page.locator(".intro-note").first()).toContainText(
      "Malang, Indonesia",
    );
    await expect(
      page.getByRole("link", { name: /CTFtime/ }).first(),
    ).toHaveAttribute("href", "https://ctftime.org/user/156246");
    await expect(
      page.getByRole("link", { name: /Cybers_security/ }).first(),
    ).toHaveAttribute("href", "https://github.com/FlaBBB/Cybers_security");

    // No-JS shows the real mark, not an empty stage or a dead control.
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);
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

test("makes the skip link and section navigation keyboard reachable", async ({
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

  // Continuing forward from the main region reaches the intro link first.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Selected work" })).toBeFocused();

  // The wordmark is reachable by keyboard from the top of the document.
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", {
      name: "flab — back to Fikri Muhammad Abdillah’s identity",
    }),
  ).toBeFocused();

  const labels = await page
    .getByRole("navigation")
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.textContent?.trim()));
  expect(labels).toEqual(["Work", "Profile", "Archive", "Contact"]);

  await page.getByRole("link", { name: "Contact" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contact-path$/);
  const header = await page.locator(".site-header").boundingBox();
  const heading = await page.locator("#contact-path-heading").boundingBox();
  expect(heading?.y).toBeGreaterThanOrEqual(
    (header?.y ?? 0) + (header?.height ?? 0) - 1,
  );
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
    await expect(page.getByRole("navigation")).toBeVisible();
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

    const contactNav = page.getByRole("link", { name: "Contact" });
    await contactNav.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contact-path$/);
    for (const link of await page.locator("#contact-path a").all()) {
      await expect(link).toBeVisible();
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    const thirdRow = profileRows(page).nth(2);
    await thirdRow.locator("summary").click();
    await expect(thirdRow.locator(".ledger-details")).toBeVisible();
    expect(
      (await thirdRow.locator("summary").boundingBox())?.height,
    ).toBeGreaterThanOrEqual(44);

    const overflow = await page
      .locator(".work-index h3, .work-index p, #contact-path h2")
      .evaluateAll((elements) =>
        elements
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent),
      );
    expect(overflow).toEqual([]);
  });
}

test("keeps the 320px header inside the viewport with a wide system font", async ({
  page,
}) => {
  // DejaVu Sans is wider than the default stack and reproduced a real overflow
  // at 320px before the mobile header gap was narrowed to 1rem. Force it so the
  // regression cannot silently return with a different default font.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page.addStyleTag({
    content: 'html { font-family: "DejaVu Sans", sans-serif !important; }',
  });
  await page.waitForTimeout(300);

  const applied = await page
    .locator("nav a")
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(applied).toContain("DejaVu Sans");

  // No horizontal overflow, and the labels are retained and still fit.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  const links = await page.getByRole("navigation").getByRole("link").all();
  expect(
    (
      await page.getByRole("navigation").getByRole("link").allTextContents()
    ).map((label) => label.trim()),
  ).toEqual(["Work", "Profile", "Archive", "Contact"]);
  for (const link of links) {
    const box = await link.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    // Targets stay at least 45px tall; the fix narrows the gap, not the targets.
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("keeps text contrast readable on the plum and violet surfaces", async ({
  page,
}) => {
  await page.goto("/");
  const contrast = await page
    .locator(
      ".intro-note, .intro-link, .section-intro, .ledger-qualification dd, .footer-identity, .footer-top, #contact-path a, nav a",
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
        // In the pinned presentation the Contact scene is transparent and the
        // violet is a fixed surface behind the sky, so resolve it explicitly.
        let surface: Element | null = el.closest("#contact-path")
          ? document.querySelector(".contact-surface")
          : el;
        while (
          surface &&
          getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)"
        ) {
          surface = surface.parentElement;
        }
        const ink = luminance(getComputedStyle(el).color);
        const surfaceInk = luminance(
          getComputedStyle(surface!).backgroundColor,
        );
        return (
          (Math.max(ink, surfaceInk) + 0.05) / (Math.min(ink, surfaceInk) + 0.05)
        );
      });
    });
  for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);

  // The Contact surface fades in over the dark stage, so mid-blend the
  // composited backdrop passes through a mid luminance where the fixed palette
  // is unreadable (measured 2.51:1). The stage and header therefore switch
  // their foreground to whichever of white/black keeps the greater contrast,
  // on both sides of the crossover. Both sides are checked here against the
  // composited colour derived from the published surface opacity, and the
  // correction must actually be active mid-blend; removing it drops the worst
  // ratio far below the floor, which is this check's negative control.
  const held = await page.evaluate(async () => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    const scroll = root.scrollHeight - innerHeight;
    const surface = document.querySelector(".contact-surface")!;
    const base = [23, 19, 30];
    const band = [167, 139, 250];
    const luminance = (rgb: number[]) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    };
    const ratio = (a: number[], b: number[]) => {
      const one = luminance(a);
      const two = luminance(b);
      return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
    };
    const parse = (color: string) =>
      color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const navInk = () =>
      getComputedStyle(document.querySelector(".site-header nav a")!).color;
    const samples = [];
    // Both sides of the black/white crossover, strictly inside the blend window
    // (the surface is fully faded in by the last sample).
    for (const progress of [0.855, 0.862, 0.868, 0.873, 0.875]) {
      window.scrollTo({ top: progress * scroll, behavior: "instant" });
      await frame();
      await frame();
      const opacity = Number(getComputedStyle(surface).opacity);
      const composite = band.map(
        (value, index) => value * opacity + base[index] * (1 - opacity),
      );
      const elements = [
        ...document.querySelectorAll(".site-header nav a, .site-header .flab-logo"),
        ...document.querySelectorAll(
          "#contact-path h2, #contact-path p, #contact-path a, #contact-path .eyebrow",
        ),
        ...document.querySelectorAll("#learning-archive .site-footer"),
      ];
      const ratios = elements
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.bottom > 0 && box.top < innerHeight;
        })
        .map((el) => ratio(parse(getComputedStyle(el).color), composite));
      samples.push({
        progress,
        opacity,
        navInk: navInk(),
        count: ratios.length,
        worst: ratios.length ? Math.min(...ratios) : 0,
      });
    }
    return samples;
  });
  for (const sample of held) {
    expect(sample.count, `elements at ${sample.progress}`).toBeGreaterThan(0);
    expect(sample.worst, `worst contrast at ${sample.progress}`).toBeGreaterThanOrEqual(4.5);
  }
  // The crossover is genuinely crossed: the navbar resolves to both a light and
  // a dark ink across the held window, and each is the extreme (white/black)
  // rather than the fixed palette.
  const inks = new Set(held.map((sample) => sample.navInk));
  expect(inks.size).toBeGreaterThan(1);
  expect([...inks].some((ink) => ink === "rgb(255, 255, 255)")).toBe(true);
  expect([...inks].some((ink) => ink === "rgb(0, 0, 0)")).toBe(true);
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
            els.every((el) => Number(getComputedStyle(el).opacity) >= 0.999),
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

      // The 4px hover nudge must not undo the inset. Drive a real pointer at the
      // measured link centre: locator hover actionability waits for the box to
      // hold steady across frames, which the drifting ambient sky makes
      // expensive on this software-rendered Firefox.
      const link = (await rows.nth(index).locator("a").boundingBox())!;
      await page.mouse.move(link.x + link.width / 2, link.y + link.height / 2);
      await page.waitForTimeout(450);
      const hovered = await contactRowGeometry(page, index);
      expect(hovered.boxRight - hovered.arrowRight).toBeGreaterThanOrEqual(12);
      expect(hovered.arrowLeft - hovered.labelRight).toBeGreaterThanOrEqual(8);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);
    }

    // The inset must not introduce any horizontal overflow.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
}

test("keeps a visible focus ring on the violet contact band", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const links = page.locator("#contact-path a");
  await expect(links).toHaveCount(4);

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
    expect(
      ring.ratio,
      `link ${index} ring=${ring.color}`,
    ).toBeGreaterThanOrEqual(3);
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
  await page.goto("/");
  await expect(page.locator(".sculpture-canvas")).toBeVisible();
  // The profile record lives in a later pinned scene, so reach it through the
  // product's own focus navigation before clicking it open.
  const summary = page.locator("#technical-profile summary").nth(3);
  await summary.focus();
  await summary.click();
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
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await goToScene(page, "technical-profile");

    const rows = page.locator(".evidence-ledger details");
    expect(await page.evaluate(() => ({
      indicators: document.querySelectorAll(".ledger-indicator").length,
      records: document.querySelectorAll(".evidence-ledger details").length,
      firstOpen: (document.querySelector(".evidence-ledger details") as HTMLDetailsElement).open,
    }))).toEqual({ indicators: 0, records: 6, firstOpen: true });

    // Hovering the Source link, not just the summary, opens its entire record.
    const source = page
      .locator(".evidence-ledger > li")
      .nth(3)
      .locator(".ledger-source a");
    // Drive genuine pointer input at measured coordinates. The ambient sky
    // animates hundreds of drifting stars, which the traced WebKit renderer
    // composites at only a few frames per second, so locator actionability
    // (stability across frames) can spend most of the budget before the real
    // input is delivered. One in-page measurement per target is far cheaper,
    // exactly as the sibling return-hover story does.
    //
    // The pinned presentation applies the scene transform and any focus
    // placement on a later frame, so a point measured before that renders is
    // stale (measured: the control's box at y=-433 or y=4387, off screen, with
    // elementFromPoint null). Await the control actually being painted on screen
    // and holding still, then assert the measured centre genuinely receives it
    // before any pointer input.
    const onScreenPoint = async (locator: typeof source) => {
      const read = () =>
        locator.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            x,
            y,
            onScreen: box.top >= 0 && box.bottom <= window.innerHeight,
            receives: !!hit && (hit === element || element.contains(hit)),
          };
        });
      await expect
        .poll(
          async () => {
            const point = await read();
            return point.onScreen && point.receives;
          },
          { timeout: 5_000 },
        )
        .toBe(true);
      return read();
    };
    const summary = rows.nth(3).locator("summary");
    // Focus settles its entrance through the public keyboard path, not a
    // forced click or style mutation. It must not open the record by itself.
    await source.focus();
    await expect(rows.nth(3)).not.toHaveAttribute("open", "");
    const sourcePoint = await onScreenPoint(source);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await expect(rows.nth(3)).toHaveAttribute("open", "");
    await expect(rows.nth(0)).not.toHaveAttribute("open", "");

    // The first real mouse click, without leaving the row, is absorbed...
    // Opening the row shifts it, so re-measure the current real centre rather
    // than reusing a coordinate from before the disclosure tween.
    const firstClick = await onScreenPoint(summary);
    await page.mouse.click(firstClick.x, firstClick.y);
    await expect(rows.nth(3)).toHaveAttribute("open", "");

    // ...and a second real mouse click closes it normally.
    const secondClick = await onScreenPoint(summary);
    await page.mouse.click(secondClick.x, secondClick.y);
    await expect(rows.nth(3)).not.toHaveAttribute("open", "");
  });

  test("reopens a mouse-closed record on return and keeps it open after leaving", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await goToScene(page, "technical-profile");
    const rows = page.locator(".evidence-ledger details");
    // Drive genuine pointer input at measured coordinates. The ambient sky
    // animates hundreds of drifting stars, which the traced Firefox renderer
    // composites at only a few frames per second, so locator actionability
    // (stability across frames) would spend the whole budget waiting. One
    // in-page measurement per position is far cheaper than locator round-trips.
    const summaryCentre = () =>
      page.evaluate(() => {
        const summary = document
          .querySelectorAll(".evidence-ledger details")[3]
          .querySelector("summary")!;
        const box = summary.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
    const moveToCentre = async () => {
      const point = await summaryCentre();
      await page.mouse.move(point.x, point.y);
      return point;
    };
    // Let the entrance reveal settle so a measured box stays put.
    await page.waitForFunction(
      () =>
        Number(
          getComputedStyle(
            document.querySelectorAll(".evidence-ledger > li")[3],
          ).opacity,
        ) >= 0.999,
    );

    // Hover in from outside: the record opens without a click.
    await page.mouse.move(2, 2);
    await moveToCentre();
    await expect(rows.nth(3)).toHaveAttribute("open", "");
    // Opening this record closes the default-open first record above it, which
    // shifts the row; wait for that shift to finish, then measure once and
    // reuse the settled centre for the clicks and the return hover below.
    await page.waitForFunction(
      () =>
        !(document.querySelectorAll(".evidence-ledger details")[0] as HTMLDetailsElement)
          .open,
    );
    // The separate story above checks each click. Here, one real double-click
    // establishes its closed state without repeating that story's snapshots.
    const centre = await moveToCentre();
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(rows.nth(3)).not.toHaveAttribute("open", "");

    // Leaving and returning does not strand the row: it re-opens on hover.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    await page.mouse.move(centre.x, centre.y);
    await expect(rows.nth(3)).toHaveAttribute("open", "");
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    await expect(rows.nth(3)).toHaveAttribute("open", "");
  });

  test("keeps keyboard Space and Enter working after a hover open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await goToScene(page, "technical-profile");
    const rows = page.locator(".evidence-ledger details");

    // Hover-open a row, then activate with the keyboard: the native toggle must
    // still apply (the mouse-absorption path must not swallow it).
    const hovered = rows.nth(2).locator("summary");
    await page.locator(".evidence-ledger > li").nth(2).locator(".ledger-source a").focus();
    await hovered.hover();
    await expect(rows.nth(2)).toHaveAttribute("open", "");
    await hovered.focus();
    await page.keyboard.press("Space");
    await expect(rows.nth(2)).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(rows.nth(2)).toHaveAttribute("open", "");
  });

  test("keeps a default-open record closed when keyboard input cancels pending hover", async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.mouse.move(2, 2);
    await goToScene(page, "technical-profile");
    const fresh = page.locator(".evidence-ledger details");
    const defaultOpen = fresh.nth(0).locator("summary");
    await defaultOpen.focus();
    await expect(fresh.nth(0)).toHaveAttribute("open", "");
    const before = await page.evaluate(() => performance.now());
    // Real pointer delivery without locator actionability, which waits on
    // animation frames the paused clock never advances. Move to the measured
    // summary centre so the pointer genuinely enters the row.
    const centre = await defaultOpen.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.move(centre.x, centre.y);
    // Real pointer delivery, but no elapsed timer time: Space genuinely arrives
    // inside the 110ms intent window even on a slow traced renderer.
    expect(await page.evaluate(() => performance.now()) - before).toBeLessThan(110);
    await page.keyboard.press("Space");
    await page.clock.runFor(500);
    await expect(fresh.nth(0)).not.toHaveAttribute("open", "");
    await page.clock.runFor(300);
    await expect(fresh.nth(0)).not.toHaveAttribute("open", "");
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
    await goToScene(page, "technical-profile");
    await page.waitForTimeout(400);

    const second = page.locator(".evidence-ledger details").nth(1);
    await expect(second).not.toHaveAttribute("open", "");

    // Advance the global timeline until the row is visible, then bring it to a
    // comfortable reading position below the header. That is a realistic place to
    // read from, and it is high enough that collapsing the row above (which
    // removes its whole panel) would pull this row out of view. The check and
    // the scroll share one round-trip so a loaded CI engine stays well inside
    // the test budget.
    const nudge = (offset: number) =>
      page.evaluate(async (targetOffset) => {
        const element = document
          .querySelectorAll(".evidence-ledger details")[1]!
          .querySelector("summary")!;
        const box = element.getBoundingClientRect();
        const header = document
          .querySelector(".site-header")!
          .getBoundingClientRect().bottom;
        const visible = box.top >= header && box.bottom <= window.innerHeight;
        const delta = box.top - (header + targetOffset);
        if (!visible || Math.abs(delta) > 2) {
          const scroll =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({
            top: window.scrollY + (visible ? delta : scroll * 0.01),
            behavior: "instant",
          });
          // The pinned stage publishes the new native position on a later frame.
          // Reading the row before that reports the previous pose, so the search
          // would correct from stale feedback and can overshoot the whole scene.
          // Await the published render, exactly as a settled jump does.
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        const settled = element.getBoundingClientRect();
        return {
          top: settled.top,
          bottom: settled.bottom,
          header,
          viewport: window.innerHeight,
        };
      }, offset);

    let placed = await nudge(120);
    for (let step = 0; step < 80; step += 1) {
      const atTarget = Math.abs(placed.top - (placed.header + 120)) <= 2;
      if (atTarget && placed.bottom <= placed.viewport) break;
      placed = await nudge(120);
    }
    // The row must be genuinely reachable; if it is not, the failure is a real
    // navigation defect, not a test artifact.
    expect(placed.top).toBeGreaterThanOrEqual(placed.header + 100);
    expect(placed.top).toBeLessThanOrEqual(placed.header + 140);
    expect(placed.bottom).toBeLessThanOrEqual(placed.viewport);

    // Opening a row must preserve the row being read, not scroll it away. The
    // disclosure animates, so wait for the layout to stop moving before judging
    // where the row actually ends up.
    const readRow = () =>
      page.evaluate(() => {
        const element = document
          .querySelectorAll(".evidence-ledger details")[1]!
          .querySelector("summary")!;
        const box = element.getBoundingClientRect();
        const header = document
          .querySelector(".site-header")!
          .getBoundingClientRect().bottom;
        return {
          top: box.top,
          bottom: box.bottom,
          header,
          viewport: window.innerHeight,
        };
      });
    const staysVisible = async () => {
      let last = NaN;
      let box = await readRow();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        box = await readRow();
        if (box.top === last) break;
        last = box.top;
        await page.waitForTimeout(60);
      }
      expect(box.top).toBeGreaterThanOrEqual(box.header - 1);
      expect(box.bottom).toBeLessThanOrEqual(box.viewport + 1);
    };

    // A genuine touch at the row's currently visible centre. locator.tap runs
    // actionability (scroll-into-view/stable) against the transformed pinned
    // scenes, which fights the timeline; a real touchscreen tap at the measured
    // point is the actual input this test means to deliver. The point must hit
    // the summary, so the tap is never delivered to an obscured target.
    const tapSummary = async () => {
      const point = await page.evaluate(() => {
        const target = document
          .querySelectorAll(".evidence-ledger details")[1]!
          .querySelector("summary")!;
        const box = target.getBoundingClientRect();
        const header = document
          .querySelector(".site-header")!
          .getBoundingClientRect().bottom;
        return {
          x: box.left + box.width / 2,
          y: Math.min(
            Math.max(box.top + box.height / 2, header + 4),
            window.innerHeight - 4,
          ),
        };
      });
      const hitsSummary = await page.evaluate(
        ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("summary"),
        point,
      );
      expect(hitsSummary).toBe(true);
      await page.touchscreen.tap(point.x, point.y);
    };

    // Three consecutive taps: one toggle each, never a doubled toggle.
    await tapSummary();
    await expect(second).toHaveAttribute("open", "");
    await page.waitForTimeout(200);
    await expect(second).toHaveAttribute("open", "");
    await staysVisible();
    await tapSummary();
    await expect(second).not.toHaveAttribute("open", "");
    await tapSummary();
    await expect(second).toHaveAttribute("open", "");
    await page.waitForTimeout(200);
    await expect(second).toHaveAttribute("open", "");
    await staysVisible();
    await context.close();
  });

  test("keeps an opened Profile disclosure inside its scene without dragging progress backward", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);

    // Profile at its scene start, where the second row is visible.
    const profile = TIMELINE[3];
    await page.evaluate((progress) => {
      document.documentElement.style.scrollBehavior = "auto";
      const scroll =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: progress * scroll, behavior: "instant" });
    }, profile.start);
    await page.waitForTimeout(400);

    const read = () =>
      page.evaluate(
        ({ sceneId }) => {
          const scroll =
            document.documentElement.scrollHeight - window.innerHeight;
          const rows = [
            ...document.querySelectorAll(".evidence-ledger details"),
          ];
          const box = rows[1]!.querySelector("summary")!.getBoundingClientRect();
          const work = document
            .querySelector(`[data-scene="${sceneId}"]`)!
            .getBoundingClientRect();
          return {
            progress: window.scrollY / scroll,
            secondTop: box.top,
            secondBottom: box.bottom,
            // The scene before Profile must stay fully off screen.
            previousVisible: work.bottom > 1,
            viewport: window.innerHeight,
          };
        },
        { sceneId: TIMELINE[2].id },
      );

    const before = await read();
    expect(before.progress).toBeCloseTo(profile.start, 2);
    expect(before.previousVisible).toBe(false);

    // A real hover opens the second row and collapses the first above it. The
    // chosen row must stay on screen and the correction must not pull native
    // progress back into the previous scene.
    await page
      .locator(".evidence-ledger details")
      .nth(1)
      .locator("summary")
      .hover();
    await page.waitForTimeout(700);

    const after = await read();
    expect(after.progress).toBeGreaterThanOrEqual(profile.start - 0.001);
    expect(after.progress).toBeLessThan(profile.outStart);
    expect(after.previousVisible).toBe(false);
    expect(after.secondTop).toBeGreaterThanOrEqual(0);
    expect(after.secondBottom).toBeLessThanOrEqual(after.viewport + 1);
  });

  test("keeps one decorative viewport sky across every section and behind a transparent navbar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });

    const field = page.locator(".starfield");
    await expect(field).toHaveCount(1);
    await expect(field).toHaveAttribute("aria-hidden", "true");
    await expect(field).toHaveCSS("pointer-events", "none");
    await expect(field).toHaveCSS("position", "fixed");
    const stars = field.locator(".star");
    expect(await stars.count()).toBeGreaterThanOrEqual(140);
    expect(await stars.count()).toBeLessThanOrEqual(240);
    await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".site-header")).toHaveCSS("backdrop-filter", "none");
    // Keep the rendered sweep in the browser: protocol/trace snapshots between
    // every geometry read otherwise dominate this five-section test.
    const states = await field.evaluate(async (el, timeline) => {
      const original = [...el.querySelectorAll(".star")];
      const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const scroll = document.documentElement.scrollHeight - window.innerHeight;
      const states = [];
      for (const scene of timeline) {
        if (scene.id === "identity") continue;
        const selector = `#${scene.id}`;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: scene.start * scroll, behavior: "instant" });
        await frame();
        const deadline = performance.now() + 5000;
        while (getComputedStyle(el).opacity !== "1" && performance.now() < deadline) await frame();
        const box = el.getBoundingClientRect();
        const current = [...el.querySelectorAll(".star")];
        states.push({
          selector,
          opacity: getComputedStyle(el).opacity,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          sameStars: current.length === original.length && current.every((node, index) => node === original[index]),
        });
      }
      return states;
    }, TIMELINE);
    for (const state of states) {
      expect(state.opacity, state.selector).toBe("1");
      expect(state.box).toEqual({ x: 0, y: 0, width: 1440, height: 1000 });
      expect(state.sameStars).toBe(true);
    }
    expect(await page.locator(".journey canvas").count()).toBe(0);
    await expect(page.locator(".site-header")).toHaveAttribute("data-contact", "true");
    await expect(page.getByRole("navigation").getByRole("link").first()).toHaveCSS("color", "rgb(27, 20, 48)");
    const visibleColors = await stars.evaluateAll(nodes => nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    }).map(node => getComputedStyle(node).color));
    expect(visibleColors.length).toBeGreaterThan(30);
    expect(visibleColors.every(color => color === "rgb(27, 20, 48)")).toBe(true);

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

    const hit = await stars.evaluateAll(nodes => {
      const boxes = nodes.map(node => node.getBoundingClientRect());
      const box = boxes.find(box => box.left > 0 && box.top > 0 && box.right < innerWidth && box.bottom < innerHeight)!;
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest(".starfield") !== null;
    });
    expect(hit).toBe(false);
  });

  test("freezes the viewport sky under reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });

    const stars = page.locator(".starfield .star");
    await expect.poll(() => page.locator(".starfield").evaluate(el => el.getAnimations({ subtree: true }).every(animation => animation.playState === "paused"))).toBe(true);
    const snapshot = () => stars.evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { glyph: node.textContent, x: box.x, y: box.y };
    }));
    const before = await snapshot();
    await page.waitForTimeout(1200);
    expect(await snapshot()).toEqual(before);
  });

  test("pauses and resumes the viewport sky on visibility and preference changes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForSelector(".starfield .star", { timeout: 10_000 });
    await page.waitForTimeout(400);

    const stars = page.locator(".starfield .star");
    const snapshot = () =>
      stars.evaluateAll((els) => els.map((el) => el.textContent).join(""));
    const states = () => page.locator(".starfield").evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.playState));
    const paused = async () => (await states()).every(state => state === "paused");
    const running = async () => (await states()).every(state => state === "running");

    // Running by default.
    expect(await running()).toBe(true);
    const first = await snapshot();
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(first);

    // Hidden document: both the CSS motion and the glyph clock pause.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await paused()).toBe(true);
    const hidden = await snapshot();
    await page.waitForTimeout(1200);
    expect(await snapshot()).toBe(hidden);

    // Visible again: it resumes.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(running, { timeout: 5_000 }).toBe(true);
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(hidden);

    // A live reduced-motion change stops it, and returning resumes it.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(200);
    const reduced = await snapshot();
    await page.waitForTimeout(900);
    expect(await snapshot()).toBe(reduced);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(snapshot, { timeout: 5_000 }).not.toBe(reduced);
  });

  test("gives each section a full viewport without clipping long content", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await goToScene(page, "learning-archive");
    await page.waitForTimeout(400);

    // One round trip for the whole public geometry sweep: the six sequential
    // protocol/layout reads dominated this story on the traced WebKit renderer.
    const geometry = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("main section")].map(
        (section) => section.getBoundingClientRect().height,
      );
      const height = (id: string) =>
        document.getElementById(id)!.getBoundingClientRect().height;
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".archive-statement")!);
      return {
        sections,
        work: height("selected-evidence"),
        profile: height("technical-profile"),
        lines: range.getClientRects().length,
      };
    });
    for (const height of geometry.sections) {
      expect(height).toBeGreaterThanOrEqual(1000);
    }
    expect(geometry.work, "#selected-evidence").toBeGreaterThan(1000);
    expect(geometry.profile, "#technical-profile").toBeGreaterThan(1000);

    // The archive copy is deliberately grouped, never one very long line.
    expect(geometry.lines).toBeGreaterThanOrEqual(3);

    // A taller resize must re-lay the held stack: at native top the Opening
    // keeps the whole screen and Intro begins exactly at its bottom, so no Intro
    // copy can appear inside the held Opening screen. The re-laid transforms
    // arrive on a later frame, so await the settled layout rather than a fixed
    // sleep (software WebKit can take several frames after a resize).
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    const sceneGap = () =>
      page.evaluate(() => {
        const opening = document.querySelector("#identity")!;
        const intro = document.querySelector("#intro")!;
        const introBox = intro.getBoundingClientRect();
        return {
          gap: introBox.top - opening.getBoundingClientRect().bottom,
          openingHeight: opening.getBoundingClientRect().height,
          introCopyTop: Math.min(
            ...[...intro.querySelectorAll("h2, p, a")].map(
              (el) => el.getBoundingClientRect().top,
            ),
          ),
          viewport: window.innerHeight,
        };
      });
    const settledGap = async (viewportHeight: number) => {
      await expect
        .poll(
          async () => {
            const layout = await sceneGap();
            return (
              Math.abs(layout.openingHeight - viewportHeight) < 2 &&
              Math.abs(layout.gap) < 2
            );
          },
          { timeout: 5_000 },
        )
        .toBe(true);
      return sceneGap();
    };
    const short = await settledGap(1000);
    expect(Math.abs(short.gap)).toBeLessThan(2);
    await page.setViewportSize({ width: 1440, height: 1200 });
    const tall = await settledGap(1200);
    expect(Math.abs(tall.gap)).toBeLessThan(2);
    expect(Math.abs(tall.openingHeight - tall.viewport)).toBeLessThan(2);
    // No Intro copy is on the held Opening screen.
    expect(tall.introCopyTop).toBeGreaterThanOrEqual(tall.viewport - 1);

    // The viewport height also decides whether a long scene is held or read. At
    // this height Work overflows, so a small wheel immediately moves it. A
    // taller viewport makes Work exactly one screen, so it holds instead: the
    // same wheel changes the native offset but not the rendered box. Expected
    // positions come from public geometry, never from the app's mapping.
    const work = TIMELINE[2];
    const workStable = work.outStart - work.start;
    const workBox = () =>
      page.evaluate(() => {
        const box = document
          .getElementById("selected-evidence")!
          .getBoundingClientRect();
        return {
          top: box.top,
          overflow: box.height - window.innerHeight,
          y: window.scrollY,
          scroll: document.documentElement.scrollHeight - window.innerHeight,
        };
      });
    const landWork = (fraction: number) =>
      page.evaluate(
        async ({ p, frac }) => {
          document.documentElement.style.scrollBehavior = "auto";
          const scroll =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: p * scroll, behavior: "instant" });
          const host = document.getElementById("selected-evidence")!;
          const want =
            -frac * (host.getBoundingClientRect().height - window.innerHeight);
          for (let i = 0; i < 240; i += 1) {
            if (Math.abs(host.getBoundingClientRect().top - want) < 0.5) break;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
        },
        { p: work.start + workStable * fraction, frac: fraction },
      );
    const wheelWork = async (perPixel: number) => {
      const before = await workBox();
      await page.mouse.wheel(0, 40);
      const settled = await page.evaluate(
        async ({ wantY, wantTop, moved }) => {
          const host = document.getElementById("selected-evidence")!;
          let delivered = false;
          for (let i = 0; i < 240; i += 1) {
            if (!delivered) delivered = Math.abs(window.scrollY - wantY) < 1;
            if (
              delivered &&
              (!moved ||
                Math.abs(host.getBoundingClientRect().top - wantTop) < 0.5)
            )
              return true;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return false;
        },
        {
          wantY: before.y + 40,
          wantTop: before.top - 40 * perPixel,
          moved: perPixel > 0,
        },
      );
      expect(settled).toBe(true);
      return { before, after: await workBox() };
    };

    // A safe empty point, so the wheel never lands on a control.
    await page.mouse.move(5, 200);
    await landWork(0);
    const overflowing = await workBox();
    expect(overflowing.overflow).toBeGreaterThan(100);
    const reads = await wheelWork(
      overflowing.overflow / (workStable * overflowing.scroll),
    );
    expect(reads.before.top - reads.after.top).toBeGreaterThan(1);

    // A resize changes the scene heights immediately, but the controller only
    // re-measures on a later frame; until then the scroll denominator is stale
    // and any placement computed from it is undone by the relayout. The pinned
    // stack is flush (each scene's top meets the previous scene's bottom) at any
    // progress once the new layout has been measured and applied, so that is the
    // observable that says the resize has settled.
    const workSettled = (fit: boolean) =>
      expect
        .poll(
          () =>
            page.evaluate(
              ({ wantFit }) => {
                const scenes = [
                  ...document.querySelectorAll("[data-scene]"),
                ];
                const flush = scenes.every(
                  (scene, index) =>
                    index === 0 ||
                    Math.abs(
                      scene.getBoundingClientRect().top -
                        scenes[index - 1]!.getBoundingClientRect().bottom,
                    ) <= 1,
                );
                const box = document
                  .getElementById("selected-evidence")!
                  .getBoundingClientRect();
                const overflow = box.height - window.innerHeight;
                return (
                  flush && (wantFit ? overflow < 1 : overflow > 100)
                );
              },
              { wantFit: fit },
            ),
          { timeout: 5_000 },
        )
        .toBe(true);

    // A taller viewport makes Work exactly one screen, so it holds: the same
    // wheel changes the native offset but not the rendered box.
    await page.setViewportSize({ width: 1440, height: 1600 });
    await workSettled(true);
    await landWork(0.5);
    const held = await wheelWork(0);
    expect(held.after.y - held.before.y).toBeCloseTo(40, 0);
    expect(Math.abs(held.after.top - held.before.top)).toBeLessThan(1);

    // Shrinking back below the content height makes Work overflow again, so it
    // must resume reading immediately from its scene start.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await workSettled(false);
    await landWork(0);
    const refit = await workBox();
    const readsAgain = await wheelWork(
      refit.overflow / (workStable * refit.scroll),
    );
    expect(readsAgain.before.top - readsAgain.after.top).toBeGreaterThan(1);

    expect(errors).toEqual([]);
  });

  test("gives Let's talk. dominant, heavy, unclipped type", async ({
    page,
  }) => {
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
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
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
      const lead = document
        .querySelector(".intro-lead")!
        .getBoundingClientRect();
      const body = document
        .querySelector(".intro-body")!
        .getBoundingClientRect();
      return Math.abs(
        lead.top + lead.height / 2 - (body.top + body.height / 2),
      );
    });
    expect(delta).toBeLessThanOrEqual(8);
  });

  test("matches the two-group footer reference and keeps back-to-top reachable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    const year = new Date().getFullYear();
    await expect(page.locator(".site-footer")).toHaveCount(5);
    await expect(page.locator("#identity .site-footer")).toHaveCount(0);

    // One batched read of all five footers instead of dozens of per-element
    // round-trips; the assertions below are unchanged.
    const footers = await page.evaluate(() => {
      const read = (element: Element) => {
        const style = getComputedStyle(element);
        const top = element.querySelector(".footer-top");
        return {
          scene:
            element.closest("[data-scene]")?.getAttribute("data-scene") ?? null,
          background: style.backgroundColor,
          borders: [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ],
          name: element.querySelector(".footer-name")?.textContent ?? null,
          copy: element.querySelector(".footer-copy")?.textContent ?? null,
          note: element.querySelector(".footer-note")?.textContent ?? null,
          topText: top?.textContent ?? null,
          topChildren: element.querySelectorAll(".footer-top > *").length,
          innerGroups: element.querySelectorAll(".footer-inner > *").length,
          ariaLabel: top?.getAttribute("aria-label") ?? null,
          title: top?.getAttribute("title") ?? null,
          // No separate visible "Back to top" text group remains.
          exactBackToTop: [...element.querySelectorAll("*")].filter(
            (child) => child.textContent?.trim() === "Back to top",
          ).length,
        };
      };
      return [...document.querySelectorAll(".site-footer")].map(read);
    });

    expect(footers.map((item) => item.scene)).toEqual([
      "intro",
      "selected-evidence",
      "technical-profile",
      "learning-archive",
      "contact-path",
    ]);
    for (const item of footers) {
      // Footers are only text on the surrounding section, not separate bands.
      expect(item.background).toBe("rgba(0, 0, 0, 0)");
      expect(item.borders).toEqual(["0px", "0px", "0px", "0px"]);
      expect(item.topText).toBe("Still learning.");
      expect(item.topChildren).toBe(1);
      // Exactly two groups: identity and the right-hand back-to-top link.
      expect(item.innerGroups).toBe(2);
      // The visible label is kept in the accessible name (Label in Name).
      expect(item.ariaLabel).toBe("Back to top — Still learning.");
      expect(item.title).toBe("Back to top");
      expect(item.exactBackToTop).toBe(0);
    }

    const contact = footers[4];
    expect(contact.name).toBe("Fikri Muhammad Abdillah");
    expect(contact.copy).toBe(`© ${year}`);
    expect(contact.note).toContain("Still learning.");

    // Reach the Contact footer through the product's own navigation, then use
    // its back-to-top link.
    await page.locator('.site-header a[href="#contact-path"]').click();
    const top = page.locator("#contact-path .footer-top");
    await expect(top).toBeVisible();
    const box = await top.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await top.click();
    await expect(page).toHaveURL(/#identity$/);
  });

  test("keeps the footer text within the section's readable measure", async ({
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
    // A transparent layout wrapper aligns the text without adding a surface.
    expect(metrics.footerWidth).toBe(metrics.viewport);
    expect(metrics.innerWidth).toBeLessThan(metrics.footerWidth);
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
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute(
      "content",
      /Fikri Muhammad Abdillah.*TypeScript.*public source material/,
    );
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

    // No horizontal overflow, and the name reaches the footer at every width.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(page.locator(".footer-name")).toHaveText(
      Array(5).fill("Fikri Muhammad Abdillah"),
    );

    // The archive statement stays a multi-line block, not a single long line.
    const lines = await page.locator(".archive-statement").evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length;
    });
    expect(lines).toBeGreaterThanOrEqual(2);

    // All six evidence records and three projects survive.
    await expect(page.locator(".evidence-ledger > li")).toHaveCount(6);
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await expect(page.locator("#contact-path .contact-paths a")).toHaveCount(3);
  });
}

for (const width of [1440, 390]) {
  test(`clips outgoing foreground under the measured transparent header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");
    const scrollToProgress = async (value: number) => {
      await page.evaluate((p) => {
        document.documentElement.style.scrollBehavior = "auto";
        const scroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: p * scroll, behavior: "instant" });
      }, value);
      await page.waitForTimeout(300);
    };

    // In the middle of each transition the outgoing screen's foreground is
    // clipped exactly to the header, so its copy cannot pass under the nav.
    for (const value of [0.135, 0.265, 0.495]) {
      await scrollToProgress(value);
      await expect.poll(() => page.evaluate(() => {
        const bottom = document.querySelector(".site-header")!.getBoundingClientRect().bottom;
        return [...document.querySelectorAll("[data-scene] .section-content, [data-scene] .site-footer")].every(element => {
          const box = element.getBoundingClientRect();
          // Only visible foreground can pass under the nav; a fully scrolled-out
          // screen is irrelevant.
          if (box.bottom <= 0) return true;
          const clip = getComputedStyle(element).clipPath;
          if (box.top >= bottom) return clip === "none";
          const cut = Number(clip.match(/^inset\(([\d.]+)px/)?.[1]);
          return Math.abs(cut - Math.min(box.height, bottom - box.top)) < 1;
        });
      })).toBe(true);
    }

    await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".site-header")).toHaveCSS("backdrop-filter", "none");
    await expect(page.locator("#identity")).toHaveCSS("clip-path", "none");
    // The persistent sky is never masked by the foreground clip.
    await expect(page.locator(".sky-plane")).toHaveCSS("clip-path", "none");

    // A Source focused from the clipped band must bring its complete keyboard
    // ring below the responsive header.
    await scrollToProgress(0.62);
    const source = page.locator(".evidence-ledger > li").nth(3).locator(".ledger-source a");
    await source.focus();
    await expect(source).toBeFocused();
    await expect.poll(() => source.evaluate(element => {
      const style = getComputedStyle(element);
      const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      return element.getBoundingClientRect().top - ring - document.querySelector(".site-header")!.getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(0);
  });
}

test.describe("full-page transitions", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  // The whole page shares ONE global progress: scrollY / (scrollHeight -
  // innerHeight), 0 at the Opening and 1 at the Contact bottom. Sections hold
  // their initial view while they are read and scrub to the next slide across a
  // short outgoing window. Native scrolling is free: nothing snaps or completes
  // a gesture.
  //
  // Two animation frames after the jump guarantee the controller's pinned render
  // has applied the new position, so callers read the settled layout rather than
  // a stale one. A fixed sleep cannot promise that on a slow renderer.
  const scrollToProgress = async (page: Page, value: number) => {
    await page.evaluate(async (p) => {
      document.documentElement.style.scrollBehavior = "auto";
      const scroll =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: p * scroll, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }, value);
  };

  test("keeps genuine Tab progression inside the global timeline, with no inner stage scroll", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");

    // A pointerdown on non-focusable background must not leave the controller
    // in "pointer" modality: the next keyboard Tab is keyboard-driven and must
    // still be placed. Click empty sky, then Tab forward as usual below.
    await page.mouse.click(30, 500);

    // The clipped stage must never become an independent scroll container:
    // focus navigation maps a target onto global progress instead.
    const readState = () =>
      page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        const box = element?.getBoundingClientRect();
        const headerBottom =
          document.querySelector(".site-header")?.getBoundingClientRect()
            .bottom ?? 0;
        return {
          stageScrollTop:
            document.querySelector(".journey .stage")?.scrollTop ?? null,
          scene:
            element?.closest("[data-scene]")?.getAttribute("data-scene") ?? null,
          visible:
            !!box &&
            box.bottom > 0 &&
            box.top >= headerBottom - 2 &&
            box.bottom <= window.innerHeight + 2,
        };
      });

    let reachedProfile = false;
    for (let index = 0; index < 40 && !reachedProfile; index += 1) {
      await page.keyboard.press("Tab");
      // An already-visible control keeps its position; an offscreen reveal needs
      // a frame or more for the pinned render to catch up. Await the observable
      // placement rather than a fixed reread delay.
      let state = await readState();
      if (state.scene && !state.visible) {
        await expect
          .poll(async () => (await readState()).visible, { timeout: 5_000 })
          .toBe(true);
        state = await readState();
      }
      expect(state.stageScrollTop, `tab ${index + 1}`).toBe(0);
      if (!state.scene) continue;
      // Every control the keyboard reaches is actually revealed at its own read
      // position, including deep inside the long Work/Profile scenes.
      expect(state.visible, `tab ${index + 1} in ${state.scene}`).toBe(true);
      if (state.scene === "technical-profile") reachedProfile = true;
    }
    expect(reachedProfile).toBe(true);
  });

  test("leaves a focused scene link in place under a small genuine wheel", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");

    // Sit at the end of the Work reading interval, where the first project
    // Source link is below the fold. Focusing it makes the controller place its
    // real ring just below the header.
    const workEnd = TIMELINE[2].outStart - 0.01;
    await page.evaluate((progress) => {
      document.documentElement.style.scrollBehavior = "auto";
      const scroll =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: progress * scroll, behavior: "instant" });
    }, workEnd);

    const source = page.locator("#selected-evidence .project-link").first();
    await source.focus();
    await expect(source).toBeFocused();
    // Wait until the deferred placement has actually run: the whole control,
    // including its ring, is exposed below the header AND it sits immediately
    // under it. Only then is a small wheel meaningful — a 20px nudge crosses the
    // ring. Without awaiting the placement itself, a fast round-trip could send
    // the wheel while the focus correction is still pending and cancel it.
    const readPlacement = () =>
      source.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const ring =
          (parseFloat(style.outlineWidth) || 0) +
          (parseFloat(style.outlineOffset) || 0);
        const header = document
          .querySelector(".site-header")!
          .getBoundingClientRect().bottom;
        const top = box.top - header;
        return {
          top,
          ring,
          inViewport: box.bottom + ring <= window.innerHeight,
          // The complete ring is exposed below the header, and the control is
          // placed immediately under it.
          placed: top - ring >= 0 && top <= 24,
        };
      });
    await expect
      .poll(async () => {
        const p = await readPlacement();
        return p.inViewport && p.placed;
      })
      .toBe(true);
    const placement = await readPlacement();
    expect(placement.top - placement.ring).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeLessThanOrEqual(24);

    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.move(700, 400);
    // A small genuine wheel while the link stays focused: the full movement must
    // survive. The old render-time correction would undo it immediately. Native
    // wheel scroll lands on a later frame, so await its arrival before reading.
    await page.mouse.wheel(0, 20);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeCloseTo(y0 + 20, 0);
    const y1 = await page.evaluate(() => window.scrollY);
    expect(y1).toBeCloseTo(y0 + 20, 0);
    await expect(source).toBeFocused();
    // No idle completion: the offset holds where the wheel left it.
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(y1, 0);
  });

  test("lands deep links, same-hash navigation and footer anchors on the scene start", async ({
    page,
  }) => {
    const progress = () =>
      page.evaluate(() => {
        const scroll =
          document.documentElement.scrollHeight - window.innerHeight;
        return Number((window.scrollY / scroll).toFixed(3));
      });
    const stageScrollTop = () =>
      page.evaluate(
        () => document.querySelector(".journey .stage")?.scrollTop ?? null,
      );

    // A deep link is honoured on load, before any click. `__afterHoursMotionReady`
    // means setup completed, not that the initial placement has settled (the
    // native fragment scroll can land a frame later), so await the settled
    // landing rather than sampling immediately.
    await page.goto("/#selected-evidence");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await expect
      .poll(progress, { timeout: 5_000 })
      .toBeCloseTo(TIMELINE[2].start, 2);
    expect(await stageScrollTop()).toBe(0);

    // Repeating the same hash still lands on the same scene start.
    const navLink = page.locator('.site-header a[href="#selected-evidence"]');
    await navLink.click();
    await navLink.click();
    expect(await progress()).toBeCloseTo(TIMELINE[2].start, 2);
    expect(await stageScrollTop()).toBe(0);

    // A footer anchor at the end of the long Work scene navigates through the
    // same explicit path, never through a native jump inside the clipped stage.
    const footerLink = page
      .locator('[data-scene="selected-evidence"] .site-footer a[href^="#"]')
      .first();
    const target = await footerLink.getAttribute("href");
    // The footer sits at the end of the section, so reveal it the way a keyboard
    // visitor would before using it. The nav clicks above left a pointer mark
    // that suppresses a programmatic focus placement, so establish genuine
    // keyboard modality first: a real key clears that mark, exactly as tabbing
    // in from the nav does.
    await page.keyboard.press("Tab");
    await footerLink.focus();
    // Await the placement itself: the footer anchor is fully exposed below the
    // header and the measured centre actually receives it, so the click is a
    // genuine activation of the visible control.
    const placed = () =>
      footerLink.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const header = document
          .querySelector(".site-header")!
          .getBoundingClientRect().bottom;
        return {
          visible:
            box.bottom > 0 &&
            box.top >= header &&
            box.bottom <= window.innerHeight,
          hit: Boolean(
            document
              .elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2,
              )
              ?.closest("a"),
          ),
        };
      });
    await expect
      .poll(async () => {
        const state = await placed();
        return state.visible && state.hit;
      }, { timeout: 5_000 })
      .toBe(true);
    await footerLink.click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => location.hash)).toBe(target);
    expect(await stageScrollTop()).toBe(0);
  });

  test("holds each short section through its stable interval, then scrubs to the next", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");

    // The Intro holds its whole screen while read: the section top stays pinned
    // at the viewport top and its content does not move. Points come from the
    // configured timeline, not from the human's illustrative 20–25% example.
    const intro = TIMELINE[1];
    const midTransition = (intro.outStart + intro.outEnd) / 2;
    const held = () =>
      page.evaluate(() => {
        const scene = document.querySelector("#intro")!;
        const heading = document.querySelector("#intro-heading")!;
        return {
          top: Math.round(scene.getBoundingClientRect().top),
          headingTop: Math.round(heading.getBoundingClientRect().top),
        };
      });

    await scrollToProgress(page, intro.start + (intro.outStart - intro.start) * 0.3);
    const early = await held();
    await scrollToProgress(page, intro.outStart - 0.005);
    const late = await held();
    expect(Math.abs(early.top)).toBeLessThan(2);
    expect(Math.abs(late.top)).toBeLessThan(2);
    expect(Math.abs(late.headingTop - early.headingTop)).toBeLessThan(2);

    // Mid-transition both screens are on stage: the outgoing Intro has lifted
    // and the incoming Work is already arriving, before either has settled.
    await scrollToProgress(page, midTransition);
    const middle = await page.evaluate(() => ({
      introTop: Math.round(document.querySelector("#intro")!.getBoundingClientRect().top),
      workTop: Math.round(
        document.querySelector("#selected-evidence")!.getBoundingClientRect().top,
      ),
    }));
    expect(middle.introTop).toBeLessThan(-8);
    expect(middle.workTop).toBeGreaterThan(8);

    // Across the end of the outgoing window the next slide has settled.
    await scrollToProgress(page, intro.outEnd);
    const settled = await page.evaluate(() => ({
      workTop: Math.round(
        document.querySelector("#selected-evidence")!.getBoundingClientRect().top,
      ),
      gather: Number(
        (document.querySelector(".sculpture") as HTMLElement).dataset.gather,
      ),
    }));
    expect(Math.abs(settled.workTop)).toBeLessThan(2);
    expect(settled.gather).toBe(0);
  });

  test("reads a taller-than-viewport section immediately, with no hold at either end", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");

    // Work and Profile are taller than the viewport, so their whole stable
    // interval reads them. Every expectation comes from public geometry: the
    // scene's own rendered overflow and the native scroll the wheel delivers.
    const read = (id: string) =>
      page.evaluate((sceneId) => {
        const box = document.getElementById(sceneId)!.getBoundingClientRect();
        return {
          top: box.top,
          overflow: box.height - window.innerHeight,
          y: window.scrollY,
          scroll: document.documentElement.scrollHeight - window.innerHeight,
        };
      }, id);

    // One safe empty point for the whole story: the margin never hovers a
    // control, so a wheel cannot land on a Source link, and no per-wheel pointer
    // round trip is spent.
    await page.mouse.move(5, 200);

    // Land on a read fraction and synchronize on the observable result: the
    // scene's rendered top reaches the linear read position the settled design
    // predicts. The wait runs in the page on animation frames, so it costs one
    // round trip and never a fixed sleep.
    const land = async (id: string, progress: number, fraction: number) =>
      page.evaluate(
        async ({ sceneId, p, frac }) => {
          document.documentElement.style.scrollBehavior = "auto";
          const scroll =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: p * scroll, behavior: "instant" });
          const host = document.getElementById(sceneId)!;
          const overflow = host.getBoundingClientRect().height - window.innerHeight;
          const want = -frac * overflow;
          for (let i = 0; i < 240; i += 1) {
            if (Math.abs(host.getBoundingClientRect().top - want) < 0.5) break;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const box = host.getBoundingClientRect();
          return {
            top: box.top,
            overflow,
            y: window.scrollY,
            scroll,
          };
        },
        { sceneId: id, p: progress, frac: fraction },
      );

    // A small genuine wheel. Await its real native delivery, then the settled
    // pinned render, which for an overflowing scene is the independently
    // predicted linear movement. A held scene moves nothing, so there is no
    // observable position to poll for; it settles on one frame after delivery.
    const wheelMove = async (id: string, delta: number, perPixel: number) => {
      const before = await read(id);
      await page.mouse.wheel(0, delta);
      const settled = await page.evaluate(
        async ({ sceneId, wantY, wantTop, moved }) => {
          const host = document.getElementById(sceneId)!;
          let delivered = false;
          for (let i = 0; i < 240; i += 1) {
            if (!delivered) delivered = Math.abs(window.scrollY - wantY) < 1;
            const top = host.getBoundingClientRect().top;
            if (delivered) {
              if (!moved || Math.abs(top - wantTop) < 0.5) return true;
            }
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return false;
        },
        {
          sceneId: id,
          wantY: before.y + delta,
          wantTop: before.top - delta * perPixel,
          moved: perPixel > 0,
        },
      );
      expect(settled, `${id} wheel settled`).toBe(true);
      const after = await read(id);
      return { before, after, moved: before.top - after.top };
    };

    for (const scene of [TIMELINE[2], TIMELINE[3]]) {
      const stable = scene.outStart - scene.start;
      // A small wheel immediately after landing must move the box: a held
      // section would report no movement at its own start.
      const landed = await land(scene.id, scene.start, 0);
      expect(landed.overflow, scene.id).toBeGreaterThan(100);
      expect(Math.abs(landed.top), scene.id).toBeLessThan(2);
      const perPixel = landed.overflow / (stable * landed.scroll);
      const early = await wheelMove(scene.id, 40, perPixel);
      expect(early.moved, `${scene.id} early`).toBeGreaterThan(1);
      expect(early.moved, `${scene.id} early`).toBeCloseTo(
        (early.after.y - early.before.y) * perPixel,
        0,
      );

      // A small wheel near the end of the stable interval must still move it:
      // a mapping that clamped the physical offset would have pinned the box at
      // its overflow and reported no movement here.
      const nearEnd = await land(scene.id, scene.start + stable * 0.9, 0.9);
      expect(nearEnd.top, `${scene.id} late`).toBeLessThan(-40);
      const late = await wheelMove(scene.id, 40, perPixel);
      expect(late.moved, `${scene.id} late`).toBeGreaterThan(1);
      expect(late.moved, `${scene.id} late`).toBeCloseTo(
        (late.after.y - late.before.y) * perPixel,
        0,
      );
    }
  });

  test("leaves a real partial gesture in place with no idle auto-completion", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");

    // A genuine wheel gesture that stops inside the Intro's outgoing transition,
    // then settles. No completion, snap or idle motion may move it afterward.
    const settle = async () => {
      let last = await page.evaluate(() => window.scrollY);
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(150);
        const now = await page.evaluate(() => window.scrollY);
        if (Math.abs(now - last) < 0.5) return now;
        last = now;
      }
      return last;
    };
    const progress = () =>
      page.evaluate(() => {
        const scroll =
          document.documentElement.scrollHeight - window.innerHeight;
        return window.scrollY / scroll;
      });

    // Stop just before the transition, then wheel to its midpoint so the gesture
    // genuinely ends mid-scrub instead of inside a hold.
    const scrollDistance = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const beforeTransition = TIMELINE[1].outStart - 0.015;
    await scrollToProgress(page, beforeTransition);
    await page.mouse.move(700, 400);
    const beforeWheel = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(
      0,
      Math.round(
        ((TIMELINE[1].outStart + TIMELINE[1].outEnd) / 2 - beforeTransition) *
          scrollDistance,
      ),
    );
    // Await the wheel's actual delivery before settling; a fixed wait can read
    // the pre-wheel position while native scroll is still in flight.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(beforeWheel);
    const entered = await settle();
    const enteredProgress = await progress();
    expect(entered).toBeGreaterThan(0);
    expect(enteredProgress).toBeGreaterThan(TIMELINE[1].outStart);
    expect(enteredProgress).toBeLessThan(TIMELINE[1].outEnd);
    // Idle: the raw offset is unchanged, so no gesture completion ran.
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(entered, 0);

    // The reverse direction behaves the same: a real upward wheel holds where
    // it stopped, even across the transition boundary. Await the wheel's actual
    // arrival before settling, so an absent delivery cannot look like a hold.
    const beforeReverse = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -260);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeLessThan(beforeReverse);
    const backed = await settle();
    expect(backed).toBeLessThan(entered);
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(backed, 0);
  });

  test("moves the original stars with real scroll speed and direction", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".starfield .star");
    await page.mouse.move(700, 400);

    // The DOM stars carry real WAAPI drift; read their actual playback rate.
    const rates = () =>
      page.evaluate(() =>
        document
          .querySelector(".starfield")!
          .getAnimations({ subtree: true })
          .map((animation) => animation.playbackRate),
      );
    // Record the real drift playback rate on the scroll event itself, after the
    // app's own listeners have committed it. A remote rAF read can miss a brief
    // pulse (the rate decays ~140ms after input stops), so sampling the actual
    // event keeps the assertion about the real animation state. The recorder
    // stays installed for the whole test and is reset per sample.
    await page.evaluate(() => {
      const host = document.querySelector(".starfield")!;
      const state = {
        min: Infinity,
        max: -Infinity,
        events: 0,
        lastY: -1,
        lastAt: -Infinity,
      };
      (window as unknown as { __rate: typeof state }).__rate = state;
      const onScroll = () => {
        const values = host
          .getAnimations({ subtree: true })
          .map((animation) => animation.playbackRate);
        if (values.length) {
          state.min = Math.min(state.min, ...values);
          state.max = Math.max(state.max, ...values);
        }
        state.events += 1;
        state.lastY = window.scrollY;
        state.lastAt = performance.now();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    });
    type RateState = {
      min: number;
      max: number;
      events: number;
      lastY: number;
      lastAt: number;
    };
    const resetRecorder = () =>
      page.evaluate(() => {
        const state = (window as unknown as { __rate: RateState }).__rate;
        state.min = Infinity;
        state.max = -Infinity;
        state.events = 0;
        state.lastY = -1;
      });
    const readRecorder = () =>
      page.evaluate(() => (window as unknown as { __rate: RateState }).__rate);
    // A native gesture is only finished once the engine stops delivering scroll
    // events for it: WebKit delivers one wheel as several scroll events (measured
    // here: a second, small event 232ms after the first), and every one of them
    // restarts the controller's 140ms decay. Sampling before that quiet window
    // reports a still-decaying rate for a gesture that has not finished
    // arriving, which is not the idle state this test asserts.
    const awaitGestureDelivered = () =>
      expect
        .poll(
          () =>
            page.evaluate(() => {
              const state = (window as unknown as { __rate: RateState }).__rate;
              return (
                performance.now() - state.lastAt >= 400 &&
                state.lastY === window.scrollY
              );
            }),
          { timeout: 5_000 },
        )
        .toBe(true);

    const settleIdle = async () => {
      // The elapsed idle window starts after the gesture has finished arriving,
      // then runs for its full length, so two samples cannot be confused.
      await awaitGestureDelivered();
      await page.waitForTimeout(600);
      const values = await rates();
      return { max: Math.max(...values), min: Math.min(...values) };
    };

    // Perform a genuine wheel gesture and record the real drift rate throughout
    // its whole native delivery.
    const sample = async (delta: number) => {
      const before = await page.evaluate(() => window.scrollY);
      await resetRecorder();
      await page.mouse.wheel(0, delta);
      // Await the recorder's own matching native scroll event at the position
      // the page actually holds: WebKit can publish the position before event
      // delivery, so requiring the recorded lastY to equal the live scrollY
      // proves the rate was captured on the real, matching event.
      await expect
        .poll(
          () =>
            page.evaluate(
              (expectedBefore) => {
                const state = (window as unknown as { __rate: RateState })
                  .__rate;
                return (
                  state.events > 0 &&
                  state.lastY !== expectedBefore &&
                  state.lastY === window.scrollY
                );
              },
              before,
            ),
          { timeout: 5_000 },
        )
        .toBe(true);
      await awaitGestureDelivered();
      const recorded = await readRecorder();
      return { before, after: await page.evaluate(() => window.scrollY), ...recorded };
    };

    // A slow gesture accelerates the drift only modestly.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });
    const slow = await sample(60);
    expect(slow.after).not.toBe(slow.before);
    await settleIdle();

    // A fast gesture accelerates it much more.
    const fast = await sample(900);
    expect(fast.after).not.toBe(fast.before);
    expect(fast.max).toBeGreaterThan(slow.max);
    expect(fast.max).toBeGreaterThan(1.5);

    // Reverse runs the real drift animations backward (signed rate).
    await settleIdle();
    const reverse = await sample(-900);
    expect(reverse.after).toBeLessThan(reverse.before);
    expect(reverse.min).toBeLessThan(0);

    // Idle drift resumes when input stops.
    const idle = await settleIdle();
    expect(idle.max).toBeLessThan(2);
    expect(idle.min).toBeGreaterThanOrEqual(0);
  });

  test("keeps the original sampled cloud composited behind a later section", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    await page.waitForSelector(".sky-plane .sculpture-canvas");
    // A settled later screen, with the violet Contact surface visible. Await the
    // scene arrival and the Contact reveal completion (opacity 1, y 0) before
    // freezing, so no foreground tween is still in flight.
    await scrollToProgress(page, 0.95);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const scene = document.querySelector("#contact-path")!;
            const targets = [...scene.querySelectorAll<HTMLElement>("[data-reveal]")];
            return (
              Math.abs(scene.getBoundingClientRect().top) < 2 &&
              targets.every((target) => {
                const matrix = new DOMMatrix(getComputedStyle(target).transform);
                return (
                  Number(getComputedStyle(target).opacity) >= 0.999 &&
                  Math.abs(matrix.m42) < 0.5
                );
              })
            );
          }),
        { timeout: 5_000 },
      )
      .toBe(true);

    const canvas = page.locator(".sky-plane .sculpture-canvas");
    await expect(canvas).toBeVisible();
    // The original cloud is still painting its own buffer.
    const painted = await canvas.evaluate((element) => {
      const c = element as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 16) count += 1;
      return count;
    });
    expect(painted).toBeGreaterThan(200);

    // Freeze every rendered clock first, so an A/B/A2 comparison isolates the
    // canvas's own compositing rather than confounding ambient motion.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Let the freeze take effect on a rendered frame.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    // Visible-output proof: with the original canvas shown the rendered frame
    // differs from the same frozen frame with the canvas hidden, and restoring
    // the canvas reproduces the exact original frame. Compare decoded RGBA
    // pixels, not PNG encoding bytes, so the result reflects what is drawn.
    const clip = { x: 0, y: 0, width: 1440, height: 1000 };
    const comparePixels = (a: Buffer, b: Buffer) =>
      page.evaluate(
        async ({ first, second }) => {
          const decode = async (base64: string) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const surface = document.createElement("canvas");
            surface.width = image.naturalWidth;
            surface.height = image.naturalHeight;
            const ctx = surface.getContext("2d")!;
            ctx.drawImage(image, 0, 0);
            return ctx.getImageData(0, 0, surface.width, surface.height).data;
          };
          const [one, two] = await Promise.all([
            decode(first),
            decode(second),
          ]);
          if (one.length !== two.length) return { equal: false, changed: -1 };
          let changed = 0;
          for (let i = 0; i < one.length; i += 1) {
            if (one[i] !== two[i]) changed += 1;
          }
          return { equal: changed === 0, changed };
        },
        { first: a.toString("base64"), second: b.toString("base64") },
      );

    const shown = await page.screenshot({ clip });
    await canvas.evaluate((element) => {
      (element as HTMLCanvasElement).style.visibility = "hidden";
    });
    await page.waitForTimeout(120);
    const hidden = await page.screenshot({ clip });
    await canvas.evaluate((element) => {
      (element as HTMLCanvasElement).style.visibility = "";
    });
    await page.waitForTimeout(120);
    const restored = await page.screenshot({ clip });

    const restoredMatch = await comparePixels(shown, restored);
    expect(restoredMatch.equal).toBe(true);
    const hiddenDiff = await comparePixels(shown, hidden);
    expect(hiddenDiff.equal).toBe(false);
    expect(hiddenDiff.changed).toBeGreaterThan(0);

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  });

  test("animates a Source-hover disclosure and reverses it without stranding content", async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto("/");
    await page.waitForFunction(() => window.__afterHoursMotionReady);
    // Reach the Profile scene through the global timeline (native scrollIntoView
    // cannot move the transformed pinned scenes), then let the controller render.
    await goToScene(page, "technical-profile");
    await page.clock.runFor(60);
    const row = page.locator(".evidence-ledger > li").nth(2);
    const panel = row.locator(".ledger-panel");
    // Focus settles this row's entrance through the page's public keyboard
    // behavior; unrelated reveal/sky frames need not advance before the test.
    await row.locator(".ledger-source a").focus();
    await row.locator(".ledger-source a").hover();
    // Render through the 110ms hover intent before sampling its opening tween.
    await page.clock.runFor(210);
    const middle = await panel.evaluate(el => ({
      height: el.getBoundingClientRect().height,
      naturalHeight: el.querySelector("dl")!.getBoundingClientRect().height,
    }));
    expect(middle.height).toBeGreaterThan(2);
    expect(middle.height).toBeLessThan(middle.naturalHeight - 2);
    // Keyboard closes a mid-flight panel, not just a fully settled one.
    await row.locator("summary").focus();
    await page.keyboard.press("Space");
    await page.clock.fastForward(100);
    expect(
      await panel.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThan(middle.height);
    await page.clock.fastForward(400);
    await expect(row.locator("details")).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await page.clock.fastForward(400);
    const settled = await row.evaluate(el => ({
      height: el.querySelector(".ledger-panel")!.getBoundingClientRect().height,
      naturalHeight: el.querySelector("dl")!.getBoundingClientRect().height,
      evidence: el.querySelector("dd")!.textContent?.trim(),
      openRecords: document.querySelectorAll(".evidence-ledger details[open]").length,
    }));
    expect(Math.abs(settled.height - settled.naturalHeight)).toBeLessThan(2);
    expect(settled.evidence).toBe(OBSERVED_EVIDENCE[2]);
    expect(settled.openRecords).toBe(1);

    // Source navigation still works; no real external request is needed.
    await page.route(repositoryUrls.JMC, (route) =>
      route.fulfill({ status: 200, body: "source" }),
    );
    await row.locator(".ledger-source a").click();
    await expect(page).toHaveURL(repositoryUrls.JMC);
  });
});
