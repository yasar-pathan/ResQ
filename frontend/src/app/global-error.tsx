"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          background: "linear-gradient(160deg, #0f2a24 0%, #1a4a3c 45%, #0d1f1a 100%)",
          color: "#f4f7f5",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, fontSize: "0.8rem" }}>
            Critical error
          </p>
          <h1 style={{ fontSize: "2rem", margin: "0.5rem 0" }}>RescueGrid</h1>
          <p style={{ opacity: 0.85 }}>{error.message || "The application failed to load."}</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.25rem",
              border: "none",
              borderRadius: 4,
              background: "#e8f5e9",
              color: "#0f2a24",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
