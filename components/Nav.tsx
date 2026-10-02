"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Applications first: it is the daily surface and everything else supports it.
// Opportunities, Projects, Content and Knowledge were removed — the first three
// held zero rows, and the Dashboard's own best line was a link back to the
// queue. The target list and the browse sites live on the Dashboard.
// `tone` carries the same rule as the rest of the app: pink is the application side,
// blue is the networking side. The active tab used to be pink on every link, so the
// one page that is entirely blue announced itself in the other side's colour.
const links = [
  { href: "/", label: "Home", tone: "accent-pink" },
  { href: "/applications", label: "Applications", tone: "accent-pink" },
  // Network sits next to Applications because referrals are worked alongside
  // applying, not after it. Profile is reference, so it goes last.
  { href: "/networking", label: "Network", tone: "accent-blue" },
  { href: "/profile", label: "Profile", tone: "neutral" },
];

export default function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-8 h-14">
        <Link
          href="/"
          className={`font-bold tracking-tight mr-2 text-sm uppercase transition-opacity duration-150 text-zinc-100 ${
            isHome ? "" : "opacity-60 hover:opacity-100"
          }`}
          style={{ letterSpacing: "0.12em" }}
        >
          Belay
        </Link>
        {links.slice(1).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium pb-0.5 transition-all duration-150 ${
              pathname === link.href || pathname.startsWith(link.href + "/")
                ? link.tone === "accent-blue"
                  ? "text-accent-blue border-b-2 border-accent-blue"
                  : link.tone === "neutral"
                    ? "text-zinc-100 border-b-2 border-zinc-100"
                    : "text-accent-pink border-b-2 border-accent-pink"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
