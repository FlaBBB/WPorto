import { expect, test, type Page } from "@playwright/test";
import { TIMELINE } from "../src/lib/timeline";

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
  await page.evaluate(async (timeline) => {
    const root = document.documentElement;
    root.style.scrollBehavior = "auto";
    const scroll = root.scrollHeight - window.innerHeight;
    const settled = (element: HTMLElement) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return (
        Number(getComputedStyle(element).opacity) >= 0.98 &&
        Math.abs(matrix.m42) < 0.5
      );
    };
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // Walk each scene's own configured stable interval (start..outStart) and,
    // while each target is genuinely visible, assert its entrance settled
    // before scrolling on. The intervals are deliberately unequal, so they are
    // read from the timeline rather than assumed evenly spaced.
    // A reveal target is only expected to settle once it is genuinely in the
    // reveal zone, which the observer shrinks by 10% at the bottom.
    const revealable = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight * 0.9;
    };
    const seen = new Set<Element>();
    for (const scene of timeline) {
      const host = document.querySelector(`[data-scene="${scene.id}"]`);
      if (!host) continue;
      const targets = Array.from(
        host.querySelectorAll<HTMLElement>("[data-reveal]"),
      );
      if (!targets.length) continue;
      for (let step = 0; step <= 32; step += 1) {
        const p = scene.start + (scene.outStart - scene.start) * (step / 32);
        window.scrollTo({ top: p * scroll, behavior: "instant" });
        await frame();
        await frame();
        for (const target of targets) {
          if (seen.has(target) || !revealable(target)) continue;
          for (let attempt = 0; attempt < 120 && !settled(target); attempt += 1) {
            await frame();
          }
          if (!settled(target)) {
            throw new Error(`Unsettled reveal: ${target.textContent}`);
          }
          seen.add(target);
        }
      }
    }
    const total = document.querySelectorAll("[data-reveal]").length;
    if (seen.size !== total) {
      throw new Error(`Only ${seen.size} of ${total} reveal targets entered view`);
    }
    window.scrollTo(0, root.scrollHeight);
    await frame();
  }, TIMELINE);

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

  // The ordinary document still themes the fixed navbar from the real Contact
  // geometry: over the violet band the ink is the dark plum, and returning to a
  // dark surface restores the light ink.
  const navInk = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector(".site-header nav a")!).color,
    );
  const headerContact = () =>
    page.evaluate(
      () =>
        (document.querySelector(".site-header") as HTMLElement | null)?.dataset
          .contact ?? null,
    );
  const surface = (selector: string) =>
    page.evaluate(
      (id) => getComputedStyle(document.querySelector(id)!).backgroundColor,
      selector,
    );
  // The navbar ink transitions over 180ms, so sample until it holds still
  // rather than reading a mid-transition colour.
  const settledNavInk = async () => {
    let last = await navInk();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await page.waitForTimeout(150);
      const current = await navInk();
      if (current === last) return current;
      last = current;
    }
    return last;
  };
  const luminance = (color: string) => {
    const [r, g, b] = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);

  const darkInk = await settledNavInk();
  expect(await headerContact()).toBe("false");
  // The navbar labels are small text, so they must clear 4.5:1 against the
  // surface they actually sit on (measured: 7.24 dark, 6.49 over violet).
  expect(contrast(darkInk, await surface("#identity"))).toBeGreaterThanOrEqual(
    4.5,
  );

  await page.locator("#contact-path").scrollIntoViewIfNeeded();
  await expect.poll(headerContact).toBe("true");
  const violetInk = await settledNavInk();
  expect(violetInk).not.toBe(darkInk);
  expect(
    contrast(violetInk, await surface("#contact-path")),
  ).toBeGreaterThanOrEqual(4.5);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(headerContact).toBe("false");
  expect(await settledNavInk()).toBe(darkInk);
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
  await page.waitForFunction(() => window.__afterHoursMotionReady);

  // Bring the Intro's link into view through the global timeline, then hover it.
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    const scroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: 0.2 * scroll, behavior: "instant" });
  });
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

  // Both targets are adjacent across the Work -> Profile transition, so a
  // single progress inside that window keeps both in view. Position through the
  // global timeline rather than native scrollIntoView, which cannot reach the
  // transformed pinned scenes.
  const groupA = "#selected-evidence .work-index > li:last-child";
  const groupB = "#technical-profile-heading";
  const setProgress = (value: number) =>
    page.evaluate((p) => {
      document.documentElement.style.scrollBehavior = "auto";
      const scroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: p * scroll, behavior: "instant" });
    }, value);
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

  // Enter the transition early so A starts first, then advance so B begins
  // while A is still tweening.
  await setProgress(0.485);
  await page.clock.runFor(300);
  const [aMid] = await read();
  await setProgress(0.497);
  // The pinned presentation applies the new position on a controlled frame, so
  // B is not in the viewport until one frame runs. Watch for B's real native
  // IntersectionObserver entry (its own public observer, not GSAP state) and wait
  // for it from the Node side, because page timers are faked here. This is
  // delivery synchronization, not a fixed sleep: on a loaded engine the entry can
  // arrive a frame or two after the scroll commits.
  await page.evaluate(() => {
    const state = window as unknown as { __revealB?: boolean };
    state.__revealB = false;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        state.__revealB = true;
        observer.disconnect();
      }
    });
    observer.observe(document.querySelector("#technical-profile-heading")!);
  });
  await page.clock.runFor(40);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __revealB?: boolean }).__revealB,
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
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

  // Without the controller the page is the ordinary, fully readable document:
  // the fixed cloud must NOT be created, and the in-flow static mark remains.
  await page.waitForTimeout(2600);
  await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
  await expect(page.locator(".flab-mark svg")).toBeVisible();
  // A later section's content is readable, not covered by a stray cloud.
  await expect(page.locator("#learning-archive-heading")).toBeVisible();
  const view = await page.evaluate(() => {
    const field = document.querySelector(".sculpture-field")!;
    const rect = field.getBoundingClientRect();
    return { fieldH: rect.height, vh: window.innerHeight };
  });
  expect(Math.abs(view.fieldH - view.vh)).toBeLessThan(2);
});
