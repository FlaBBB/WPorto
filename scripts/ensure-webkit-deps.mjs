// Playwright's WebKit engine is built against the system libraries of a
// specific Ubuntu release. On a distribution whose own libraries moved past
// that release (Fedora ships ICU 77, WebKit 2336 wants ICU 74), the engine
// cannot start at all:
//
//   MiniBrowser: error while loading shared libraries: libicudata.so.74
//
// `npx playwright install --with-deps` only knows how to satisfy this through
// apt-get, so on those distributions the browser acceptance suite silently
// loses its WebKit engine. This module closes that gap: it reads which
// libraries the installed engine is actually missing, resolves the Ubuntu
// binary package that provides each one, and unpacks just those shared objects
// into the engine bundle's own `sys/lib` directory — the same directory the
// bundle already uses for the system libraries it ships alongside itself.
//
// It runs as the Playwright global setup, so every `npm test` invocation is
// covered, and it is a no-op on hosts where the engine resolves everything
// (Ubuntu CI, or a machine that already provisioned the libraries). Playwright
// never verifies the bundle contents, so `npx playwright install` can wipe
// `sys/lib` again; the next run simply re-provisions it.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const run = promisify(execFile);

// Suites are searched in order; a package present in both takes the later
// entry, which is the security-updated build of the same source package.
const SUITES = ["noble", "noble-updates"];
const ARCHIVE = "https://archive.ubuntu.com/ubuntu";
const CACHE_ROOT = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "wporto", "webkit-compat");

// The Ubuntu binary package that provides each library the engine asks for.
// Playwright pins the WebKit revision in its lock file, so this table only has
// to move when the pinned revision starts expecting a different library.
const PROVIDERS = [
  { soname: /^libicu(?:data|i18n|uc)\.so\.74$/, pkg: "libicu74" },
  { soname: /^libjpeg\.so\.8$/, pkg: "libjpeg-turbo8" },
];

const ARCH = { x64: "amd64", arm64: "arm64" };

export default async function ensureWebkitDeps() {
  if (process.platform !== "linux") return;

  const arch = ARCH[process.arch];
  if (!arch) return;

  const bundles = await engineBundles();
  if (bundles.length === 0) return; // engines not installed yet; `playwright install` owns that

  const gaps = [];
  for (const bundle of bundles) {
    const missing = await missingLibraries(bundle);
    if (missing.length > 0) gaps.push({ bundle, missing });
  }
  if (gaps.length === 0) return;

  const wanted = [...new Set(gaps.flatMap((gap) => gap.missing))];
  const unknown = wanted.filter((soname) => !PROVIDERS.some((entry) => entry.soname.test(soname)));
  if (unknown.length > 0) {
    console.warn(
      `The WebKit engine asks for system libraries this host does not have: ${unknown.join(", ")}. ` +
        `Install the equivalents with dnf; the WebKit project cannot start until then.`,
    );
  }

  const packages = [...new Set(PROVIDERS.filter((entry) => wanted.some((soname) => entry.soname.test(soname))).map((entry) => entry.pkg))];
  if (packages.length === 0) return;

  try {
    for (const pkg of packages) {
      const deb = await download(pkg, arch);
      const extracted = await extract(deb);
      const files = await collect(join(extracted, "usr", "lib"), wanted);
      if (files.length === 0) throw new Error(`${pkg} did not contain any of ${wanted.join(", ")}`);

      for (const { bundle } of gaps) {
        const target = join(bundle, "sys", "lib");
        await mkdir(target, { recursive: true });
        for (const { source, name, link } of files) {
          const destination = join(target, name);
          await rm(destination, { force: true });
          if (link) await symlink(link, destination);
          else await writeFile(destination, await readFile(source));
        }
      }
    }

    for (const { bundle, missing } of gaps) {
      const stillMissing = (await missingLibraries(bundle)).filter((soname) => missing.includes(soname));
      if (stillMissing.length > 0) {
        throw new Error(`${bundle} still cannot load ${stillMissing.join(", ")} after provisioning ${packages.join(", ")}`);
      }
    }
  } catch (error) {
    // Only the WebKit project depends on this; Chromium and Firefox must still
    // run, and WebKit's own launch error names what is missing.
    console.warn(`Could not supply the WebKit engine's system libraries (${packages.join(", ")}): ${error.message}`);
  }
}

