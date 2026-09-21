export type LaunchEvent =
  | "pricing_opened"
  | "audit_started"
  | "audit_completed"
  | "audit_failed"
  | "report_downloaded"
  | "inquiry_prepared";

export function trackLaunchEvent(event: LaunchEvent, meta: Record<string, unknown> = {}) {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event, path: window.location.pathname, meta }),
    });
  } catch {
    // Telemetry must never block the product workflow.
  }
}
