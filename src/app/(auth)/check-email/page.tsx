import { Suspense } from "react";
import { AuthShell } from "../auth-shell";
import { CheckEmailInner } from "./inner";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return (
    <AuthShell label="Check your email">
        <Suspense fallback={null}>
          <CheckEmailInner />
        </Suspense>
    </AuthShell>
  );
}
