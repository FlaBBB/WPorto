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
      /Build\.\s*Break\.\s*Learn\./,
    );
    await expect(page.getByRole("link", { name: "Fikri Flab — back to top" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Selected Work",
      "Technical Profile",
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
  // The entrance tween clears its own transform; wait it out before measuring depth.
  await expect.poll(() => page.locator(".hero-visual").evaluate(el => getComputedStyle(el).transform)).toBe("none");
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
  // Scroll just past the hero so the parallax timeline is fully at its end
  // rather than wherever the project card happens to land.
  await page.evaluate(() => {
    const hero = document.querySelector("#identity");
    if (!hero) throw new Error("Hero missing");
    window.scrollTo({
      top: hero.getBoundingClientRect().bottom + window.scrollY + 40,
      behavior: "instant",
    });
  });
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
    // Work rows are full-width sheets stacked at every width; the second sheet
    // is stepped right on wide screens and aligned on narrow ones.
    expect(second?.y).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0));
    if (width <= 800) expect(second?.x).toBe(first?.x);
    else expect(second?.x).toBeGreaterThan(first?.x ?? 0);
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

test("keeps text contrast readable on the painted paper surfaces", async ({
  page,
}) => {
  await page.goto("/");
  const contrast = await page
    .locator(
      ".hero-kicker, .hero-note, .primary-link, .secondary-link, .section-intro, .ledger-qualification dd, .ledger-capability, .project-copy p, .project-link, .project-stack li, .work-scope, .topic-tag, .notes-label small, .archive-copy p, .art-caption, #contact-path a, .contact-link strong, .contact-link small, nav a",
    )
    .evaluateAll((elements) => {
      const parse = (color: string) => {
        const [red, green, blue, alpha = 1] = color
          .match(/[\d.]+/g)!
          .map(Number);
        return { red, green, blue, alpha };
      };
      const luminance = ({ red, green, blue }: ReturnType<typeof parse>) =>
        [red, green, blue]
          .map((channel) => channel / 255)
          .map((value) =>
            value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (total, channel, index) =>
              total + [0.2126, 0.7152, 0.0722][index] * channel,
            0,
          );
      const over = (
        top: ReturnType<typeof parse>,
        bottom: ReturnType<typeof parse>,
      ) => ({
        red: top.red * top.alpha + bottom.red * (1 - top.alpha),
        green: top.green * top.alpha + bottom.green * (1 - top.alpha),
        blue: top.blue * top.alpha + bottom.blue * (1 - top.alpha),
        alpha: 1,
      });

      // Paper faces are painted by pseudo-elements, so the surface behind text
      // is the nearest ancestor background or covering pseudo-element — not
      // just the nearest element with a background-color.
      const layersFor = (element: Element) => {
        const layers: ReturnType<typeof parse>[] = [];
        let node: Element | null = element;
        while (node && node !== document.documentElement) {
          const own = getComputedStyle(node).backgroundColor;
          if (own !== "rgba(0, 0, 0, 0)") {
            layers.push(parse(own));
            break;
          }
          const box = node.getBoundingClientRect();
          const painted = (["::before", "::after"] as const)
            .map((pseudo) => ({ pseudo, style: getComputedStyle(node!, pseudo) }))
            .filter(
              ({ style }) =>
                style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                parseFloat(style.width) >= box.width * 0.9 &&
                parseFloat(style.height) >= box.height * 0.9,
            )
            .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex));
          if (painted.length) {
            layers.push(parse(painted[0].style.backgroundColor));
            break;
          }
          node = node.parentElement;
        }
        if (!layers.length)
          layers.push(parse(getComputedStyle(document.body).backgroundColor));
        return layers;
      };

      return elements.map((el) => {
        const layers = layersFor(el);
        const surface = layers.reduce((below, top) => over(top, below), {
          red: 255,
          green: 255,
          blue: 255,
          alpha: 1,
        });
        const ink = luminance(parse(getComputedStyle(el).color));
        const paper = luminance(surface);
        return (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
      });
    });
  for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("uses the one character illustration only in the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('img[src*="hero-character"]')).toHaveCount(1);
  await expect(
    page.locator('img[src*="hero-character"]').first(),
  ).toHaveJSProperty("naturalWidth", 1728);
  // No preliminary fox or world artwork is referenced anywhere.
  expect(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .map((image) => image.getAttribute("src") ?? "")
          .filter((src) => /fox-|world-/.test(src)),
      ),
  ).toEqual([]);
  // Every other image is the shared brand mark, not a second illustration.
  expect(
    await page
      .locator("main img")
      .evaluateAll(
        (images) => images.filter((image) => !image.closest(".hero-art")).length,
      ),
  ).toBe(0);
});

