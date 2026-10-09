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
  // Visit and settle every target on slower engines too.
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const count = await page.locator("[data-reveal]").count();
  expect(count).toBeGreaterThan(8);

  // Centre each target so it enters the reveal area, rather than waiting for
  // unrelated targets grazing the viewport edge. Assert before scrolling away:
  // the passed-target fallback must not hide a broken entrance reveal.
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
    for (const target of targets) {
      target.scrollIntoView({ block: "center" });
      await frame();
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await frame();
        if (settled(target)) break;
      }
      if (!settled(target)) throw new Error(`Unsettled reveal: ${target.textContent}`);
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
  // Control tween time, not native intersection delivery: host frame rate must
  // not decide whether the first reveal has finished before the second starts.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__afterHoursMotionReady)))
    .toBe(true);

  // Use adjacent sections' boundary targets, not the work section's sticky
  // heading: a jump across the full project index can finish that earlier
  // reveal before the profile starts. Both targets must remain in view.
  const groupA = "#selected-evidence .work-index > li:last-child";
  const groupB = "#technical-profile-heading";
  const intoView = (selector: string) =>
    page.evaluate(
      (selector) =>
        new Promise<void>((resolve) => {
          document.documentElement.style.scrollBehavior = "auto";
          const target = document.querySelector(selector) as HTMLElement;
          const observer = new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) return;
              observer.disconnect();
              resolve();
            },
            { rootMargin: "0px 0px -10% 0px" },
          );
          observer.observe(target);
          window.scrollTo(
            0,
            target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5,
          );
        }),
      selector,
    );
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

  await intoView(groupA);
  // Include the first group's stagger, but stay within its 0.6s reveal.
  await page.clock.runFor(300);
  const [aMid] = await read();
  await intoView(groupB);
  await page.clock.runFor(100);
  const [aWhenB, bWhenB] = await read();

  // The scenario is real: A was mid-flight, and when B's delivery landed A was
  // still mid-flight while B had just begun. Both must be genuinely tweening
  // together, not merely A before the second jump.
  expect(aMid.opacity).toBeGreaterThan(0.05);
  expect(aMid.opacity).toBeLessThan(0.95);
  expect(aWhenB.opacity).toBeGreaterThan(0.05);
  expect(aWhenB.opacity).toBeLessThan(0.99);
  expect(bWhenB.opacity).toBeGreaterThan(0.01);
  expect(bWhenB.opacity).toBeLessThan(0.99);
  expect(aWhenB.inViewport).toBe(true);
  expect(bWhenB.inViewport).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);
  // Both groups must settle immediately, not just the most recent one.
  await expect(page.locator("[data-reveal]").first()).toBeVisible();
  expect(await unsettled(page)).toEqual([]);
  // ...and stay settled.
  await page.clock.runFor(500);
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
  await expect(page.locator("#contact-path .contact-paths a")).toHaveCount(3);

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
