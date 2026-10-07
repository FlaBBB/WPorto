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
    await expect(page).toHaveTitle("Fikri Flab — Projects and Play");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Building things\.\s*Learning out loud\./,
    );
    await expect(page.getByRole("link", { name: "Fikri Flab — back to top" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Technical Profile",
      "Selected Work",
      "Learning, out in the open.",
      "Say hello.",
    ]);

    await page.locator("#profile-sources > summary").focus();
    await page.keyboard.press("Enter");
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
    await expect(page.locator(".hero-image")).toBeVisible();
    await expect(page.locator(".hero-image")).toHaveCSS("transform", "none");
    for (const layer of await page.locator(".hero-layer").all())
      await expect(layer).toHaveCSS("transform", "none");
    expect(await page.locator(".hero-image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1728);
  });
});

test("composes genuinely transparent image layers without a hero frame", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".hero-art");
  await expect(field).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(field).toHaveCSS("background-image", "none");
  await expect(field).toHaveCSS("border-radius", "0px");
  await expect(field).toHaveCSS("overflow", "visible");
  await expect(page.locator(".hero-layer")).toHaveCount(4);
  expect(await page.locator(".hero-layer").evaluateAll(elements => elements.map(el => getComputedStyle(el).zIndex))).toEqual(["0", "1", "2", "3"]);
  const images = await field.locator("img").evaluateAll(async (elements) => {
    return Promise.all(elements.map(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let solidPixels = 0;
      for (let index = 3; index < data.length; index += 4)
        if (data[index] > 200) solidPixels += 1;
      return {
        width: canvas.width,
        height: canvas.height,
        corners: [data[3], data[canvas.width * 4 - 1], data[(canvas.height - 1) * canvas.width * 4 + 3], data[data.length - 1]],
        center: data[(Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4 + 3],
        solidPixels,
      };
    }));
  });
  for (const image of images) {
    expect([image.width, image.height]).toEqual([1728, 1152]);
    expect(image.corners).toEqual([0, 0, 0, 0]);
    expect(image.solidPixels).toBeGreaterThan(1000);
  }
  expect(images[1].solidPixels).toBeGreaterThan(500000);
  expect(images[1].center).toBeGreaterThan(200);
  for (const image of [images[0], images[2]]) {
    expect(image.solidPixels).toBeLessThan(200000);
    expect(image.center).toBe(0);
  }
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
    "Fikri Flab — Projects and Play",
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
    contact.getByRole("link", { name: "GitHub" }),
  ).toHaveAttribute("href", "https://github.com/FlaBBB");
  await expect(
    contact.getByRole("link", { name: "LinkedIn" }),
  ).toHaveAttribute("href", "https://www.linkedin.com/in/fikri-flab/");
  await expect(
    contact.getByRole("link", { name: "Email" }),
  ).toHaveAttribute("href", "mailto:f12345ff67@gmail.com");
  await expect(
    page.getByRole("link", {
      name: "Inspect public work (opens in a new tab)",
    }),
  ).toHaveAttribute("target", "_blank");
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
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Explore projects" }),
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
      links.map((link) => link.textContent),
    );
  expect(navigationLabels).toEqual(["Work", "Profile", "Contact"]);
});

test("uses native keyboard disclosure without hiding sources", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#profile-sources > summary").focus();
  await page.keyboard.press("Enter");
  const rows = technicalProfileRows(page);
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

test("opens Sources & scope from the work qualification link without header overlap", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#profile-sources")).not.toHaveAttribute("open", "");
  await page.locator(".work-scope a").click();
  await expect(page).toHaveURL(/#profile-sources$/);
  await expect(page.locator("#profile-sources")).toHaveAttribute("open", "");
  await expect(technicalProfileRows(page).first().locator(".ledger-details")).toBeVisible();
  const summary = await page.locator("#profile-sources > summary").boundingBox();
  const header = await page.locator(".site-header").boundingBox();
  expect(summary?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
});

test("provides the Reduced-Motion Alternate and handles preference changes after load", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const image = page.locator(".hero-image");
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("transform", "none");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  await page.locator("#profile-sources > summary").click();
  const thirdRow = technicalProfileRows(page).nth(2);
  await thirdRow.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(thirdRow.locator(".ledger-details")).toBeVisible();
  const position = await page.evaluate(() => window.scrollY);
  expect(position).toBeGreaterThan(100);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => image.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
  const field = await page.locator(".hero-art").boundingBox();
  if (!field) throw new Error("Hero illustration missing");
  await page.locator(".hero-art").dispatchEvent("pointermove", { clientX: field.x + field.width * 0.9, clientY: field.y + field.height * 0.2, pointerType: "mouse" });
  await expect.poll(() => image.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeGreaterThan(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const layer of await page.locator(".hero-layer").all())
    await expect(layer).toHaveCSS("transform", "none");
  await expect(page.locator(".hero-visual")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-copy h1")).toHaveCSS("opacity", "1");
  await page.locator(".hero-art").dispatchEvent("pointermove", { clientX: 900, clientY: 150, pointerType: "mouse" });
  await expect(image).toHaveCSS("transform", "none");
  await expect(thirdRow.locator("details")).toHaveAttribute("open", "");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => image.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
});

test("moves separate layers at different depths and resets on pointer leave", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const image = page.locator(".hero-image");
  await expect(page.locator(".hero-visual")).toHaveCSS("transform", "none");
  const field = await page.locator(".hero-art").boundingBox();
  if (!field) throw new Error("Hero illustration missing");
  await page.mouse.move(
    field.x + field.width * 0.9,
    field.y + field.height * 0.2,
  );
  const translation = () =>
    image.evaluate((el) => {
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
  await expect
    .poll(async () => Math.abs((await translation()).x - 14.4))
    .toBeLessThan(0.2);
  await expect
    .poll(async () => Math.abs((await translation()).y + 10.8))
    .toBeLessThan(0.2);
  for (const [selector, x, y] of [
    [".hero-backdrop", -5.04, 3.78],
    [".hero-crystals-back", 7.2, -5.4],
    [".hero-crystals-front", 23.04, -17.28],
  ] as const) {
    await expect.poll(async () => Math.abs(await page.locator(selector).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41) - x)).toBeLessThan(0.2);
    await expect.poll(async () => Math.abs(await page.locator(selector).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42) - y)).toBeLessThan(0.2);
  }
  await page.mouse.move(1, 1);
  await expect
    .poll(async () => Math.abs((await translation()).x))
    .toBeLessThan(0.1);
  await expect
    .poll(async () => Math.abs((await translation()).y))
    .toBeLessThan(0.1);

  await page.locator(".hero-art").dispatchEvent("pointermove", {
    clientX: field.x + field.width,
    clientY: field.y,
    pointerType: "touch",
  });
  await page.waitForTimeout(650);
  for (const layer of await page.locator(".hero-layer").all()) {
    const matrix = await layer.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).toFloat64Array());
    expect(Math.abs(matrix[12])).toBeLessThan(0.1);
    expect(Math.abs(matrix[13])).toBeLessThan(0.1);
  }
});

