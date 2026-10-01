import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  component: AppLayout,
});

const navItems = [
  { to: "/", label: "Today" },
  { to: "/german", label: "German" },
  { to: "/uni", label: "University" },
  { to: "/city", label: "City" },
];

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3 sm:px-8">
          <Link to="/" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">
            Ritual
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} label={item.label} />
            ))}
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      activeProps={{
        className: "bg-cream text-ink ring-1 ring-black/5",
      }}
      className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
    >
      {label}
    </Link>
  );
}
