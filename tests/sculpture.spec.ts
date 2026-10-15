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
  spanX: number;
  spanY: number;
  density: number;
  profileX: number[];
  profileY: number[];
  /** Sum of the alpha channel, a cheap signature of the whole frame. */
  alphaSum: number;
};

const painted = (page: Page, selector: string, step = 2): Promise<Painted> =>
  page.evaluate(
    ({ selector, scan }) => {
      const element = document.querySelector<HTMLCanvasElement>(selector)!;
      const ctx = element.getContext("2d")!;
      const { width, height } = element;
      const data = ctx.getImageData(0, 0, width, height).data;
      let count = 0;
      let alphaSum = 0;
      const profileX = new Array<number>(width).fill(0);
      const profileY = new Array<number>(height).fill(0);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += scan) {
        for (let x = 0; x < width; x += scan) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 16) {
            count += 1;
            alphaSum += alpha;
            profileX[x] += alpha;
            profileY[y] += alpha;
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
        profileX,
        profileY,
        alphaSum,
      };
    },
    { selector, scan: step },
  );

const main = (page: Page, step = 2) => painted(page, ".sculpture-canvas", step);
const ambient = (page: Page, step = 2) =>
  painted(page, ".sculpture-ambient", step);

type Metrics = {
  scene: number;
  sticky: number;
  stickyTop: number;
  fieldW: number;
  fieldH: number;
  vw: number;
  vh: number;
  docW: number;
  gather: number;
  motion: string;
  collapsed: string;
  tether: number;
};

const metrics = (page: Page): Promise<Metrics> =>
  page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect();
    const scene = rect(".sculpture-scene");
    const sticky = rect(".sculpture-sticky");
    const field = rect(".sculpture-field");
    const sculpture = document.querySelector(".sculpture") as HTMLElement;
    return {
      scene: scene.height,
      sticky: sticky.height,
      stickyTop: sticky.top,
      fieldW: field.width,
      fieldH: field.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
      docW: document.documentElement.scrollWidth,
      gather: Number(sculpture.dataset.gather),
      motion: sculpture.dataset.motion ?? "",
      collapsed: sculpture.dataset.collapsed ?? "",
      tether: Number(sculpture.dataset.tether ?? 0),
    };
  });

/**
 * Scroll to a fraction of the scene's scrub length and return the pose the
 * component published for that position.
 *
 * The stage sticks for `scene - sticky` px of scroll, and the mark is broken apart
 * across exactly that distance, so a fraction of the scrub length is a position in
 * the gesture. The pose itself is read back rather than predicted: the component
 * computes it from the scroll position on the next frame, so this waits two frames
 * and reports what it actually published. That keeps the tests independent of how
 * the component maps scroll to pose — a test asserts the pose it observed, so a
 * wrong mapping fails instead of being mirrored.
 *
 * The scroll is forced instant so the wait measures the pose rather than the
 * stylesheet's smooth-scroll animation.
 */
const scrollToPose = async (page: Page, fraction: number) =>
  page.evaluate(async (value) => {
    const scene = document.querySelector<HTMLElement>(".sculpture-scene")!;
    const sticky = document.querySelector<HTMLElement>(".sculpture-sticky")!;
    const el = document.querySelector<HTMLElement>(".sculpture")!;
    const total = scene.offsetHeight - sticky.offsetHeight;
    window.scrollTo({ top: total * value, behavior: "instant" });
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // The scroll listener computes the pose in the frame it is queued for.
    await frame();
    await frame();
    return Number(el.dataset.gather);
  }, fraction);

/**
 * The painted frame at the middle of the scatter. It is reached by scrolling
 * halfway through the scene rather than by racing a transition.
 */
const sampleMidScatter = async (page: Page) => {
  await scrollToPose(page, 0.5);
  return main(page);
};

/** The live magnetic pull, in whole px, as the component publishes it. */
const pull = (page: Page) =>
  page
    .locator(".sculpture")
    .evaluate((el) => Number((el as HTMLElement).dataset.tether));

/**
 * Move in small steps with a pause between them. A single synthetic jump reads as
 * an extreme pointer speed, which correctly releases the pull.
 */
const slowMove = async (page: Page, fromX: number, toX: number, y: number) => {
  const direction = Math.sign(toX - fromX) || 1;
  for (let x = fromX; direction > 0 ? x <= toX : x >= toX; x += direction * 15) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(45);
  }
};

