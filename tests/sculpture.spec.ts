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
    };
  });

/** Scroll distance at which the sticky scene is fully dispersed. */
const sceneRange = async (page: Page) => {
  const { scene, sticky } = await metrics(page);
  return scene - sticky;
};

/** Sample native position and its published pose together while key scrolling runs. */
const nativePose = (page: Page) =>
  page.evaluate(() => {
    const scene = document.querySelector(".sculpture-scene")!;
    const sticky = document.querySelector(".sculpture-sticky")!;
    const range =
      scene.getBoundingClientRect().height - sticky.getBoundingClientRect().height;
    const progress = Math.min(
      1,
      Math.max(0, -scene.getBoundingClientRect().top / range),
    );
    const eased = progress * progress * (3 - 2 * progress);
    return {
      y: window.scrollY,
      expected: 1 - eased,
      gather: Number(document.querySelector<HTMLElement>(".sculpture")!.dataset.gather),
    };
  });

const scrollTo = async (page: Page, y: number) => {
  await page.evaluate(async (top) => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    const nextFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    while (Math.abs(window.scrollY - top) >= 1) await nextFrame();
    // Native scroll is sampled on a frame, then the next frame paints that pose.
    for (let frame = 0; frame < 2; frame += 1) {
      await nextFrame();
    }
  }, y);
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

