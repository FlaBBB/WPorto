import { expect, test, type Page } from "@playwright/test";

/**
 * Canvas geometry helpers. All measurements read the rendered canvas pixels, so
 * they describe what a visitor actually sees rather than internal state.
 */
type Painted = {
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  /** Fraction of the field's width/height the painted pixels span. */
  spanX: number;
  spanY: number;
  /** Painted pixels divided by the painted bounding box area. */
  density: number;
  fieldWidth: number;
  fieldHeight: number;
};

const painted = (page: Page): Promise<Painted> =>
  page.locator(".sculpture-canvas").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const ctx = element.getContext("2d")!;
    const { width, height } = element;
    const data = ctx.getImageData(0, 0, width, height).data;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 16) {
          count += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    return {
      count,
      minX,
      minY,
      maxX,
      maxY,
      width: boxW,
      height: boxH,
      spanX: boxW / width,
      spanY: boxH / height,
      density: count / (boxW * boxH),
      fieldWidth: width,
      fieldHeight: height,
    };
  });

const waitForState = (page: Page, expected: string) =>
  page
    .locator(`.sculpture[data-assembled="${expected}"]`)
    .waitFor({ state: "attached", timeout: 10_000 });

/** Waits until two consecutive canvas samples are identical (motion settled). */
async function waitForSettled(page: Page, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let previous = await painted(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(220);
    const current = await painted(page);
    if (
      Math.abs(current.count - previous.count) <= 2 &&
      Math.abs(current.width - previous.width) <= 2 &&
      Math.abs(current.height - previous.height) <= 2
    ) {
      return current;
    }
    previous = current;
  }
  throw new Error("sculpture never settled");
}

const hydrate = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: /mark/ }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await expect(page.locator(".sculpture")).toHaveAttribute(
    "data-has-canvas",
    "true",
  );
};

test.describe("After Hours hero sculpture", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("scatters as a wide field rather than a jittered letterform", async ({
    page,
  }) => {
    await hydrate(page);
    const scattered = await waitForSettled(page);

    // A real galaxy spans most of the field on BOTH axes. Per-letter jitter
    // would keep the painted box near the mark's own footprint.
    expect(scattered.spanX).toBeGreaterThan(0.7);
    expect(scattered.spanY).toBeGreaterThan(0.55);

    // It is genuinely sparse and airy, not a solid plate.
    expect(scattered.density).toBeLessThan(0.12);

    // The cloud keeps a populated middle rather than an empty ring.
    const middle = await page.locator(".sculpture-canvas").evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      const ctx = element.getContext("2d")!;
      const { width, height } = element;
      const band = ctx.getImageData(
        Math.round(width * 0.35),
        Math.round(height * 0.35),
        Math.round(width * 0.3),
        Math.round(height * 0.3),
      ).data;
      let count = 0;
      for (let i = 3; i < band.length; i += 4) if (band[i] > 16) count += 1;
      return count;
    });
    expect(middle).toBeGreaterThan(20);
  });

  test("assembles into the real mark with depth and varied glyphs", async ({
    page,
  }) => {
    await hydrate(page);
    await waitForSettled(page);

    const variety = Number(
      await page.locator(".sculpture").getAttribute("data-glyph-variety"),
    );
    expect(variety).toBeGreaterThanOrEqual(8);
    const depth = Number(
      await page.locator(".sculpture").getAttribute("data-depth-extent"),
    );
    expect(depth).toBeGreaterThan(150);

    const scattered = await painted(page);
    await page.locator(".sculpture").hover();
    await waitForState(page, "true");
    const assembled = await waitForSettled(page);

    // Gathering really concentrates the field onto the mark's footprint.
    expect(assembled.spanX).toBeLessThan(scattered.spanX * 0.75);
    expect(assembled.density).toBeGreaterThan(scattered.density * 3);

    // The gathered silhouette is the mark: its aspect ratio matches the traced
    // artboard, which a jittered or unrelated shape would not.
    const markAspect = 410 / 302;
    const gatheredAspect = assembled.width / assembled.height;
    expect(Math.abs(gatheredAspect - markAspect) / markAspect).toBeLessThan(0.28);
  });

  test("rotates in 3D so the mark foreshortens with pointer position", async ({
    page,
  }) => {
    await hydrate(page);
    const box = await page.locator(".sculpture-field").boundingBox();
    if (!box) throw new Error("field missing");

    // Straight-on view: no tilt, so the mark shows its full width.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await waitForState(page, "true");
    const front = await waitForSettled(page);

    // Edge-on view: the body rotates, so the mark foreshortens. cos() is even, so
    // the two opposite edges tilt by the same amount and only a centre-vs-edge
    // comparison exposes the rotation. The tilt eases in, so allow it to arrive.
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
    await page.waitForTimeout(2500);
    const tilted = await waitForSettled(page);

    expect(front.width - tilted.width).toBeGreaterThan(6);
  });

  test("scatters again on pointer leave", async ({ page }) => {
    await hydrate(page);
    const scattered = await waitForSettled(page);
    await page.locator(".sculpture").hover();
    await waitForState(page, "true");
    const assembled = await waitForSettled(page);
    expect(assembled.spanX).toBeLessThan(scattered.spanX * 0.8);

    await page.mouse.move(2, 2);
    await waitForState(page, "false");
    const again = await waitForSettled(page);
    expect(again.spanX).toBeGreaterThan(0.7);
  });

  test("reverses mid-flight without stranding the field", async ({ page }) => {
    // A controlled clock makes the interruption point deterministic.
    await page.clock.install();
    await hydrate(page);
    const scattered = await waitForSettled(page);

    const box = await page.locator(".sculpture-field").boundingBox();
    if (!box) throw new Error("field missing");

    await page.clock.pauseAt(Date.now() + 1000);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Advance the simulated clock until the gather is measurably underway. Fixed
    // simulated steps keep this deterministic, while polling absorbs the
    // per-engine difference in when the ease starts to visibly narrow the field.
    let mid = await painted(page);
    for (let step = 0; step < 40; step += 1) {
      await page.clock.runFor(100);
      mid = await painted(page);
      if (mid.spanX < scattered.spanX * 0.9) break;
    }
    expect(mid.spanX).toBeLessThan(scattered.spanX * 0.95);
    expect(mid.spanX).toBeGreaterThan(0.2);

    // Leave mid-flight and advance past the reverse.
    await page.mouse.move(2, 2);
    await page.clock.runFor(1400);
    await page.clock.resume();
    const reversed = await waitForSettled(page);

    // It returns to a wide field, not a half-gathered remnant.
    expect(reversed.spanX).toBeGreaterThan(0.7);
    await expect(page.locator(".sculpture")).toHaveAttribute(
      "data-assembled",
      "false",
    );
  });

  test("keeps the field inside its stage across resizes", async ({ page }) => {
    await hydrate(page);
    const withinField = async () =>
      page.locator(".sculpture-canvas").evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        const rect = element.getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height) };
      });

    for (const width of [1280, 900, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          async () => {
            const size = await withinField();
            const field = await page
              .locator(".sculpture-field")
              .boundingBox();
            if (!field) return "no field";
            const matches =
              Math.abs(size.w - field.width) < 2 &&
              Math.abs(size.h - field.height) < 2;
            return matches ? "ok" : `${size.w}x${size.h} vs ${field.width}x${field.height}`;
          },
          { timeout: 10_000 },
        )
        .toBe("ok");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    }

    // Still assembles after all that resizing.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".sculpture").hover();
    await waitForState(page, "true");
    const assembled = await waitForSettled(page);
    expect(assembled.count).toBeGreaterThan(200);
  });
});

