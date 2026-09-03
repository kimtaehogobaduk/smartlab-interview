import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyAdminCode } from "@/lib/auth.functions";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("smartlab-admin") === "verified",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (authenticated) return <>{children}</>;
  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await verifyAdminCode({ data: { code } });
      if (!result.valid) {
        setError("관리자 인증 코드가 올바르지 않습니다.");
        return;
      }
      window.sessionStorage.setItem("smartlab-admin", "verified");
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 인증을 확인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="hero-ambient grid-bg flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-md border-primary/30 bg-card/90">
        <CardHeader>
          <Brand size={42} />
          <CardTitle className="mt-6 flex items-center gap-2">
            <LockKeyhole className="size-5 text-primary" /> 관리자 인증
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            관리자 인증 후 운영 콘솔에 접근할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="관리자 인증 코드"
            autoFocus
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={login} disabled={loading || !code}>
            {loading ? "확인 중..." : "관리자 포털 입장"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            인증 코드는 서버에서만 검증되며 브라우저에 저장되지 않습니다.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
