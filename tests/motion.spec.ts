import { expect, test, type Page } from "@playwright/test";

/**
 * Every route the site serves. Each section is its own page, so a per-page
 * invariant is checked on each rather than on one long document.
 */
const ROUTES = ["/", "/work/", "/profile/", "/archive/", "/contact/"];

type MotionState = { opacity: number; x: number; y: number };

const motionState = (locator: ReturnType<Page["locator"]>) =>
  locator.evaluate((element): MotionState => {
    const style = getComputedStyle(element);
    const matrix =
      style.transform === "none" ? null : new DOMMatrix(style.transform);
    return {
      opacity: Number(style.opacity),
      x: matrix?.m41 ?? 0,
      y: matrix?.m42 ?? 0,
    };
  });

/**
 * Targets that have entered or passed the reveal zone must be settled. Its
 * bottom edge is 90% of the viewport, matching the production observer.
 */
const unsettled = (page: Page) =>
  page.locator("[data-reveal]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        if (element.getBoundingClientRect().top >= window.innerHeight * 0.9) return false;
        const style = getComputedStyle(element);
        const matrix =
          style.transform === "none" ? null : new DOMMatrix(style.transform);
        return Number(style.opacity) < 0.98 || Math.abs(matrix?.m42 ?? 0) > 0.5;
      })
      .map((element) => (element.textContent ?? "").trim().slice(0, 40)),
  );

/**
 * Drive the scroll through rendered frames and let each position settle, so a
 * slower engine cannot skip a target between timed scroll steps.
 */
const sweep = (page: Page) =>
  page.evaluate(async () => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const settled = (element: HTMLElement) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return (
        Number(getComputedStyle(element).opacity) >= 0.98 &&
        Math.abs(matrix.m42) < 0.5
      );
    };
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y <= root.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await frame();
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await frame();
        const visible = targets.filter((target) => {
          const rect = target.getBoundingClientRect();
          return rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
        });
        if (visible.every(settled)) break;
      }
    }
    window.scrollTo(0, root.scrollHeight);
    await frame();
  });

test("reveals every scroll target without leaving one stuck", async ({
  page,
}) => {
  // Five routes are swept frame by frame, so this is legitimately long on
  // slower engines.
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  let total = 0;
  for (const route of ROUTES) {
    await page.goto(route);
    total += await page.locator("[data-reveal]").count();
    await sweep(page);
    await expect
      .poll(async () => unsettled(page), { timeout: 10_000 })
      .toEqual([]);
  }
  // Every page carries reveals, so the sweep above was not vacuous.
  expect(total).toBeGreaterThan(8);
});

test("settles targets already passed by a jump down the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/profile/");
  // A jump past the record list before its targets are observed, which is what
  // a restored scroll position or a deep landing looks like. The module must
  // settle whatever is already behind the viewport rather than leaving it
  // hidden for good.
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect
    .poll(async () => unsettled(page), { timeout: 10_000 })
    .toEqual([]);
});

test("reveals promptly after a single instant scroll jump", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/profile/");
  await expect.poll(async () => unsettled(page)).toEqual([]);

  const elapsed = await page.evaluate(async () => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    // Targets that start below the fold, so the jump is what reveals them.
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("#technical-profile [data-reveal]"),
    ).filter((target) => target.getBoundingClientRect().top >= window.innerHeight);
    if (!targets.length) return -2;
    const start = performance.now();
    window.scrollTo(0, root.scrollHeight);
    for (;;) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (
        targets.every((target) => {
          const matrix = new DOMMatrix(getComputedStyle(target).transform);
          return (
            Number(getComputedStyle(target).opacity) >= 0.98 &&
            Math.abs(matrix.m42) < 0.5
          );
        })
      ) {
        return performance.now() - start;
      }
      if (performance.now() - start > 4000) return -1;
    }
  });
  // -2 would mean the page had nothing below the fold to reveal.
  expect(elapsed).toBeGreaterThanOrEqual(0);
  expect(elapsed).toBeLessThan(2500);
});

test("shows a static complete page under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/work/");
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  expect(await unsettled(page)).toEqual([]);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".work-index > li")).toHaveCount(3);
});

