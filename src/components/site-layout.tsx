import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { BOOKING, EMAIL, EMAIL_LABEL } from "@/lib/site";

const NAV = [
  { to: "/platform", label: "The shop" },
  { to: "/cleaning", label: "Cleaning" },
  { to: "/shipping", label: "Shipping" },
  { to: "/about", label: "About" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const toggle = document.querySelector("[data-nav-toggle]");
    const menu = document.querySelector("[data-nav-menu]");
    if (!toggle || !menu) return;

    const onToggle = () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    const close = () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", onToggle);
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    return () => {
      toggle.removeEventListener("click", onToggle);
      menu.querySelectorAll("a").forEach((link) => link.removeEventListener("click", close));
    };
  }, [pathname]);

  const current = (to: string) =>
    pathname === to ||
    (to === "/cleaning" && pathname === "/crewflag") ||
    (to === "/shipping" && pathname === "/invoiceflag");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-wrap">
          <Link to="/" className="brand">
            Framework<span>.</span>
          </Link>
          <button
            className="nav-toggle"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded="false"
            data-nav-toggle
          >
            <span />
            <span />
            <span />
          </button>
          <nav className="nav-links" data-nav-menu>
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={current(item.to) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <a href={BOOKING} className="button button-primary">
              Book a walkthrough
            </a>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="brand">
            Framework<span>.</span>
          </Link>
          <div className="footer-copy">
            <div>Framework Systems · Tuscumbia, Alabama</div>
            <div>Veteran-Owned · Faith-Driven</div>
            <div>© 2026 Framework Systems LLC. All rights reserved.</div>
          </div>
          <div className="footer-nav">
            <Link to="/platform">The shop</Link>
            <Link to="/cleaning">Cleaning</Link>
            <Link to="/shipping">Shipping</Link>
            <Link to="/about">About</Link>
            <a href={EMAIL}>{EMAIL_LABEL}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
