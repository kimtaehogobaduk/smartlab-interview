import { cn } from "@/lib/utils";

export function Brand({
  size = 40,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/smartlab-logo.png"
        alt="SmartLab 로고"
        width={size}
        height={size}
        className="rounded-sm bg-foreground p-1"
        style={{ width: size, height: size }}
      />
      {withText ? (
        <div className="leading-tight">
          <div className="font-mono text-sm font-bold tracking-[0.22em]">SMARTLAB</div>
          <div className="label-mono">Interview Platform</div>
        </div>
      ) : null}
    </div>
  );
}