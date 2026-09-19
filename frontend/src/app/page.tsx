import { getApiBaseUrl } from "@/lib/api/client";

export default function HomePage() {
  const apiBase = getApiBaseUrl();

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>RescueGrid</h1>
      <p style={{ marginTop: "1rem", color: "#475569" }}>
        Phase 0 — local stack via Docker Compose. API base:{" "}
        <code>{apiBase}</code>
      </p>
    </main>
  );
}