const hydrate = async (page: Page) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".sculpture-canvas");
    const box = document.querySelector(".sculpture-field")?.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 2);
    return document.querySelector<HTMLElement>(".sculpture")?.dataset.motion === "on" &&
      canvas && box &&
      canvas.width === Math.round(box.width * ratio) &&
      canvas.height === Math.round(box.height * ratio) &&
      document.fonts.status === "loaded";
  },
    undefined,
    { timeout: 10_000 },
  );
};

/** The traced artboard's aspect ratio, which a jittered shape would not match. */
const MARK_ASPECT = 402 / 272;

const expectAlignedProfile = (before: number[], after: number[]) => {
  // Blur individual strokes, then align the whole letterform rather than its
  // extreme pixels or brightness centroid (both change as the glyphs rotate).
  const smooth = (values: number[]) => values.map((_, i) =>
    values.slice(Math.max(0, i - 6), i + 7).reduce((sum, value) => sum + value, 0),
  );
  const a = smooth(before);
  const b = smooth(after);
  let similarity = -Infinity;
  let shift = 0;
  for (let offset = -24; offset <= 24; offset += 1) {
    let cross = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 24; i < a.length - 24; i += 1) {
      cross += a[i] * b[i + offset];
      aa += a[i] ** 2;
      bb += b[i + offset] ** 2;
    }
    const correlation = cross / Math.sqrt(aa * bb);
    if (correlation > similarity) {
      similarity = correlation;
      shift = offset;
    }
  }
  expect(similarity).toBeGreaterThan(0.95);
  expect(Math.abs(shift)).toBeLessThanOrEqual(4);
};

const expectStableMark = (before: Painted, after: Painted) => {
  expect(after.spanX).toBeGreaterThan(0.3);
  expect(after.spanX).toBeLessThan(0.62);
  expect(after.spanY).toBeGreaterThan(0.3);
  expect(after.spanY).toBeLessThan(0.7);
  expectAlignedProfile(before.profileX, after.profileX);
  expectAlignedProfile(before.profileY, after.profileY);
};