test("ships one coherent angular brand mark", async ({ page, request }) => {
  await page.goto("/");
  const marks = page.locator("img.brand-mark");
  expect(await marks.count()).toBeGreaterThanOrEqual(2);
  expect(
    await marks.evaluateAll((images) =>
      images.map((image) => image.getAttribute("src")),
    ),
  ).toEqual(await marks.evaluateAll((images) => images.map(() => "/favicon.svg")));
  const icon = await request.get("/favicon.svg");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  const svg = await icon.text();
  // Angular identity: no rounded corners on the plate.
  expect(svg).not.toMatch(/\brx=/);
  // The FF monogram plus the purple plate, consistent with the site palette.
  expect(svg.match(/fill="#f8f3eb"/g)).toHaveLength(2);
  expect(svg).toContain("#642cba");
});

test("gives selected paper surfaces a real cut edge and press feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const button = page.locator(".primary-link");
  await expect(button).toHaveClass(/paper--press/);

  const edge = await button.evaluate((element) => {
    const face = getComputedStyle(element, "::before");
    const side = getComputedStyle(element, "::after");
    return {
      faceBackground: face.backgroundColor,
      faceCut: face.clipPath,
      faceTransform: face.transform,
      edgeBackground: side.backgroundColor,
      edgeTransform: side.transform,
      edgeShadow: side.filter,
    };
  });
  // A painted face cut to a non-rectangular contour.
  expect(edge.faceBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(edge.faceCut.startsWith("polygon(")).toBeTruthy();
  expect(edge.faceTransform).toBe("none");
  // A solid offset edge below it, with one directional shadow.
  expect(edge.edgeBackground).not.toBe(edge.faceBackground);
  const offset = edge.edgeTransform.match(/matrix\([^)]*\)/)?.[0] ?? "";
  const [, , , , offsetX, offsetY] = offset
    .slice(7, -1)
    .split(", ")
    .map(Number);
  expect(offsetX).toBeGreaterThan(0);
  expect(offsetY).toBeGreaterThan(0);
  expect(edge.edgeShadow).toContain("drop-shadow");

  // Press feedback is a state sequence, not merely a change: the edge grows on
  // hover, collapses past its resting offset while held, returns to the hover
  // offset on release, and returns to rest when the pointer leaves. Each state
  // is measured from the painted ::after transform and compared with the other
  // measured states, so the assertions do not restate the CSS custom properties.
  const edgeOffset = () =>
    button.evaluate((element) => {
      const { m41, m42 } = new DOMMatrix(
        getComputedStyle(element, "::after").transform,
      );
      return { x: m41, y: m42 };
    });
  const magnitude = ({ x, y }: { x: number; y: number }) => Math.hypot(x, y);
  // Wait for the edge transition to finish. getAnimations() cannot be used:
  // Firefox does not report pseudo-element transitions, so a duration-aware
  // wait plus a stability check is what works in both engines.
  const settled = async () => {
    const duration = await button.evaluate(
      (element) =>
        parseFloat(getComputedStyle(element, "::after").transitionDuration) *
        1000,
    );
    await page.waitForTimeout(duration + 150);
    let previous = await edgeOffset();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await page.waitForTimeout(60);
      const current = await edgeOffset();
      if (
        Math.abs(current.x - previous.x) < 0.01 &&
        Math.abs(current.y - previous.y) < 0.01
      )
        return current;
      previous = current;
    }
    throw new Error("Edge offset never settled");
  };

  // Start with the pointer away from the button so the first sample is the
  // resting offset, not a hover offset left over from an earlier interaction.
  //
  // The hero entrance tween moves the hero copy (and therefore this button),
  // and a late web-font swap reflows the hero. Probing showed two bounding-box
  // samples 100ms apart can read identically while the tween is still mid-flight
  // (opacity 0.81, a non-none transform), so box stability is not a reliable
  // signal that the entrance has finished. Wait for the real completion signal
  // instead: clearProps removes the inline transform and opacity, so the settled
  // state is `transform: none; opacity: 1`. This keeps every measurement after
  // animation and font settlement rather than at an arbitrary point during it.
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(
      () =>
        page.locator(".hero-actions").evaluate((element) => {
          const style = getComputedStyle(element);
          return `${style.transform}|${style.opacity}`;
        }),
      { timeout: 20_000 },
    )
    .toBe("none|1");

  await page.mouse.move(0, 0);
  const resting = await settled();

  // The primary link is a real in-page anchor, so releasing the button would
  // navigate and scroll the page, moving the button out from under the pointer.
  // Navigation is covered by the keyboard-navigation test; suppress it here so
  // the press interaction can be measured in place.
  await button.evaluate((element) =>
    element.addEventListener("click", (event) => event.preventDefault()),
  );

  // Drive every state with explicit coordinates: a move to the current position
  // is a no-op, and Firefox only recomputes :hover on a real move. Confirm the
  // pointer actually entered the button before sampling, so a stale target can
  // never be mistaken for a missing hover style.
  const hoverButton = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const box = await button.boundingBox();
      if (!box) throw new Error("Primary link missing");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      if (await button.evaluate((element) => element.matches(":hover")))
        return;
      await page.waitForTimeout(50);
    }
    throw new Error("Pointer never entered the primary link");
  };

  await hoverButton();
  const hovered = await settled();
  expect(magnitude(hovered)).toBeGreaterThan(magnitude(resting));
  expect(hovered.x).toBeGreaterThan(resting.x);
  expect(hovered.y).toBeGreaterThan(resting.y);

  await page.mouse.down();
  const pressed = await settled();
  expect(magnitude(pressed)).toBeLessThan(magnitude(resting));
  expect(pressed.x).toBeLessThan(resting.x);
  expect(pressed.y).toBeLessThan(resting.y);

  await page.mouse.up();
  await page.mouse.move(0, 0);
  await hoverButton();
  const released = await settled();
  expect(Math.abs(released.x - hovered.x)).toBeLessThan(0.5);
  expect(Math.abs(released.y - hovered.y)).toBeLessThan(0.5);

  await page.mouse.move(0, 0);
  const left = await settled();
  expect(Math.abs(left.x - resting.x)).toBeLessThan(0.5);
  expect(Math.abs(left.y - resting.y)).toBeLessThan(0.5);

  // The work sheets and contact sheet are painted surfaces, not page-coloured
  // rectangles: each carries its own face colour and a cut contour.
  for (const selector of [".project", ".contact-sheet", ".profile-sources"]) {
    const surface = await page.locator(selector).first().evaluate((element) => {
      const face = getComputedStyle(element, "::before");
      return { background: face.backgroundColor, cut: face.clipPath };
    });
    expect(surface.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(surface.cut.startsWith("polygon(")).toBeTruthy();
  }

  // The character's paper contour is painted with CSS drop-shadows. An SVG
  // feMorphology filter produced the same edge but throttled the pointer
  // parallax to ~1fps in headless Chromium, so it must not come back.
  const heroEdge = await page.locator(".hero-image").evaluate((element) => ({
    filter: getComputedStyle(element).filter,
    svgFilters: document.querySelectorAll("svg filter").length,
    morphology: document.querySelectorAll("feMorphology").length,
  }));
  expect(heroEdge.filter.match(/drop-shadow/g)?.length).toBeGreaterThanOrEqual(4);
  expect(heroEdge.svgFilters).toBe(0);
  expect(heroEdge.morphology).toBe(0);
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
    /Build\.\s*Break\.\s*Learn\./,
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