test.describe("After Hours scroll sculpture", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("gathers the exact mark at the top of a full-viewport opening", async ({
    page,
  }) => {
    await hydrate(page);
    const start = await metrics(page);

    // The opening is genuinely full viewport: a sticky scene of ~2.25 screens
    // with the field exactly one viewport tall, edge to edge.
    expect(start.gather).toBe(1);
    expect(Math.abs(start.sticky - start.vh)).toBeLessThan(2);
    expect(Math.abs(start.fieldH - start.vh)).toBeLessThan(2);
    expect(Math.abs(start.fieldW - start.vw)).toBeLessThan(2);
    expect(start.scene).toBeGreaterThan(start.vh * 2.1);
    expect(start.scene).toBeLessThan(start.vh * 2.4);
    expect(start.docW).toBe(start.vw);

    const gathered = await main(page);
    // The assembled silhouette is the mark: concentrated, and matching the
    // artboard aspect rather than an unrelated blob.
    expect(gathered.spanX).toBeLessThan(0.62);
    expect(gathered.spanY).toBeLessThan(0.7);
    const aspect = gathered.width / gathered.height;
    expect(Math.abs(aspect - MARK_ASPECT) / MARK_ASPECT).toBeLessThan(0.3);

    // The opening has no hold: the very first scrolled pixel already breaks the
    // mark, so a small immediate scroll moves it. The longer scene lengthens the
    // transition, it does not add a plateau at the top.
    await scrollTo(page, 40);
    const afterSmall = await metrics(page);
    expect(afterSmall.gather).toBeLessThan(1);
    expect(afterSmall.gather).toBeGreaterThan(0.9);
    const moved = await main(page);
    expect(moved.alphaSum).not.toBe(gathered.alphaSum);
  });

  test("disperses on scroll and leaves no letter silhouette", async ({
    page,
  }) => {
    await hydrate(page);
    const gathered = await main(page);
    const total = await sceneRange(page);

    await scrollTo(page, total);
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
  });

  test("draws distinct gathered, mid-scroll and dispersed states", async ({
    page,
  }) => {
    await hydrate(page);
    const total = await sceneRange(page);

    // Sample each state independently, from its own scroll position.
    const gathered = await main(page);

    await scrollTo(page, total * 0.45);
    const mid = await metrics(page);
    expect(mid.gather).toBeGreaterThan(0.3);
    expect(mid.gather).toBeLessThan(0.8);
    const midPainted = await main(page);

    await scrollTo(page, total);
    expect((await metrics(page)).gather).toBe(0);
    const dispersed = await main(page);

    // The three drawn states are genuinely different poses, not the same frame
    // sampled three times: the mark's footprint grows from gathered, through
    // mid, to a cloud that spans most of the field.
    expect(midPainted.spanX).toBeGreaterThan(gathered.spanX * 1.15);
    expect(dispersed.spanX).toBeGreaterThan(midPainted.spanX);
    expect(dispersed.spanX).toBeGreaterThan(0.8);
    // Spread particles overlap less, so the mid frame paints more separate
    // pixels than the tightly packed mark.
    expect(midPainted.count).toBeGreaterThan(gathered.count);

    // Reversing back to the top reforms the centered mark; glyphs keep rotating.
    await scrollTo(page, 0);
    expect((await metrics(page)).gather).toBe(1);
    const reformed = await main(page);
    expectStableMark(gathered, reformed);
  });

  test("ignores hover and click; no dead control remains", async ({ page }) => {
    await hydrate(page);
    const before = await main(page);

    const field = page.locator(".sculpture-field");
    await field.hover();
    await page.mouse.click(640, 400);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);

    // Scroll is the only input, so the mark never disperses on its own.
    expect((await metrics(page)).gather).toBe(1);
    const after = await main(page);
    expectStableMark(before, after);

    // No pointer affordance, no button, no focus target on the stage.
    await expect(field).toHaveCSS("cursor", "auto");
    await expect(page.getByRole("button", { name: /mark/i })).toHaveCount(0);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);
    await expect(page.locator(".sculpture-hint")).toHaveCount(0);
    const focusable = await page
      .locator(".sculpture")
      .evaluate((el) => el.querySelectorAll("[tabindex]").length);
    expect(focusable).toBe(0);
  });

  test("lets native keyboard scrolling drive the drawn pose", async ({
    page,
  }) => {
    await hydrate(page);

    // Space and PageDown must remain ordinary page scrolling: the browser moves
    // the document and the sculpture reflects the new position. The component
    // never intercepts these keys.
    const followsNativePosition = async (previousY: number) => {
      await expect.poll(async () => {
        const pose = await nativePose(page);
        // Require a real pose change, not the first nearly-gathered scroll pixel.
        return pose.y > previousY && pose.expected < 0.95 &&
          Math.abs(pose.gather - pose.expected) < 0.005;
      }).toBe(true);
    };
    await page.locator("body").press("Space");
    await followsNativePosition(0);
    const afterSpace = await page.evaluate(() => window.scrollY);

    await page.locator("body").press("PageDown");
    await followsNativePosition(afterSpace);

    // Scrolling to the end fully disperses the mark.
    await scrollTo(page, await sceneRange(page));
    expect((await metrics(page)).gather).toBe(0);
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
    // own clock, even with no scrolling.
    expect(second.alphaSum).not.toBe(first.alphaSum);

    // The mark's anchors stay put while its glyph strokes can change shape.
    expect((await metrics(page)).gather).toBe(1);
    expectStableMark(firstMain, secondMain);
  });

  test("synchronizes with a deep link and with resizes", async ({ page }) => {
    await page.goto("/#contact-path");
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // A deep link lands past the scene. Offscreen canvas paint is intentionally
    // skipped; verify the live offset now and the visible pixels on returning.
    const deep = await metrics(page);
    expect(deep.gather).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const small = await metrics(page);
    expect(Math.abs(small.fieldW - 390)).toBeLessThan(2);
    expect(small.gather).toBe(0);
    expect(small.docW).toBe(390);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    // Drop the fragment before returning to the top: a lingering `#contact-path`
    // lets the browser re-anchor on resize, which would (correctly) leave the
    // scene dispersed and make this assertion meaningless.
    await page.evaluate(() => {
      history.replaceState(null, "", "/");
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => window.scrollY === 0, undefined, {
      timeout: 5000,
    });
    await scrollTo(page, 0);
    expect((await metrics(page)).gather).toBe(1);
    const reformed = await main(page);
    expect(reformed.spanX).toBeLessThan(0.62);
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

    const total = await sceneRange(page);
    await scrollTo(page, total);
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
    const logical = await page.locator(".sculpture-canvas").evaluate((canvas) => {
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
  test("collapses to a static mark without a dead sticky spacer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(400);

    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);

    const view = await metrics(page);
    expect(view.motion).toBe("off");
    // No full-height sticky spacer is reserved when there is no motion.
    expect(view.scene).toBeLessThan(view.vh);
    expect(view.stickyTop).toBeGreaterThanOrEqual(0);
  });

  test("shows the static mark and content without JavaScript", async ({
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
    await expect(page.locator(".work-index > li")).toHaveCount(3);

    const view = await page.evaluate(() => ({
      scene: document.querySelector(".sculpture-scene")!.getBoundingClientRect()
        .height,
      vh: window.innerHeight,
    }));
    expect(view.scene).toBeLessThan(view.vh);
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
    await expect(page.locator("#contact-path a")).toHaveCount(3);

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

  test("returns to full motion at the current scroll after a live preference change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(400);

    // A nonzero scroll position is what exposes desynchronization: the scene
    // must rebuild and reflect this offset, not reset to the top.
    const total = await sceneRange(page);
    await scrollTo(page, total * 0.5);
    const beforePreference = await metrics(page);
    expect(beforePreference.gather).toBeLessThan(0.95);
    expect(beforePreference.gather).toBeGreaterThan(0.05);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(500);
    const reduced = await metrics(page);
    expect(reduced.motion).toBe("off");
    expect(reduced.scene).toBeLessThan(reduced.vh);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(600);
    const restored = await metrics(page);
    expect(restored.motion).toBe("on");
    expect(Math.abs(restored.sticky - restored.vh)).toBeLessThan(2);
    // Full motion resumes at the current scroll position: the drawn pose matches
    // where the page actually is.
    expect(Math.abs(restored.gather - beforePreference.gather)).toBeLessThan(0.05);
    const paintedAgain = await main(page);
    expect(paintedAgain.count).toBeGreaterThan(200);
  });

  test("keeps drawing when the page-reveal module is aborted", async ({
    page,
  }) => {
    // The page's own animation module owns `html.motion`; aborting it must not
    // collapse the sculpture's independently-owned scene.
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
