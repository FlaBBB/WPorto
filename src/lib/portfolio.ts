/**
 * The Portfolio Site's content.
 *
 * Everything a visitor reads, and every address they can follow, lives here so
 * the page composes markup instead of restating copy. The section list comes from
 * `sections`, because it is also the header navigation's data.
 */

import { SECTIONS } from "./sections";

export const ownerName = "Fikri Muhammad Abdillah";

export const githubProfile = "https://github.com/FlaBBB";
export const linkedInProfile = "https://www.linkedin.com/in/fikri-flab/";
export const email = "f12345ff67@gmail.com";

export const description =
  "Fikri Muhammad Abdillah’s Portfolio Site: explore TypeScript web and realtime projects, agentic SDLC tooling, and a security-learning archive through public source material.";

/** The four sections, shared with the header's section links. */
export const sections = SECTIONS;

export const profileRecords = [
  {
    capability: "TypeScript web applications",
    observedEvidence:
      "TypeScript web and realtime application structure is publicly visible across WordyChain, JMC, and the harness-agentic-sdlc workflow tooling.",
    qualification:
      "Public repositories establish hosted project material, not individual proficiency level, employment history, or sole authorship.",
    sources: [
      { name: "WordyChain", href: "https://github.com/FlaBBB/WordyChain" },
      { name: "JMC", href: "https://github.com/FlaBBB/JMC" },
      {
        name: "harness-agentic-sdlc",
        href: "https://github.com/FlaBBB/harness-agentic-sdlc",
      },
    ],
  },
  {
    capability: "Modular application design with automated tests",
    observedEvidence:
      "WordyChain visibly separates realtime and web applications from shared, dictionary, and game-core packages, with unit-flow, end-to-end, and package-level tests; OOT-AI-Agent-Practice pairs a Java store with JUnit 5 tests and a business-rule verifier.",
    qualification:
      "Visible project structure and tests do not establish authorship of every component.",
    sources: [
      { name: "WordyChain", href: "https://github.com/FlaBBB/WordyChain" },
      {
        name: "OOT-AI-Agent-Practice",
        href: "https://github.com/FlaBBB/OOT-AI-Agent-Practice",
      },
    ],
  },
  {
    capability: "Project-specific web-stack exposure",
    observedEvidence:
      "JMC documents Next.js App Router, TypeScript, PostgreSQL/Prisma, NextAuth.js v5, Tailwind CSS v4, Bun, Docker, Piston-backed code execution, and multiple submission languages.",
    qualification:
      "This is JMC’s documented stack, not a personal proficiency claim; the README says the project was written by AI.",
    sources: [{ name: "JMC", href: "https://github.com/FlaBBB/JMC" }],
  },
  {
    capability: "Agentic SDLC workflow tooling",
    observedEvidence:
      "harness-agentic-sdlc publishes a TypeScript CLI and repository-local governance: a request-to-deploy lifecycle, structured YAML workflows, approval and CI evidence, a Mission Control projection, and machine-readable JSON output.",
    qualification:
      "This describes the project’s documented capabilities, not verified personal authorship, adoption, or production use.",
    sources: [
      {
        name: "harness-agentic-sdlc",
        href: "https://github.com/FlaBBB/harness-agentic-sdlc",
      },
    ],
  },
  {
    capability: "Security-learning archive",
    observedEvidence:
      "A public cybersecurity archive spans cryptography, digital forensics, reverse engineering, binary exploitation, and smart-contract security, drawn from many CTF platforms and paired with supporting tools and cheatsheets.",
    qualification:
      "A learning archive, not professional security work, a certification, or production security responsibility.",
    sources: [
      {
        name: "Cybers_security",
        href: "https://github.com/FlaBBB/Cybers_security",
      },
    ],
  },
  {
    capability: "Reconciled professional and competition profile",
    observedEvidence:
      "The LinkedIn Source Profile lists an engineering role at Six Zenith Digital, study at Politeknik Negeri Malang, and active Capture The Flag participation; the linked CTFtime profile records competition teams and published writeups since 2023.",
    qualification:
      "Profile-stated and self-reported; not independently verified, and not a claim of seniority, employment terms, or professional security responsibility.",
    sources: [
      { name: "LinkedIn", href: linkedInProfile },
      { name: "CTFtime", href: "https://ctftime.org/user/156246" },
    ],
  },
];

export const projects = [
  {
    id: "wordychain",
    index: "01",
    name: "WordyChain",
    deck: "Realtime and web boundaries, kept visible.",
    structureLabel: "Visible WordyChain packages",
    structure: ["web", "realtime", "shared", "dictionary", "game-core"],
    copy: "Public project structure separates realtime, web, shared, dictionary, and game-core packages; unit-flow, end-to-end, and package-level test directories are visible.",
    scopeNote:
      "Repository structure is evidence of visible project organization, not a claim of exclusive authorship.",
    href: "https://github.com/FlaBBB/WordyChain",
  },
  {
    id: "jmc",
    index: "02",
    name: "JMC",
    deck: "A documented web application stack.",
    structureLabel: "Documented JMC stack",
    structure: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Docker"],
    copy: "JMC documents a Next.js and TypeScript application with PostgreSQL/Prisma, NextAuth.js, Tailwind CSS, Bun, Docker, and sandboxed multi-language code execution.",
    scopeNote:
      "This describes JMC’s documented stack. It does not assert individual authorship or proficiency; its README says the project was written by AI.",
    href: "https://github.com/FlaBBB/JMC",
  },
  {
    id: "harness",
    index: "03",
    name: "harness-agentic-sdlc",
    deck: "Workflow governance for agent-driven delivery.",
    structureLabel: "Documented harness-agentic-sdlc surface",
    structure: ["TypeScript", "CLI", "YAML workflows", "Mission Control", "JSON output"],
    copy: "A repository-local harness publishes a request-to-deploy lifecycle with structured workflows, approval and CI evidence, a Mission Control projection for multi-feature work, and machine-readable output.",
    scopeNote:
      "This describes the project’s documented capabilities, not verified personal authorship or production adoption.",
    href: "https://github.com/FlaBBB/harness-agentic-sdlc",
  },
];