test("handles a reduced-motion change after load in both directions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\bmotion\b/);
  await expect.poll(async () => unsettled(page)).toEqual([]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  await expect.poll(async () => unsettled(page)).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveClass(/\bmotion\b/);
  await expect.poll(async () => unsettled(page)).toEqual([]);
});

test("clears hover and focus nudges when reduced motion is requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  // Generous tolerance: the entrance must settle, but a slow engine may need
  // longer than the default poll window to finish it.
  await expect
    .poll(async () => unsettled(page), { timeout: 15_000 })
    .toEqual([]);

  const arrow = page.locator('.intro-link span[aria-hidden="true"]');
  await page.locator(".intro-link").hover();
  await expect
    .poll(async () => Math.abs((await motionState(arrow)).x ?? 0))
    .toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  await expect(arrow).toHaveCSS("transform", "none");
  // Polled rather than read once: the requirement is that nothing is left
  // mid-reveal, and how many frames an engine needs to reflect the cleared
  // inline styles is not what is under test.
  await expect.poll(async () => unsettled(page)).toEqual([]);
});

test.describe("page motion without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps every reveal target visible and unshifted", async ({ page }) => {
    let total = 0;
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
      const targets = page.locator("[data-reveal]");
      const count = await targets.count();
      total += count;
      for (let index = 0; index < count; index += 1) {
        await expect(targets.nth(index)).toHaveCSS("opacity", "1");
        await expect(targets.nth(index)).toHaveCSS("transform", "none");
      }
    }
    expect(total).toBeGreaterThan(8);
  });
});

test("stops every overlapping reveal when reduced motion is requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Control tween time, not native intersection delivery: host frame rate must
  // not decide whether the first reveal has finished before the second starts.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto("/work/");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__afterHoursMotionReady)))
    .toBe(true);

  // The work page delivers its heading, intro and project entries in one batch,
  // and the batch is staggered, so the group's tweens genuinely overlap. Two of
  // them stand in for the whole group.
  const groupA = "#selected-evidence .section-title";
  const groupB = "#selected-evidence .work-index > li:first-child";
  const read = () =>
    page.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const target = document.querySelector(selector) as HTMLElement;
          const rect = target.getBoundingClientRect();
          return {
            opacity: Number(getComputedStyle(target).opacity),
            inViewport: rect.bottom > 0 && rect.top < window.innerHeight,
          };
        }),
      [groupA, groupB],
    );

  // Include the first group's stagger, but stay within its 0.6s reveal.
  await page.clock.runFor(300);
  const [aMid, bMid] = await read();

  // The scenario is real: A was mid-flight and B had just begun, so both must be
  // genuinely tweening together.
  expect(aMid.opacity).toBeGreaterThan(0.05);
  expect(aMid.opacity).toBeLessThan(0.99);
  expect(bMid.opacity).toBeGreaterThan(0.01);
  expect(bMid.opacity).toBeLessThan(0.99);
  expect(aMid.inViewport).toBe(true);
  expect(bMid.inViewport).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  // Every group must settle immediately, not just the most recent one.
  await expect(page.locator("[data-reveal]").first()).toBeVisible();
  expect(await unsettled(page)).toEqual([]);
  // ...and stay settled.
  await page.clock.runFor(500);
  expect(await unsettled(page)).toEqual([]);
});

test("drops the motion hold when the animation module never loads", async ({
  page,
}) => {
  await page.route(/Portfolio\.astro_astro_type_script/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  // The essential invariant: if the module never runs, the pre-paint hold must
  // not survive. Asserting the transient `.motion` class would race the fallback.
  await expect
    .poll(async () => unsettled(page), { timeout: 6000 })
    .toEqual([]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".intro-link")).toHaveCount(1);

  // The sculpture owns its own scene and canvas, so it must still be drawn even
  // though the page-reveal module (which owns `html.motion`) was aborted.
  await page.waitForTimeout(2600);
  await expect(page.locator(".sculpture-canvas")).toBeVisible();
  const view = await page.evaluate(() => {
    const field = document.querySelector(".sculpture-field")!;
    const rect = field.getBoundingClientRect();
    return { fieldH: rect.height, vh: window.innerHeight };
  });
  expect(Math.abs(view.fieldH - view.vh)).toBeLessThan(2);
});
