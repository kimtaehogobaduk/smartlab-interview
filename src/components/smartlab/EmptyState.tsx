import { ClipboardCheck } from "lucide-react";

export function EmptyState({
  icon: Icon = ClipboardCheck,
  title,
  body,
}: {
  icon?: typeof ClipboardCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