// The installed engine's directory, taken from Playwright itself so that
// PLAYWRIGHT_BROWSERS_PATH and revision bumps are honoured without guessing.
async function engineBundles() {
  let root;
  try {
    const { webkit } = await import("@playwright/test");
    root = dirname(webkit.executablePath());
  } catch {
    return [];
  }
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("minibrowser-"))
    .map((entry) => join(root, entry.name))
    .filter((bundle) => existsSync(join(bundle, "bin", "MiniBrowser")));
}

// Ask the dynamic linker what it cannot resolve, using the same search path the
// bundle's own launcher sets.
async function missingLibraries(bundle) {
  const search = `${join(bundle, "lib")}:${join(bundle, "sys", "lib")}`;
  const { stdout } = await run("ldd", [join(bundle, "bin", "MiniBrowser")], {
    env: { ...process.env, LD_LIBRARY_PATH: search },
    maxBuffer: 8 * 1024 * 1024,
  });
  const missing = new Set();
  for (const line of stdout.split("\n")) {
    const match = /^\s*(\S+)\s+=>\s+not found\s*$/.exec(line);
    if (match) missing.add(match[1]);
  }
  return [...missing];
}

// Every file under `root` whose name is one of the wanted sonames or a
// versioned sibling of one, paired with the link target for symlinks.
async function collect(root, wanted) {
  const found = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...(await collect(path, wanted)));
    else if (entry.isSymbolicLink()) {
      const link = await readlink(path);
      if (wanted.some((soname) => link === soname || link.startsWith(`${soname}.`))) {
        found.push({ source: path, name: entry.name, link: basename(link) });
      }
    } else if (wanted.some((soname) => entry.name === soname || entry.name.startsWith(`${soname}.`))) {
      found.push({ source: path, name: entry.name, link: null });
    }
  }
  return found;
}

async function download(pkg, ubuntu) {
  const stanza = await resolve(pkg, ubuntu);
  const deb = join(CACHE_ROOT, `${pkg}_${stanza.Version}_${ubuntu}.deb`);
  if (!existsSync(deb)) {
    const bytes = await fetchBytes(`${ARCHIVE}/${stanza.Filename}`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== stanza.SHA256) throw new Error(`${pkg} checksum mismatch: expected ${stanza.SHA256}, got ${digest}`);
    await mkdir(CACHE_ROOT, { recursive: true });
    await writeFile(deb, bytes);
  }
  return deb;
}

// A single dropped connection should not cost a whole acceptance run.
async function fetchBytes(url) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      failure = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw failure;
}

async function resolve(pkg, ubuntu) {
  let found;
  for (const suite of SUITES) {
    const url = `${ARCHIVE}/dists/${suite}/main/binary-${ubuntu}/Packages.gz`;
    const index = gunzipSync(await fetchBytes(url)).toString("utf8");
    for (const stanza of index.split("\n\n")) {
      const fields = Object.fromEntries(
        stanza
          .split("\n")
          .filter((line) => line.includes(": "))
          .map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)]),
      );
      if (fields.Package === pkg && fields.Architecture === ubuntu && fields.Filename) found = fields;
    }
  }
  if (!found) throw new Error(`${pkg} is not published for ${ubuntu} in ${SUITES.join(", ")}`);
  return found;
}

async function extract(deb) {
  const destination = join(CACHE_ROOT, basename(deb, ".deb"));
  if (existsSync(join(destination, ".extracted"))) return destination;
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  try {
    await run("dpkg-deb", ["-x", deb, destination]);
  } catch {
    // No dpkg-deb (non-Debian host): a .deb is an ar archive holding the
    // payload tarball, so pull that member out and unpack it.
    const { stdout } = await run("ar", ["t", deb]);
    const payload = stdout.split("\n").find((name) => name.startsWith("data.tar"));
    if (!payload) throw new Error(`${deb} has no data.tar member`);
    const { stdout: tarball } = await run("ar", ["p", deb, payload], { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 });
    const staged = join(destination, payload);
    await writeFile(staged, tarball);
    await run("bsdtar", ["-xf", staged, "-C", destination]);
    await rm(staged, { force: true });
  }
  await writeFile(join(destination, ".extracted"), "");
  return destination;
}

// `npm run webkit:deps` runs this directly; Playwright imports the same
// function as its global setup.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await ensureWebkitDeps();
}
