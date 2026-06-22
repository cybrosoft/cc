// app/login/page.tsx
// Wraps LoginClient in Suspense — required because LoginClient uses
// useSearchParams(), which Next.js needs wrapped in Suspense for static
// prerendering to succeed during `next build`.

import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
