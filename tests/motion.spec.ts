import { expect, test, type Page } from "@playwright/test";

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
 * Targets that have entered or passed the viewport must be settled. Targets still
 * below the fold are legitimately hidden, so they are excluded.
 */
const unsettled = (page: Page) =>
  page.locator("[data-reveal]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        if (element.getBoundingClientRect().top >= window.innerHeight) return false;
        const style = getComputedStyle(element);
        const matrix =
          style.transform === "none" ? null : new DOMMatrix(style.transform);
        return Number(style.opacity) < 0.98 || Math.abs(matrix?.m42 ?? 0) > 0.5;
      })
      .map((element) => (element.textContent ?? "").trim().slice(0, 40)),
  );

test("reveals every scroll target without leaving one stuck", async ({
  page,
}) => {
  // The opening scene is ~1.75 viewports tall by design, so this full-page
  // frame-stepped sweep is legitimately long on slower engines.
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const count = await page.locator("[data-reveal]").count();
  expect(count).toBeGreaterThan(8);

  // Drive the scroll through rendered frames and let each position settle, so a
  // slower engine cannot skip a target between timed scroll steps.
  await page.evaluate(async () => {
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
          return rect.top < window.innerHeight && rect.bottom > 0;
        });
        if (visible.every(settled)) break;
      }
    }
    window.scrollTo(0, root.scrollHeight);
    await frame();
  });

  await expect.poll(async () => unsettled(page), { timeout: 10_000 }).toEqual([]);
});

test("settles targets already passed by a deep link", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#contact-path");
  await expect
    .poll(async () => unsettled(page), { timeout: 10_000 })
    .toEqual([]);
});

test("reveals promptly after a single instant scroll jump", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect.poll(async () => unsettled(page)).toEqual([]);

  const elapsed = await page.evaluate(async () => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("#contact-path [data-reveal]"),
    );
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
  expect(elapsed).toBeGreaterThanOrEqual(0);
  expect(elapsed).toBeLessThan(2500);
});

test("shows a static complete page under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
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
  expect(await unsettled(page)).toEqual([]);
});

test.describe("page motion without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps every reveal target visible and unshifted", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
    const targets = page.locator("[data-reveal]");
    const count = await targets.count();
    expect(count).toBeGreaterThan(8);
    for (let index = 0; index < count; index += 1) {
      await expect(targets.nth(index)).toHaveCSS("opacity", "1");
      await expect(targets.nth(index)).toHaveCSS("transform", "none");
    }
  });
});

test("stops every overlapping reveal when reduced motion is requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  // Let the above-the-fold reveals finish so only the two driven groups move.
  await expect.poll(async () => unsettled(page), { timeout: 15_000 }).toEqual([]);

  // Bring two distinct groups into view less than 0.6s apart, so their staggered
  // reveals overlap. The first group is confirmed genuinely mid-tween while the
  // second starts.
  const sample = await page.evaluate(async () => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const read = (el: Element) => {
      const style = getComputedStyle(el);
      const matrix =
        style.transform === "none" ? null : new DOMMatrix(style.transform);
      return { opacity: Number(style.opacity), y: Math.abs(matrix?.m42 ?? 0) };
    };
    const groupA = document.querySelector(
      "#selected-evidence [data-reveal]",
    ) as HTMLElement;
    const groupB = document.querySelector(
      "#technical-profile [data-reveal]",
    ) as HTMLElement;

    const intoView = (el: HTMLElement) =>
      window.scrollTo(
        0,
        el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5,
      );

    intoView(groupA);
    // Advance until A is actually tweening (started but not finished).
    let aMid = read(groupA);
    for (let step = 0; step < 40; step += 1) {
      await frame();
      aMid = read(groupA);
      if (aMid.opacity > 0.05 && aMid.opacity < 0.95) break;
    }

    intoView(groupB);
    // Advance until B has genuinely started tweening, while A is still in
    // flight, so the two staggered reveals overlap in time.
    let aWhenB = read(groupA);
    let bWhenB = read(groupB);
    for (let step = 0; step < 30; step += 1) {
      await frame();
      aWhenB = read(groupA);
      bWhenB = read(groupB);
      if (bWhenB.opacity > 0.01) break;
    }
    return { aMid, aWhenB, bWhenB };
  });

  // The scenario is real: A was mid-flight, and when B's delivery landed A was
  // still mid-flight while B had just begun. Both must be genuinely tweening
  // together, not merely A before the second jump.
  expect(sample.aMid.opacity).toBeGreaterThan(0.05);
  expect(sample.aMid.opacity).toBeLessThan(0.95);
  expect(sample.aWhenB.opacity).toBeGreaterThan(0.05);
  expect(sample.aWhenB.opacity).toBeLessThan(0.99);
  expect(sample.bWhenB.opacity).toBeGreaterThan(0.01);
  expect(sample.bWhenB.opacity).toBeLessThan(0.99);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  // Both groups must settle immediately, not just the most recent one.
  await expect(page.locator("[data-reveal]").first()).toBeVisible();
  expect(await unsettled(page)).toEqual([]);
  // ...and stay settled.
  await page.waitForTimeout(500);
  expect(await unsettled(page)).toEqual([]);
});

test("drops the motion hold when the animation module never loads", async ({
  page,
}) => {
  await page.route(/index\.astro_astro_type_script/, (route) => route.abort());
  await page.goto("/");
  // The essential invariant: if the module never runs, the pre-paint hold must
  // not survive. Asserting the transient `.motion` class would race the fallback.
  await expect
    .poll(async () => unsettled(page), { timeout: 6000 })
    .toEqual([]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#contact-path a")).toHaveCount(3);

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
