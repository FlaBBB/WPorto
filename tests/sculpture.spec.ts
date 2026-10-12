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
  map: string;
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
      map: sculpture.dataset.map ?? "",
      tether: Number(sculpture.dataset.tether ?? 0),
    };
  });

/**
 * The drawn pose settles on its own clock, so a test waits for the published
 * gather rather than assuming a frame count.
 *
 * The polling interval is fixed rather than frame-driven, and the budget is
 * generous: a loaded CI host can starve the animation loop, and what is being
 * asserted is the pose, not how quickly the host reached it.
 */
const settlePose = async (page: Page, target: number) =>
  page.waitForFunction(
    (value) =>
      Math.abs(
        Number(
          document.querySelector<HTMLElement>(".sculpture")!.dataset.gather,
        ) - value,
      ) < 0.002,
    target,
    { timeout: 15_000, polling: 100 },
  );

/** Activate the mark the way a visitor does, and wait for the scatter to settle. */
const openMap = async (page: Page) => {
  await page.locator(".sculpture-control").click();
  await settlePose(page, 0);
  await page.waitForSelector('.sculpture[data-map="open"]', { timeout: 6000 });
};

/**
 * Click a destination star where it actually is.
 *
 * The stars turn with the cloud, so a click has to be aimed at a live position
 * rather than at a cached one, and Playwright's own actionability check would
 * wait forever for a continuously moving element to hold still. Aiming a real
 * pointer at the star's current centre is also what a visitor does.
 */