test.describe("After Hours opening scene", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("gathers the exact mark in a full-viewport opening", async ({ page }) => {
    await hydrate(page);
    const start = await metrics(page);

    // The opening is a scroll scene: the stage is one viewport and sticks inside
    // a scene 2.25 viewports tall, so the visitor's own scroll scrubs the mark
    // apart across the extra length. At the very top it is fully assembled.
    expect(start.gather).toBe(1);
    expect(Math.abs(start.scene - start.vh * 2.25)).toBeLessThan(
      start.vh * 0.02,
    );
    expect(Math.abs(start.sticky - start.vh)).toBeLessThan(2);
    expect(Math.abs(start.fieldH - start.vh)).toBeLessThan(2);
    expect(Math.abs(start.fieldW - start.vw)).toBeLessThan(2);
    expect(start.docW).toBe(start.vw);

    const gathered = await main(page);
    // The assembled silhouette is the mark: concentrated, and matching the
    // artboard aspect rather than an unrelated blob.
    expect(gathered.spanX).toBeLessThan(0.62);
    expect(gathered.spanY).toBeLessThan(0.7);
    const aspect = gathered.width / gathered.height;
    expect(Math.abs(aspect - MARK_ASPECT) / MARK_ASPECT).toBeLessThan(0.3);

    // The scene is taller than the viewport, but the document scrolls normally
    // past it: native scroll is the only input, and nothing locks the visitor in.
    await page.mouse.move(start.vw / 2, start.vh / 2);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("breaks the mark apart as the scene is scrubbed in, and reforms it coming back", async ({
    page,
  }) => {
    await hydrate(page);
    expect((await metrics(page)).gather).toBe(1);

    const poses: number[] = [];
    for (const fraction of [0.15, 0.3, 0.45, 0.6, 0.8, 1]) {
      poses.push(await scrollToPose(page, fraction));
    }
    // Gather only ever falls as the scene is scrubbed in, and reaches fully
    // scattered by the end of the scrub length.
    for (let index = 1; index < poses.length; index += 1) {
      expect(poses[index]).toBeLessThan(poses[index - 1]);
    }
    expect(poses[poses.length - 1]).toBe(0);

    // Scrolling back to the top reforms the mark exactly.
    await scrollToPose(page, 0);
    expect((await metrics(page)).gather).toBe(1);
  });

  test("scatters through the scene and reforms, leaving no letter silhouette", async ({
    page,
  }) => {
    await hydrate(page);
    const gathered = await main(page);

    await scrollToPose(page, 1);
    expect((await metrics(page)).gather).toBe(0);

    const scattered = await main(page);
    // A real cloud spans most of the field on both axes and stays sparse.
    expect(scattered.spanX).toBeGreaterThan(0.8);
    expect(scattered.spanY).toBeGreaterThan(0.8);
    expect(scattered.density).toBeLessThan(0.2);
    // Dispersal is not a merely jittered letterform: the footprint grows far
    // beyond the mark's own box.
    expect(scattered.spanX).toBeGreaterThan(gathered.spanX * 1.4);

    // Painted pixels reach all four corners, so no silhouette is retained.
    const corners = await page
      .locator(".sculpture-canvas")
      .evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        const ctx = element.getContext("2d")!;
        const { width, height } = element;
        const quadrants = [
          [0, 0],
          [Math.round(width / 2), 0],
          [0, Math.round(height / 2)],
          [Math.round(width / 2), Math.round(height / 2)],
        ];
        return quadrants.map(([x, y]) => {
          const data = ctx.getImageData(
            x,
            y,
            Math.round(width / 2),
            Math.round(height / 2),
          ).data;
          let count = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 16) count += 1;
          return count;
        });
      });
    for (const count of corners) expect(count).toBeGreaterThan(10);

    await scrollToPose(page, 0);
    expect((await metrics(page)).gather).toBe(1);
    expectStableMark(gathered, await main(page));
  });

  test("draws distinct gathered, opening and scattered states", async ({ page }) => {
    await hydrate(page);
    const gathered = await main(page);

    const midPainted = await sampleMidScatter(page);

    await scrollToPose(page, 1);
    const scattered = await main(page);

    // The three drawn states are genuinely different poses, not the same frame
    // sampled three times. Footprint alone is not monotonic here — a partly
    // scattered cloud can already reach the far particles — so the poses are
    // separated by their painted signature as well as by their extent.
    expect(midPainted.spanX).toBeGreaterThan(gathered.spanX * 1.15);
    expect(scattered.spanX).toBeGreaterThan(0.8);
    expect(midPainted.alphaSum).not.toBe(gathered.alphaSum);
    expect(scattered.alphaSum).not.toBe(midPainted.alphaSum);

    // Reforming returns the centered mark; glyphs keep rotating.
    await scrollToPose(page, 0);
    expectStableMark(gathered, await main(page));
  });

  test("does not intercept wheel input", async ({ page }) => {
    await hydrate(page);
    const prevented = await page.locator(".sculpture-field").evaluate((el) => {
      const event = new WheelEvent("wheel", {
        deltaY: 120,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
  });

  test("keeps the ambient sky alive at rest while the mark stays stable", async ({
    page,
  }) => {
    await hydrate(page);
    const first = await ambient(page);
    const firstMain = await main(page);
    expect(first.count).toBeGreaterThan(40);

    await page.waitForTimeout(1500);

    const second = await ambient(page);
    const secondMain = await main(page);

    // The ambient population changes in position, glyph and brightness on its
    // own clock, even with no interaction at all.
    expect(second.alphaSum).not.toBe(first.alphaSum);

    // The mark's anchors stay put while its glyph strokes can change shape.
    expect((await metrics(page)).gather).toBe(1);
    expectStableMark(firstMain, secondMain);
  });

  test("pulls the mark toward a fine pointer near the centre, and lets go", async ({
    page,
  }) => {
    // Deliberately slow: the pull only responds to a pointer that is not being
    // thrown across the screen, so the test has to move in small, paced steps.
    test.slow();
    // The pull is the assembled mark leaning toward the pointer, so it only
    // exists near the top of the page where the mark is still whole.
    await hydrate(page);
    const centre = await page.locator(".sculpture-field").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

    expect(await pull(page)).toBe(0);
    await slowMove(page, centre.x - 150, centre.x + 60, centre.y);
    await expect.poll(() => pull(page), { timeout: 5000 }).toBeGreaterThan(8);
    // Capped, so the mark can never end up glued to the pointer.
    expect(await pull(page)).toBeLessThanOrEqual(22);

    // Leaving the outer radius lets go.
    await slowMove(page, centre.x + 60, centre.x + 240, centre.y);
    await expect.poll(() => pull(page), { timeout: 5000 }).toBe(0);
  });

  test("never pulls for a pointer that cannot hover", async ({ browser }) => {
    test.slow();
    // A touch device has no pointer to aim with, so the pull must not exist at
    // all rather than merely being hard to trigger.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await hydrate(page);
    const centre = await page.locator(".sculpture-field").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await slowMove(page, centre.x - 150, centre.x + 60, centre.y);
    expect(await pull(page)).toBe(0);
    await context.close();
  });

  test("survives a resize in both poses without losing the stage", async ({
    page,
  }) => {
    await hydrate(page);
    await scrollToPose(page, 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await scrollToPose(page, 1);
    const small = await metrics(page);
    expect(Math.abs(small.fieldW - 390)).toBeLessThan(2);
    expect(small.docW).toBe(390);
    expect(small.gather).toBe(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(600);
    await scrollToPose(page, 1);
    const restored = await metrics(page);
    expect(Math.abs(restored.fieldH - restored.vh)).toBeLessThan(2);
    expect(restored.gather).toBe(0);

    await scrollToPose(page, 0);
    expect((await metrics(page)).gather).toBe(1);
    expect((await main(page)).spanX).toBeLessThan(0.62);
  });
});

test.describe("After Hours sculpture geometry", () => {
  test("keeps the projection bounded on a wide, short stage", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 3840, height: 600 });
    await hydrate(page);

    const bounds = await page.locator(".sculpture").evaluate((el) => {
      const node = el as HTMLElement;
      return {
        focal: Number(node.dataset.focal),
        bound: Number(node.dataset.depthBound),
      };
    });
    // The focal length must clear the proven depth bound or a rotated point
    // could cross the camera plane on this extreme aspect.
    expect(bounds.focal).toBeGreaterThan(bounds.bound);
    expect(bounds.focal - bounds.bound).toBeGreaterThan(100);

    const gathered = await main(page, 4);
    expect(gathered.count).toBeGreaterThan(200);
    expect((await metrics(page)).fieldW).toBe(3840);

    await scrollToPose(page, 1);
    const scattered = await main(page, 4);
    expect(scattered.count).toBeGreaterThan(200);
    expect(scattered.spanX).toBeGreaterThan(0.8);
    expect(errors).toEqual([]);
  });

  test("stays edge-to-edge and bounded at 4K", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 3840, height: 2160 });
    await hydrate(page);

    const bounds = await page.locator(".sculpture").evaluate((el) => {
      const node = el as HTMLElement;
      return {
        focal: Number(node.dataset.focal),
        bound: Number(node.dataset.depthBound),
      };
    });
    expect(bounds.focal).toBeGreaterThan(bounds.bound);

    const view = await metrics(page);
    // No legacy whole-page box: the field spans the full viewport width.
    expect(view.fieldW).toBe(3840);
    expect(view.docW).toBe(3840);
    const gathered = await main(page, 4);
    expect(gathered.count).toBeGreaterThan(200);

    // The fitted mark is capped at the 40rem desktop maximum, so it does not
    // balloon into fragmented strokes on a huge stage.
    const logical = await page
      .locator(".sculpture-canvas")
      .evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        const ctx = element.getContext("2d")!;
        const { width, height } = element;
        const data = ctx.getImageData(0, 0, width, height).data;
        let minX = width;
        let maxX = -1;
        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            if (data[(y * width + x) * 4 + 3] > 16) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
            }
          }
        }
        const dpr = width / element.getBoundingClientRect().width;
        return (maxX - minX + 1) / dpr;
      });
    expect(logical).toBeLessThanOrEqual(700);
    expect(errors).toEqual([]);
  });

  test("keeps the pre-paint SVG and hydrated mark the same size at 700px", async ({
    page,
  }) => {
    // The pre-paint SVG uses the same fit cap as buildParticles, so the visible
    // mark must not jump in size when the component hydrates on a narrow tablet.
    await page.route(/FlabSculpture\./, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const pre = await page
      .locator(".flab-mark svg")
      .evaluate((el) => el.getBoundingClientRect().width);
    // The mobile cap is 20rem, so the pre-paint mark is capped there.
    expect(pre).toBeLessThanOrEqual(321);

    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(700);
    const post = await page.locator(".sculpture-canvas").evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      const ctx = element.getContext("2d")!;
      const { width, height } = element;
      const data = ctx.getImageData(0, 0, width, height).data;
      let minX = width;
      let maxX = -1;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if (data[(y * width + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      const dpr = width / element.getBoundingClientRect().width;
      return (maxX - minX + 1) / dpr;
    });
    // No visible shrink or jump between the server SVG and the drawn mark.
    expect(Math.abs(post - pre)).toBeLessThan(20);
  });
});

