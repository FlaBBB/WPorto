# Source Profile audit for Technical Profile

## Scope and method

This audit reconciles the supplied **Source Profiles** as evidence for the Portfolio Site's **Technical Profile**: a curated presentation of skills and technology stack for a Technical Collaborator. It is planning evidence, not a claim of employment history, seniority, or product outcomes.

The audit used publicly available first-party GitHub material on 2026-07-31. The supplied LinkedIn public URL was requested but returned HTTP 999 in this environment, so no LinkedIn headline, employment, education, skills, or dates are reported or inferred. [GitHub profile](https://api.github.com/users/FlaBBB) · [LinkedIn profile (inaccessible to this audit)](https://www.linkedin.com/in/fikri-flab/)

## Confirmed evidence

- The public GitHub profile names its account holder **Fikri Muhammad Abdillah**, lists **Indonesia** as the location, and reports **40 public repositories**. It has no public bio, company, or email in the profile response. [Source](https://api.github.com/users/FlaBBB)
- `FlaBBB/JMC` is a non-fork TypeScript repository described as a code judge. Its published README identifies a Next.js 16 App Router and TypeScript application with PostgreSQL/Prisma, NextAuth.js v5, Tailwind CSS v4, Bun, Docker, Piston-backed code execution, and support for JavaScript, Python, PHP, C++, and C submissions. [Repository and README](https://github.com/FlaBBB/JMC)
- `FlaBBB/WordyChain` is a non-fork TypeScript repository. Its public tree separates a realtime application, a web application, shared packages, and dictionary/game-core packages; it also includes realtime unit-flow tests, web end-to-end tests, and package-level tests. [Repository tree](https://github.com/FlaBBB/WordyChain)
- `FlaBBB/Cybers_security` is a non-fork repository whose stated purpose is a cybersecurity archive. Its public tree includes CTF material organized across cryptography, digital forensics, reverse engineering, and binary-exploitation directories. [Repository tree](https://github.com/FlaBBB/Cybers_security)
- The GitHub profile also includes several forks, including `hbctool`; forked repositories must not be presented as independently authored work without separate contribution evidence. [Repository inventory](https://api.github.com/users/FlaBBB/repos?per_page=100&type=owner&sort=updated)

## Cross-profile conflicts and gaps

- **LinkedIn is unavailable:** because the LinkedIn Source Profile could not be retrieved, this audit cannot confirm whether its identity, role, employment, education, timeline, or stated skills agrees with GitHub. It therefore finds no affirmative conflict; it records an unresolved comparison gap. [LinkedIn profile](https://www.linkedin.com/in/fikri-flab/)
- **Identity linkage is unconfirmed across the Source Profiles:** GitHub supplies the name “Fikri Muhammad Abdillah,” while the unavailable LinkedIn page supplies only its vanity URL to this audit. Do not state that the two profiles are the same person until the LinkedIn content or an owner-confirmed linkage is available. [GitHub profile](https://api.github.com/users/FlaBBB) · [LinkedIn profile](https://www.linkedin.com/in/fikri-flab/)
- **Repository ownership is not authorship, employment, or proficiency proof:** public repository metadata and file trees establish that material is publicly hosted by the account, but do not establish sole authorship, professional responsibility, deployment, or years of experience. The JMC README additionally says the project was written by AI, so use it as project/technology evidence only—not as standalone proof of individual implementation depth. [JMC README](https://github.com/FlaBBB/JMC)
- **Currentness is uneven:** `WordyChain` was pushed on 2026-06-02, while the security archive's public activity is older; show dated project evidence rather than presenting all listed technologies as a current personal stack. [WordyChain metadata](https://api.github.com/repos/FlaBBB/WordyChain) · [security archive metadata](https://api.github.com/repos/FlaBBB/Cybers_security)

## Recommended Technical Profile candidates

Use these only as evidence-backed, project-scoped claims; do not convert them into unqualified skill ratings.

1. **TypeScript web applications** — strongest candidate. The public JMC repository is TypeScript and documents a full web application stack; WordyChain independently exposes TypeScript web and realtime application structure. [JMC](https://github.com/FlaBBB/JMC) · [WordyChain](https://github.com/FlaBBB/WordyChain)
2. **Modular application design with automated tests** — candidate phrasing: “Built TypeScript projects with separate application and shared-package boundaries, including unit, flow, and end-to-end test directories.” This is directly visible in WordyChain's public tree, but should be owner-approved before attributing all implementation to one person. [WordyChain](https://github.com/FlaBBB/WordyChain)
3. **Project-specific web stack exposure** — candidate phrasing: “JMC documents Next.js, PostgreSQL/Prisma, NextAuth, Tailwind, Bun, Docker, and sandboxed multi-language code execution.” Keep the wording tied to JMC rather than asserting expertise in every tool. [JMC README](https://github.com/FlaBBB/JMC)
4. **Security-learning portfolio material** — candidate only if it supports the intended narrative: the public security archive visibly covers CTF-oriented cryptography, forensics, reverse engineering, and binary exploitation. Label it as an archive/learning record, not professional security experience. [Cybers_security](https://github.com/FlaBBB/Cybers_security)

Do **not** feature repository count, followers, forks, unverified LinkedIn information, employment claims, seniority, or a blanket list of every GitHub language as Technical Profile evidence. [GitHub profile](https://api.github.com/users/FlaBBB) · [repository inventory](https://api.github.com/users/FlaBBB/repos?per_page=100&type=owner&sort=updated)

## Evidence needed before final curation

1. Obtain an owner-authorized LinkedIn export, authenticated view, or supplied text and reconcile the name, role, employment/education dates, and stated skills with the GitHub account.
2. Have the owner confirm which repositories and components they personally authored or maintained, especially where the repository is a fork or self-describes AI-generated work.
3. Select one or two approved projects with a concise problem, contribution, technical decision, and outcome; attach source links or demos. This would turn the candidates above into compelling Technical Profile evidence for a Technical Collaborator.