const clickStar = async (page: Page, index: number) => {
  const box = (await page.locator(".sculpture-star").nth(index).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

/** Reform the mark from the keyboard, which is the documented way back. */
const closeMap = async (page: Page) => {
  await page.keyboard.press("Escape");
  await settlePose(page, 1);
};

/** The published pose: 1 fully assembled, 0 fully scattered. */
const poseOf = (page: Page) =>
  page.evaluate(() =>
    Number(document.querySelector<HTMLElement>(".sculpture")!.dataset.gather),
  );

/**
 * Record the scatter transition and return the sample nearest its middle.
 *
 * Sampling a transition that lasts well under a second is inherently racy: a
 * single wait can miss the band between polls, and a wide band admits poses that
 * are still nearly gathered. So the pairs are recorded as densely as the host
 * allows and the middle one is chosen afterwards, with a bounded retry for the
 * case where a loaded host only managed a couple of samples.
 */
const sampleScatter = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator(".sculpture-control").click();
    const samples: { pose: number; painted: Painted }[] = [];
    for (let step = 0; step < 200; step += 1) {
      const [pose, painted] = await Promise.all([poseOf(page), main(page)]);
      samples.push({ pose, painted });
      if (pose === 0) break;
    }
    const middle = samples.reduce((best, sample) =>
      Math.abs(sample.pose - 0.5) < Math.abs(best.pose - 0.5) ? sample : best,
    );
    if (Math.abs(middle.pose - 0.5) < 0.25) return middle.painted;
    // The transition was missed rather than measured: reform and try again.
    await closeMap(page);
  }
  throw new Error("the scatter was never sampled near its middle");
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

test.describe("After Hours section map", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("gathers the exact mark in a full-viewport opening that scroll never moves", async ({
    page,
  }) => {
    await hydrate(page);
    const start = await metrics(page);

    // The opening is exactly one viewport and is no longer a scroll scene, so
    // there is no scroll length left to scrub and no sticky spacer to leave.
    expect(start.gather).toBe(1);
    expect(start.map).toBe("closed");
    expect(Math.abs(start.scene - start.vh)).toBeLessThan(2);
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

    // The opening does not scroll. The visitor reaches a section through the map,
    // not by scrolling past the map into it, so wheel and keyboard scrolling must
    // leave the document exactly where it is — and the mark with it.
    await page.mouse.move(start.vw / 2, start.vh / 2);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(500);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect((await metrics(page)).gather).toBe(1);
    expectStableMark(gathered, await main(page));
  });

  test("still moves the document when a destination is chosen", async ({ page }) => {
    // The counter-contract to the scroll lock: the root is not scrollable by the
    // visitor, but the box stays scrollable programmatically, which is what the
    // hash destinations and the reveal module depend on.
    await hydrate(page);
    await openMap(page);

    await clickStar(page, 3);
    await page.waitForURL(/#contact-path$/);

    // The landing is smooth, so wait for it rather than measuring the first frame
    // the document has moved at all.
    const heading = page.locator("#contact-path-heading");
    await expect
      .poll(async () => (await heading.boundingBox())!.y, { timeout: 15_000 })
      .toBeLessThan(page.viewportSize()!.height);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const box = (await heading.boundingBox())!;
    const header = (await page.locator(".site-header").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  });

  test("turns the constellation with the cloud it came from", async ({ page }) => {
    await hydrate(page);
    await openMap(page);
    // Let the figure finish easing out, so what is measured is the turn.
    await page.waitForTimeout(800);

    const star = page.locator(".sculpture-star").first();
    const start = (await star.boundingBox())!;
    // The stars are particles of the mark, so they must keep moving with the
    // field's rotation rather than sitting on fixed screen points.
    await expect
      .poll(
        async () => {
          const now = (await star.boundingBox())!;
          return Math.hypot(now.x - start.x, now.y - start.y);
        },
        { timeout: 12_000, intervals: [200] },
      )
      .toBeGreaterThan(6);
  });

  test("never paints its own box across the sky while it resizes", async ({
    page,
  }) => {
    // Closed, the control is the size of the whole mark; open, it is a small
    // circle. Animating its surface or its transform across that resize paints a
    // large rectangle over the star field for the length of the transition, so
    // the control must not transition those properties at all.
    await hydrate(page);
    const control = page.locator(".sculpture-control");
    const transitioned = await control.evaluate(
      (el) => getComputedStyle(el).transitionProperty,
    );
    expect(transitioned).not.toContain("background-color");
    expect(transitioned).not.toContain("transform");

    await openMap(page);
    await control.click();
    // Sampled with no wait: with no surface transition the control is already
    // transparent on the frame it closes.
    const background = await control.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(background).toBe("rgba(0, 0, 0, 0)");
    await settlePose(page, 1);
  });

  test("scatters on activation and reforms, leaving no letter silhouette", async ({
    page,
  }) => {
    await hydrate(page);
    const gathered = await main(page);

    await openMap(page);
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

    await closeMap(page);
    expect((await metrics(page)).gather).toBe(1);
    expect((await metrics(page)).map).toBe("closed");
    expectStableMark(gathered, await main(page));
  });

  test("draws distinct gathered, opening and scattered states", async ({ page }) => {
    await hydrate(page);
    const gathered = await main(page);

    const midPainted = await sampleScatter(page);

    await settlePose(page, 0);
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
    await closeMap(page);
    expectStableMark(gathered, await main(page));
  });

  test("opens and closes from the mark itself, and from empty sky", async ({
    page,
  }) => {
    await hydrate(page);
    const control = page.locator(".sculpture-control");
    await expect(control).toHaveAttribute("aria-expanded", "false");
    await expect(control).toHaveAttribute("aria-label", "Open the section map");

    await control.click();
    await settlePose(page, 0);
    await expect(control).toHaveAttribute("aria-expanded", "true");
    await expect(control).toHaveAttribute("aria-label", "Close the section map");

    // Activating the mark again reforms it.
    await control.click();
    await settlePose(page, 1);
    await expect(control).toHaveAttribute("aria-expanded", "false");

    // A click on empty sky reforms it too, and leaves the control live. The map
    // phase is asserted first so a click that never landed is reported as such
    // rather than as a pose that never settled.
    await control.click();
    await settlePose(page, 0);
    await page.mouse.click(40, 720);
    await expect(page.locator(".sculpture")).toHaveAttribute("data-map", "closed");
    await settlePose(page, 1);
    expect((await metrics(page)).map).toBe("closed");
    await expect(control).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps every destination reachable, in reading order, and its label on screen", async ({
    page,
  }) => {
    await hydrate(page);
    const map = page.locator(".sculpture-map");
    await expect(map).toBeHidden();
    await openMap(page);
    await expect(map).toBeVisible();

    const stars = page.locator(".sculpture-star");
    await expect(stars).toHaveCount(4);
    expect(
      await stars.evaluateAll((els) => els.map((el) => el.textContent?.trim())),
    ).toEqual(["Work", "Profile", "Archive", "Contact"]);

    // Every star is a real target of at least 44x44, and the anchors run left to
    // right so the tab order matches the visual order.
    const boxes = await stars.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, width: box.width, height: box.height };
      }),
    );
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x);
    }

    // Hovering brightens the destination. Nothing here asserts a fixed screen
    // position any more: the stars are particles of the mark, so they move with
    // it by design, and the label follows the star rather than the reverse.
    const first = stars.first();
    const restingColour = await first.evaluate(
      (el) => getComputedStyle(el).color,
    );
    const target = (await first.boundingBox())!;
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 6 },
    );
    await expect
      .poll(() => first.evaluate((el) => getComputedStyle(el).color), {
        timeout: 10_000,
      })
      .not.toBe(restingColour);

    // What motion does risk is a label riding its star off the stage or under the
    // header, so that is what is held while the figure turns. The sampling is
    // deliberately short: the star's own extent is bounded by the projection
    // bound, which is tested separately, and that the labels keep moving with the
    // cloud is a test of its own. What is left to hold here is that the render's
    // placement puts them inside the stage rather than, say, at the stage corner
    // it measures from.
    const header = (await page.locator(".site-header").boundingBox())!;
    const viewport = page.viewportSize()!;
    for (let sample = 0; sample < 4; sample += 1) {
      for (const box of await stars.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      )) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        expect(box.top).toBeGreaterThanOrEqual(header.y + header.height);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      }
      await page.waitForTimeout(400);
    }
  });

  test("takes no pointer events while the stars are still flying", async ({
    page,
  }) => {
    await hydrate(page);
    // The opening phase is brief, so it is recorded from inside the page rather
    // than raced from the outside.
    await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".sculpture")!;
      const seen: { phase: string; pointerEvents: string }[] = [];
      (window as unknown as { __phases: typeof seen }).__phases = seen;
      const record = () =>
        seen.push({
          phase: stage.dataset.map ?? "",
          pointerEvents: getComputedStyle(
            document.querySelector(".sculpture-star")!,
          ).pointerEvents,
        });
      record();
      new MutationObserver(record).observe(stage, {
        attributes: true,
        attributeFilter: ["data-map"],
      });
    });

    await page.locator(".sculpture-control").click();
    await page.waitForSelector('.sculpture[data-map="open"]', { timeout: 6000 });

    const seen = await page.evaluate(
      () => (window as unknown as { __phases: { phase: string; pointerEvents: string }[] }).__phases,
    );
    const opening = seen.find((entry) => entry.phase === "opening");
    const open = seen.find((entry) => entry.phase === "open");
    // While the stars are flying they must not accept a click...
    expect(opening?.pointerEvents).toBe("none");
    // ...and once they settle they must.
    expect(open?.pointerEvents).toBe("auto");
  });

  test("hands keyboard focus to the section heading it navigates to", async ({
    page,
  }) => {
    await hydrate(page);
    const control = page.locator(".sculpture-control");
    await control.focus();
    await page.keyboard.press("Enter");
    await settlePose(page, 0);
    await page.waitForSelector('.sculpture[data-map="open"]', { timeout: 6000 });

    // Forward tabbing from the control that opened the map reaches the four
    // destinations in order.
    const stops: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Tab");
      stops.push(
        (await page.evaluate(() => document.activeElement?.textContent?.trim())) ??
          "",
      );
    }
    expect(stops).toEqual(["Work", "Profile", "Archive", "Contact"]);

    await page.keyboard.press("Enter");
    await page.waitForURL(/#contact-path$/);
    await expect(page.locator("#contact-path-heading")).toBeFocused();
    const heading = (await page.locator("#contact-path-heading").boundingBox())!;
    const header = (await page.locator(".site-header").boundingBox())!;
    // The transparent fixed header must not cover the landing.
    expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await expect(control).toHaveAttribute("aria-expanded", "false");
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
    await openMap(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const small = await metrics(page);
    expect(Math.abs(small.fieldW - 390)).toBeLessThan(2);
    expect(small.docW).toBe(390);
    expect(small.gather).toBe(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(600);
    const restored = await metrics(page);
    expect(Math.abs(restored.fieldH - restored.vh)).toBeLessThan(2);
    expect(restored.gather).toBe(0);

    await closeMap(page);
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

    await openMap(page);
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
  test("collapses to a static mark and a plain section list under reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(400);

    await expect(page.locator(".flab-mark svg")).toBeVisible();
    await expect(page.locator(".sculpture-canvas")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/\bmotion\b/);

    // Without a canvas there is nothing to scatter, so the four destinations must
    // still be an ordinary, clickable list.
    const stars = page.locator(".sculpture-star");
    await expect(stars).toHaveCount(4);
    await expect(stars.first()).toHaveCSS("visibility", "visible");
    await expect(page.locator(".sculpture-map")).toHaveCSS("position", "static");
    // No control is rendered, because there is nothing to open.
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    const view = await metrics(page);
    expect(view.motion).toBe("off");
    // No full-height spacer is reserved when there is no motion.
    expect(view.scene).toBeLessThan(view.vh);
    expect(view.stickyTop).toBeGreaterThanOrEqual(0);

    await stars.nth(3).click();
    await expect(page).toHaveURL(/#contact-path$/);
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
    await expect(page.locator(".work-index > li")).toHaveCount(3);

    // The destinations are in the served HTML, not built by the bundle.
    expect(
      await page
        .locator(".sculpture-star")
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

    // Open the map first: the preference change must reset the stage to a
    // complete mark rather than leaving a half-scattered cloud behind.
    await openMap(page);
    await expect(page.locator(".sculpture-control")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(500);
    const reduced = await metrics(page);
    expect(reduced.motion).toBe("off");
    expect(reduced.map).toBe("closed");
    expect(reduced.gather).toBe(1);
    expect(reduced.scene).toBeLessThan(reduced.vh);
    await expect(page.locator(".sculpture-control")).toHaveCount(0);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForSelector('.sculpture[data-motion="on"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(600);
    const restored = await metrics(page);
    expect(restored.motion).toBe("on");
    expect(restored.gather).toBe(1);
    expect(Math.abs(restored.sticky - restored.vh)).toBeLessThan(2);
    expect((await main(page)).count).toBeGreaterThan(200);
    await expect(page.locator(".sculpture-control")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
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
