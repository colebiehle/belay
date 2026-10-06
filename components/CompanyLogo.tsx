"use client";

import { useState } from "react";
import { logoUrl } from "@/lib/logo";

const ATS_PLATFORMS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "myworkdayjobs.com",
  "linkedin.com",
  "indeed.com",
  "smartrecruiters.com",
  "icims.com",
  "taleo.net",
  "jobvite.com",
  "bamboohr.com",
  // Multi-employer job sites. Their URL says where the listing was found, not who
  // is hiring, so a role from one would otherwise wear the site's logo.
  "wellfound.com",
  "ycombinator.com",
  "workatastartup.com",
  "simplify.jobs",
  "hiring.cafe",
  "welcometothejungle.com",
  "builtin.com",
  "joinhandshake.com",
  "getro.com",
];

const KNOWN_DOMAINS: Record<string, string> = {
  "figma": "figma.com",
  "anthropic": "anthropic.com",
  "apple": "apple.com",
  "openai": "openai.com",
  "google": "google.com",
  "runway": "runwayml.com",
  "notion": "notion.so",
  "adobe": "adobe.com",
  "microsoft": "microsoft.com",
  "meta": "meta.com",
  "character.ai": "character.ai",
  "perplexity": "perplexity.ai",
  "miro": "miro.com",
  "canva": "canva.com",
  "amazon web services": "aws.amazon.com",
  "aws": "aws.amazon.com",
  "amazon": "amazon.com",
  "discovery education": "discoveryeducation.com",
  "linkedin": "linkedin.com",
  "spotify": "spotify.com",
  "stripe": "stripe.com",
  "airbnb": "airbnb.com",
  "uber": "uber.com",
  "lyft": "lyft.com",
  "slack": "slack.com",
  "salesforce": "salesforce.com",
  "atlassian": "atlassian.com",
  "dropbox": "dropbox.com",
  "pinterest": "pinterest.com",
  "snap": "snap.com",
  "twitter": "twitter.com",
  "x corp": "x.com",
  "netflix": "netflix.com",
  "shopify": "shopify.com",
  "github": "github.com",
};

// The employer's own domain, found while scoring a role (from the posting page, or
// from the model when it knows the company). Small startups rarely own
// "<name>.com", so without it a Wellfound or YC role guessed someone else's logo.
export function domainFromEnrichment(raw: string | null | undefined): string | null {
  const d = readEnrichment(raw).companyDomain;
  return typeof d === "string" && d.includes(".") ? d : null;
}

// The logo image the source showed beside the posting (LinkedIn, Wellfound, YC).
export function logoFromEnrichment(raw: string | null | undefined): string | null {
  const l = readEnrichment(raw).companyLogo;
  return typeof l === "string" && l.startsWith("https://") ? l : null;
}

function readEnrichment(raw: string | null | undefined): { companyDomain?: unknown; companyLogo?: unknown } {
  if (!raw) return {};
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

export function getLogoDomain(company: string, jobUrl: string, known?: string | null): string {
  if (known) return known;
  const slug = company.toLowerCase();
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (slug.includes(key)) return domain;
  }
  try {
    const hostname = new URL(jobUrl).hostname.replace(/^www\./, "");
    if (!ATS_PLATFORMS.some((ats) => hostname.endsWith(ats))) return hostname;
  } catch { /* ignore */ }
  return `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
}

export function CompanyLogo({
  company,
  jobUrl = "",
  size = 36,
  domain: known = null,
  logo = null,
}: {
  company: string;
  jobUrl?: string;
  size?: number;
  domain?: string | null;
  logo?: string | null;
}) {
  // The source's own logo first, then the domain's favicon at two sizes, then a
  // letter tile.
  const sources = [logo, logoUrl(getLogoDomain(company, jobUrl, known)), logoUrl(getLogoDomain(company, jobUrl, known), 64)]
    .filter((s): s is string => !!s);
  const [attempt, setAttempt] = useState(0);
  const px = `${size}px`;

  if (attempt >= sources.length) {
    return (
      <div
        className={`${size <= 24 ? "rounded-control" : "rounded-card"} bg-lift flex items-center justify-center text-meta font-semibold text-fg-3 shrink-0`}
        style={{ width: px, height: px }}
      >
        {company[0]?.toUpperCase() ?? "?"}
      </div>
    );
  }

  const src = sources[attempt];
  const isSourceLogo = !!logo && attempt === 0;

  return (
    <img
      src={src}
      alt={company}
      // 4px radius at 24px and under, 6px from 32px up, so the corner reads the same
      // proportion at every size.
      className={`${size <= 24 ? "rounded-control" : "rounded-card"} object-contain bg-plate shrink-0 ${
        isSourceLogo ? "" : size <= 24 ? "p-0.5" : "p-1"
      }`}
      style={{ width: px, height: px }}
      onError={() => setAttempt((a) => a + 1)}
      // Google's favicon service answers an unknown domain with its generic 16px
      // globe instead of an error, which showed a globe, or a stranger's icon,
      // where a letter tile belonged. A real logo at sz=64 or more is never that small.
      onLoad={(e) => {
        if (!isSourceLogo && e.currentTarget.naturalWidth <= 16) setAttempt(sources.length);
      }}
    />
  );
}
