import { expect, test, type Page } from "@playwright/test";

/**
 * The loading screen stands in for the opening until the sculpture can draw it.
 * These tests hold the two things a visitor relies on: the handover happens
 * without moving the mark, and the screen never becomes a gate in front of the
 * page.
 */

const delaySculpture = (page: Page, ms: number) =>
  page.route(/FlabSculpture\./, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });

/**
 * The screen's own exit is a 4.5s wall-clock fallback, so on a slow engine the
 * window in which it can be measured is not guaranteed. The clock is frozen before
 * navigation, the way the Work fixtures in `portfolio.spec.ts` freeze it: the
 * screen then holds its pose while it is measured, and the handover is observed
 * after the clock is handed back. Measurements go through `page.evaluate` rather
 * than locators, because a paused clock freezes the frames locator polling waits on.
 */
test("hands the opening over to the sculpture without moving the mark", async ({
  page,
}) => {
  await delaySculpture(page, 1500);
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.goto("/", { waitUntil: "commit" });

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Boolean(
            document.getElementById("loading-screen") &&
              document.querySelector(".loading-mark svg") &&
              document.querySelector(".flab-mark svg"),
          ),
        ),
      { timeout: 20_000, message: "the document parsed with the screen in place" },
    )
    .toBe(true);

  const screen = await page.evaluate(() => {
    const element = document.getElementById("loading-screen")!;
    const box = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().toJSON();
    return {
      state: element.dataset.state,
      pointerEvents: getComputedStyle(element).pointerEvents,
      // The mark is assembled from the shared star vocabulary rather than being
      // the plain filled SVG it replaces.
      stars: document.querySelectorAll(".loading-star").length,
      outline: document.querySelectorAll(".loading-outline").length,
      loading: box(".loading-mark svg"),
      hero: box(".flab-mark svg"),
    };
  });

  expect(screen.state).toBe("loading");
  // It is a picture of the opening, not a gate: the page underneath keeps the
  // pointer while the screen is up.
  expect(screen.pointerEvents).toBe("none");
  expect(screen.stars).toBeGreaterThan(100);
  expect(screen.outline).toBe(1);

  // The screen draws the mark at the size and place the sculpture will draw it,
  // so the handover cannot jump the opening's geometry.
  expect(Math.abs(screen.loading.width - screen.hero.width)).toBeLessThan(1);
  expect(Math.abs(screen.loading.y - screen.hero.y)).toBeLessThan(1);

  // Handing the clock back lets the delayed sculpture report its first frame and
  // the screen finish its exit.
  await page.clock.resume();
  await expect(page.locator("#loading-screen")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(".sculpture-canvas")).toBeVisible();
});

test("is skipped where it would be a prologue rather than the opening", async ({
  page,
}) => {
  // Reduced motion replaces the whole experience, not just its animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#loading-screen")).toHaveCount(0);
  await expect(page.locator(".flab-mark svg")).toBeVisible();

  // A deep link is aimed at a section, so it never stages the opening first.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#contact-path");
  await expect(page.locator("#loading-screen")).toHaveCount(0);
  await expect(page.locator("#contact-path-heading")).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows the static mark and no screen", async ({ page }) => {
    await page.goto("/");
    // The screen ships in the document but is hidden without a script to run it,
    // so the static mark is what the visitor gets.
    await expect(page.locator("#loading-screen")).toBeHidden();
    await expect(page.locator(".flab-mark svg")).toBeVisible();
  });
});
