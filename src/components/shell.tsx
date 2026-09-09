import { Link, useRouterState } from "@tanstack/react-router";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Tools" },
  { to: "/qc", label: "Photo QC" },
  { to: "/drift", label: "Drift" },
  { to: "/access", label: "Access" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="font-display text-xl tracking-tight text-paper">
            {brand.product}
            <span className="text-sienna">.</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium",
                  pathname === item.to
                    ? "bg-paper text-ink"
                    : "text-paper/80 hover:bg-ink-2 hover:text-paper",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-rule px-4 py-8 text-sm text-body">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:justify-between">
          <p>
            {brand.product} is a {brand.company} product.
          </p>
          <p>Use one tool or all three. Nothing to connect.</p>
        </div>
      </footer>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  type = "button",
  tone = "primary",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "ghost" | "ink";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition disabled:opacity-50",
        tone === "primary" && "bg-sienna text-paper hover:bg-sienna-dark",
        tone === "ghost" && "border border-rule bg-paper text-ink hover:border-sienna",
        tone === "ink" && "bg-ink text-paper hover:bg-ink-2",
        className,
      )}
    >
      {children}
    </button>
  );
}