test("reveals project work on scroll and reverts when reduced motion interrupts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/");
  const project = page.locator("#selected-evidence article").first();
  expect((await project.boundingBox())?.y).toBeGreaterThan(600);
  await expect.poll(() => project.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeCloseTo(24);
  await project.scrollIntoViewIfNeeded();
  await expect(project).toHaveCSS("transform", "none");
  const height = await page.locator(".hero-image").evaluate(el => el.getBoundingClientRect().height);
  for (const [selector, fraction] of [
    [".hero-backdrop", 0.028],
    [".hero-crystals-back", -0.04],
    [".hero-image", -0.08],
    [".hero-crystals-front", -0.128],
  ] as const) {
    await expect.poll(async () => Math.abs(await page.locator(selector).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42) - height * fraction)).toBeLessThan(0.2);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#learning-archive")).toHaveCSS("transform", "none");
  for (const layer of await page.locator(".hero-layer").all())
    await expect(layer).toHaveCSS("transform", "none");
});

test("recalculates scroll reveals after Sources & scope changes the layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/");
  const project = page.locator("#selected-evidence article").first();
  await expect.poll(() => project.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeCloseTo(24);
  await page.locator("#profile-sources").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await page.waitForTimeout(900);
  expect((await project.boundingBox())?.y).toBeGreaterThan(600);
  expect(await project.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeCloseTo(24);
  await project.scrollIntoViewIfNeeded();
  await expect(project).toHaveCSS("transform", "none");
});

test("keeps frameless layers within the viewport during bounded pointer movement at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".hero-visual")).toHaveCSS("transform", "none");
  const field = await page.locator(".hero-art").boundingBox();
  if (!field) throw new Error("Hero illustration missing");
  for (const [x, y] of [[0.95, 0.05], [0.05, 0.95], [3, -2]]) {
    await page.locator(".hero-art").dispatchEvent("pointermove", { clientX: field.x + field.width * x, clientY: field.y + field.height * y, pointerType: "mouse" });
    await page.waitForTimeout(650);
    for (const layer of await page.locator(".hero-layer").all()) {
      const bounds = await layer.boundingBox();
      if (!bounds) throw new Error("Hero layer missing");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
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
      await expect(page.getByRole("navigation").getByRole("link")).toHaveText(["Work", "Profile", "Contact"]);
    }
    const contactNav = page
      .getByRole("navigation")
      .getByRole("link", { name: "Contact" });
    await contactNav.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contact-path$/);
    const header = await page.locator(".site-header").boundingBox();
    const heading = await page.locator("#contact-path-heading").boundingBox();
    expect(heading?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
    for (const link of await page.locator("#contact-path a").all()) {
      await expect(link).toBeVisible();
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    await page.locator("#profile-sources > summary").click();
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
      .locator("#selected-evidence h3, #selected-evidence p, #identity h1, #contact-path h2")
      .evaluateAll((elements) =>
        elements
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent),
      );
    expect(overflow).toEqual([]);
  });
}

test("keeps text contrast readable on lavender and purple surfaces", async ({
  page,
}) => {
  await page.goto("/");
  const contrast = await page
    .locator(
      ".hero-note, .primary-link, .secondary-link, .section-intro, .ledger-qualification dd, .project-copy p, .project-link, .work-scope, .art-caption, #contact-path a, nav a",
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
    "A little detour.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  await page.getByRole("link", { name: "Back to the Portfolio Site" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Building things\.\s*Learning out loud\./,
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
  await expect(page.locator(".hero-image")).toBeVisible();
  await page.locator("#profile-sources > summary").click();
  await technicalProfileRows(page).nth(3).locator("summary").click();
  await expect(page.locator("#evidence-detail-3")).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
