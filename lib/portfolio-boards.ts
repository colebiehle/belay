/**
 * The VC portfolio boards the scan reads (app/api/ingest/getro), in one place so
 * Home can list exactly what is read. They are not job sites in the Sites sense:
 * no page read, no test scan, nothing to edit; each is a platform API read daily.
 */

// The four largest design+US Getro networks. A live count showed these cover most
// of the Getro union; adding more mostly returns duplicates.
export const GETRO_NETWORKS: { id: string; name: string; url: string; domain: string }[] = [
  { id: "8672", name: "Accel", url: "https://jobs.accel.com/jobs", domain: "accel.com" },
  { id: "222", name: "General Catalyst", url: "https://jobs.generalcatalyst.com/jobs", domain: "generalcatalyst.com" },
  { id: "2105", name: "Thrive", url: "https://jobs.thrivecap.com/jobs", domain: "thrivecap.com" },
  { id: "257", name: "Khosla", url: "https://jobs.khoslaventures.com/jobs", domain: "khoslaventures.com" },
];

// Consider boards, with the US design roles each listed on 2026-10-29. a16z,
// Greylock, Benchmark, Index and Founders Fund run their own sites and are not
// here.
export const CONSIDER_BOARDS: { host: string; board: string; name: string; domain: string }[] = [
  { host: "jobs.sequoiacap.com", board: "sequoia-capital", name: "Sequoia", domain: "sequoiacap.com" }, // 98
  { host: "jobs.lsvp.com", board: "lightspeed", name: "Lightspeed", domain: "lsvp.com" }, // 133
  { host: "jobs.gv.com", board: "gv", name: "GV", domain: "gv.com" }, // 81
  { host: "jobs.bvp.com", board: "bessemer-ventures", name: "Bessemer", domain: "bvp.com" }, // 65
  { host: "jobs.kleinerperkins.com", board: "kleiner-perkins", name: "Kleiner Perkins", domain: "kleinerperkins.com" }, // 59
  { host: "jobs.felicis.com", board: "felicis", name: "Felicis", domain: "felicis.com" }, // 32
  { host: "jobs.firstround.com", board: "first-round-capital", name: "First Round", domain: "firstround.com" }, // 27
];

/** Every board, as Home lists them: name, the board to open, and a logo domain. */
export const PORTFOLIO_BOARDS = [
  ...GETRO_NETWORKS.map((n) => ({ name: n.name, url: n.url, domain: n.domain })),
  ...CONSIDER_BOARDS.map((b) => ({ name: b.name, url: `https://${b.host}/jobs`, domain: b.domain })),
];