test.describe("After Hours sculpture fallbacks", () => {
  test("collapses to a static mark and plain section links under reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(400);

    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);

    // Without a canvas there is nothing to scatter, so the four sections must
    // still be ordinary, reachable links — now the header's section list.
    const links = page.locator(".site-nav a");
    await expect(links).toHaveCount(4);
    await expect(links.first()).toHaveCSS("visibility", "visible");
    // No control is rendered, because there is nothing to open.
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    const view = await metrics(page);
    expect(view.motion).toBe("off");
    // No full-height spacer is reserved when there is no motion.
    expect(view.scene).toBeLessThan(view.vh);
    expect(view.stickyTop).toBeGreaterThanOrEqual(0);

    // The last link still lands the visitor on its section.
    await links.nth(3).click();
    await expect(page).toHaveURL(/#contact-path$/);
    await expect(page.locator("#contact-path-heading")).toBeInViewport();
  });

  test("shows the static mark, its section links, and content without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator(".intro-link")).toHaveCount(1);

    // The section links are in the served HTML, not built by the bundle, and each
    // one anchors to its section on the same page.
    expect(
      await page
        .locator(".site-nav a")
        .evaluateAll((els) => els.map((el) => el.getAttribute("href"))),
    ).toEqual([
      "#selected-evidence",
      "#technical-profile",
      "#learning-archive",
      "#contact-path",
    ]);

    const view = await page.evaluate(() => ({
      scene: document.querySelector(".sculpture-scene")!.getBoundingClientRect()
        .height,
      vh: window.innerHeight,
    }));
    expect(view.scene).toBeLessThan(view.vh);

    // The sections themselves still serve their content without the bundle.
    await expect(page.locator(".work-index > li")).toHaveCount(3);
    await context.close();
  });

  test("falls back and collapses when the canvas context is unavailable", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    const page = await context.newPage();
    await page.goto("/");
    // Wait past the pre-paint fallback that drops `html.motion`.
    await page.waitForTimeout(2600);

    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".intro-link")).toHaveCount(1);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    const view = await page.evaluate(() => ({
      scene: document.querySelector(".sculpture-scene")!.getBoundingClientRect()
        .height,
      vh: window.innerHeight,
      collapsed: (document.querySelector(".sculpture") as HTMLElement).dataset
        .collapsed,
      motion: (document.querySelector(".sculpture") as HTMLElement).dataset
        .motion,
    }));
    // A collapsed scene must win even while the pre-paint class is still on.
    expect(view.collapsed).toBe("true");
    expect(view.scene).toBeLessThan(view.vh);
    await context.close();
  });

  test("returns to full motion after a live preference change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(400);

    // Scatter the mark first: the preference change must reset the stage to a
    // complete mark rather than leaving a half-scattered cloud behind.
    await scrollToPose(page, 1);
    expect((await metrics(page)).gather).toBe(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(500);
    const reduced = await metrics(page);
    expect(reduced.motion).toBe("off");
    expect(reduced.gather).toBe(1);
    expect(reduced.scene).toBeLessThan(reduced.vh);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(600);
    // Back at the top of the reformed scene, the mark is whole again.
    await scrollToPose(page, 0);
    const restored = await metrics(page);
    expect(restored.motion).toBe("on");
    expect(restored.gather).toBe(1);
    expect(Math.abs(restored.sticky - restored.vh)).toBeLessThan(2);
    expect((await main(page)).count).toBeGreaterThan(200);
  });

  test("keeps drawing when the page-reveal module is aborted", async ({
    page,
  }) => {
    // The page's own animation module owns `html.motion`; aborting it must not
    // collapse the sculpture's independently-owned stage.
    await page.route(/index\.astro_astro_type_script/, (route) => route.abort());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForSelector(".sculpture-canvas", { timeout: 10_000 });
    // Wait past the 2s fallback that removes `html.motion`.
    await page.waitForTimeout(2600);

    await expect(page.locator(".sculpture-canvas")).toBeVisible();
    const view = await metrics(page);
    expect(view.motion).toBe("on");
    expect(Math.abs(view.sticky - view.vh)).toBeLessThan(2);
    const drawn = await main(page);
    expect(drawn.count).toBeGreaterThan(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
