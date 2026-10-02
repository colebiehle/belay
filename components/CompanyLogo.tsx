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

export function getLogoDomain(company: string, jobUrl: string): string {
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
}: {
  company: string;
  jobUrl?: string;
  size?: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const domain = getLogoDomain(company, jobUrl);
  const px = `${size}px`;

  if (attempt >= 2) {
    return (
      <div
        className="rounded-lg bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-500 shrink-0"
        style={{ width: px, height: px }}
      >
        {company[0]?.toUpperCase() ?? "?"}
      </div>
    );
  }

  const src =
    attempt === 0
      ? logoUrl(domain)
      : logoUrl(domain, 64);

  return (
    <img
      src={src}
      alt={company}
      className="rounded-lg object-contain bg-white p-1 shrink-0"
      style={{ width: px, height: px }}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
