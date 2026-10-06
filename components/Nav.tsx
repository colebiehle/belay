"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Applications first: it is the daily surface and everything else supports it.
// Opportunities, Projects, Content and Knowledge were removed — the first three
// held zero rows, and the Dashboard's own best line was a link back to the
// queue. The target list and the browse sites live on Home.
// No `tone` any more: pink and blue only said which side of the app you were on,
// which the page title already says, so every active link gets the same rope
// underline and orange keeps the one meaning "you are here, or act here".
const links = [
  // No Insights tab. It is the deeper, occasional read, and Home carries the few
  // numbers from it that change a week's plan, with a link through for the rest.
  // A tab put it level with the pages used every day.
  { href: "/applications", label: "Roles" },
  // Network sits next to Applications because referrals are worked alongside
  // applying, not after it. Profile is reference, so it goes last.
  { href: "/networking", label: "People" },
  { href: "/profile", label: "Profile" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    // Solid canvas, no blur: a translucent bar let rows scroll visibly underneath
    // it, which is decoration with no job.
    <nav className="sticky top-0 z-10 border-b border-line-1 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-stretch gap-6 h-12">
        {/* Home is the wordmark, the same on every page; the opacity trick that dimmed
            it away from Home made the name look disabled. The 16px mark goes to its
            left once it is drawn. */}
        <Link href="/" className="wordmark text-fg-1 flex items-center mr-2">
          Belay
        </Link>
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center text-button transition-colors duration-90 ease-enter ${
                active ? "text-fg-1" : "text-fg-3 hover:text-fg-1"
              }`}
            >
              {link.label}
              {/* The underline sits on the nav's own bottom edge, over its hairline. */}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-rope" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
