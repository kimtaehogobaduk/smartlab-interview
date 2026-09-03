import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/Brand";

export function AppShell({
  children,
  eyebrow,
  title,
  description,
  backTo = "/",
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  backTo?: "/" | "/admin" | "/rooms" | "/rooms/$roomId";
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-5">
            <Link
              to={backTo}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Brand size={36} />
            <div className="hidden border-l border-border pl-5 md:block">
              <p className="label-mono">{eyebrow}</p>
              <h1 className="text-sm font-semibold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />{" "}
              Local workspace
            </span>
            <Link
              to="/admin"
              className="label-mono rounded-md border border-border px-3 py-2 hover:bg-secondary"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8">
        {description ? (
          <p className="mb-7 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
    </main>
  );
}