test.describe("After Hours sculpture on touch", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 393, height: 727 },
    deviceScaleFactor: 2,
  });

  test("toggles once per tap on the control and on the field", async ({
    page,
  }) => {
    await hydrate(page);
    await expect(page.locator(".sculpture")).toHaveAttribute(
      "data-assembled",
      "false",
    );

    // Control tap: the click must not also bubble into the field toggle.
    const control = page.getByRole("button", { name: /mark/ });
    await control.scrollIntoViewIfNeeded();
    await control.tap();
    await expect(page.locator(".sculpture")).toHaveAttribute(
      "data-assembled",
      "true",
    );
    await expect(control).toHaveText("Scatter the mark");
    await waitForSettled(page);

    // Field tap scatters.
    await page.locator(".sculpture-field").tap();
    await expect(page.locator(".sculpture")).toHaveAttribute(
      "data-assembled",
      "false",
    );
    await expect(control).toHaveText("Assemble the mark");

    // Field tap again assembles.
    await page.locator(".sculpture-field").tap();
    await expect(page.locator(".sculpture")).toHaveAttribute(
      "data-assembled",
      "true",
    );

    await expect(page.locator(".hint-coarse")).toBeVisible();
    await expect(page.locator(".hint-fine")).toBeHidden();
  });
});

test.describe("After Hours sculpture fallbacks", () => {
  test("shows the SVG mark and no dead control under reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toBeHidden();
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);

    // Both directions of a live preference change.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".sculpture-canvas")).toBeVisible();
    await expect(page.locator(".sculpture-control")).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-control")).toBeHidden();
  });

  test("falls back to the SVG mark when the canvas context is unavailable", async ({
    browser,
  }) => {
    // A browser that cannot provide a 2D context must not present a blank stage.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toBeHidden();
    // The rest of the page still works.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#contact-path a")).toHaveCount(3);
    await context.close();
  });

  test("shows the assembled mark and content without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toBeHidden();
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await context.close();
  });
});
