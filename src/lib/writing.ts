/**
 * The Writing section's content: one published writeup and the challenges it
 * covers.
 *
 * The site keeps the writeup's structure — the event, the result, and each
 * challenge's approach — and sends the reader to Medium for the full post,
 * where the screenshots, tool output and source listings live. The five
 * challenge posts are not separate articles here; they are the contents of the
 * TCP1P writeup, which is how the writeup itself presents them.
 */

/** An image in a writeup: the cover, or a figure inside a challenge. */
export type WritingImage = {
  src: string;
  /** What the image shows, for a reader who cannot see it. */
  alt: string;
  /** The line printed under it, as a caption. */
  caption: string;
};

export type WritingChallenge = {
  /** A stable key, also the anchor of its section on the writeup page. */
  slug: string;
  name: string;
  /** The challenge's value in the event. */
  points: string;
  /** The short label the instrument's readout prints. */
  label: string;
  /** One sentence on the challenge itself. */
  deck: string;
  /** What the solve turned on. */
  approach: string;
  /** The full writeup for this challenge, on Medium. */
  href: string;
  /** Figures for this challenge, in reading order. */
  images?: WritingImage[];
};

export type WritingEntry = {
  slug: string;
  title: string;
  /** The plate the section and the index show for this entry. */
  image: string;
  /**
   * The plate's own proportions. A screenshot keeps its shape so the plate can
   * be fitted rather than cropped; a portrait image would otherwise leave bars.
   */
  imageSize: { width: number; height: number };
  /** The article's own opening image, below its title. */
  cover: WritingImage;
  /** A short kind, printed beside the date. */
  kind: string;
  /** One sentence on what the writeup covers, in the site's voice. */
  deck: string;
  date: string;
  dateLabel: string;
  /** The event's own facts, as the writeup states them. */
  event: string;
  result: string;
  contribution: string;
  /** The full post, which carries the screenshots and listings. */
  href: string;
  challenges: WritingChallenge[];
};

const MEDIUM = "https://medium.com/@f12345ff67";

export const TCP1P: WritingEntry = {
  slug: "tcp1p-international-2024",
  title: "Writeup RE TCP1P International 2024",
  image: "/images/writing/tcp1p-cover.webp",
  imageSize: { width: 1324, height: 660 },
  cover: {
    src: "/images/writing/tcp1p-cover.webp",
    alt: "The TCP1P CTF 2024 scoreboard: Reverse category selected, five challenge cards listed with their points, and team ada SNI coyy at 10th overall and 4th in the Indonesian ranking.",
    caption:
      "The event's scoreboard at the close, with the Reverse category open. Five of these challenges are the ones written up here.",
  },
  kind: "Reverse engineering",
  deck: "Five reverse-engineering challenges from a two-day international CTF, in the order I solved them — including the one where the decompiler is the thing being attacked.",
  date: "2024-10-15",
  dateLabel: "Oct 15, 2024",
  event: "TCP1P International 2024",
  result: "10th overall · 4th Indonesian team",
  contribution: "5 reverse-engineering solves with team SNI",
  href: `${MEDIUM}/writeup-re-tcp1p-international-2024-b1d925a2dd4c`,
  challenges: [
    {
      slug: "serial",
      name: "Rev / Serial",
      points: "100 pts",
      label: "Serial",
      deck: "A .NET licence window that will not accept a serial you have not built yourself.",
      approach:
        "dnSpy plus a debugger break lands on the real entry point; the serial is reconstructed from the name hash the checker expects, and that serial is also the AES key that decrypts the flag.",
      href: `${MEDIUM}/rev-serial-43-100pts-b499ced121cf`,
    },
    {
      slug: "ida-ghidra-me",
      name: "Rev / IDA Ghidra Me",
      points: "321 pts",
      label: "Chunks",
      deck: "A binary whose functions return early, so both IDA and Ghidra show you a fraction of main.",
      approach:
        "The real control flow is split into chunks behind lea / push / retn separators; replacing them with NOPs restores the function, which then decompiles into an RC4-style keystream over a fixed ciphertext.",
      href: `${MEDIUM}/rev-ida-ghidra-me-8-321pts-e9bd952aec1e`,
    },
    {
      slug: "nyann",
      name: "Rev / Nyann",
      points: "431 pts",
      label: "NekoVM",
      deck: "A challenge that ships NekoVM bytecode instead of a native binary.",
      approach:
        "The .n file is bytecode for the neko virtual machine, so the work moves from disassembly to reading what the VM is asked to do with the flag.",
      href: `${MEDIUM}/rev-nyann-6-431pts-a0999364ace4`,
    },
    {
      slug: "average-flag-checker",
      name: "Rev / Average Flag Checker",
      points: "504 pts",
      label: "Assembly",
      deck: "A flag checker that resists the decompiler and gives up only when you read the assembly.",
      approach:
        "When the pseudocode will not produce a main function, the solve is to stop asking for it: follow the assembly by hand until the comparison the checker makes is visible.",
      href: `${MEDIUM}/rev-average-flag-checker-5-504-4b489b58bbda`,
    },
    {
      slug: "wannaflag",
      name: "Rev / WannaFlag",
      points: "593 pts",
      label: "SEH",
      deck: "Two documented encryption layers, and a third one that only runs when the program crashes.",
      approach:
        "The visible layers are padded AES-ECB and an XOR pass, but the real final layer lives in a Structured Exception Handler that mutates the buffer a byte at a time; reimplementing that handler as a decoder produces the flag.",
      href: `${MEDIUM}/rev-wannaflag-4-593pts-f925bfc32f72`,
    },
  ],
};

/** Every published writeup, newest first. */
export const WRITING: WritingEntry[] = [TCP1P];

/** The author's profile, for the index and the article footer. */
export const writingProfile = MEDIUM;

export const padIndex = (index: number) => String(index + 1).padStart(2, "0");
