import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Without a connection we cannot verify the sign-in, so keep the user in. */
function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (isOffline()) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/", label: "Today" },
  { to: "/german", label: "German" },
  { to: "/uni", label: "University" },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isOffline()) {
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isOffline()) {
        navigate({ to: "/auth" });
      } else {
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isOffline()) {
        navigate({ to: "/auth" });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-pulse rounded-full bg-rust" />
      </div>
    );
  }

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
