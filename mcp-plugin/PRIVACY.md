# VT Drift Auditor privacy notice — experimental local preview

Effective October 16, 2026. Publisher: RJ Marler. Contact: rjmarler8@gmail.com.

The local MCP server receives the reported intent, service, action and payload
submitted by the host. It processes those inputs in memory to check schemas and,
when configured, compute embeddings with a local model. This implementation has
no publisher-operated collection endpoint, telemetry, analytics, database or
outbound target-service execution. It does not intentionally persist raw inputs.
Model provisioning and package installation may contact their distribution services;
the audit runtime is configured to load models from local files only.

ChatGPT, Codex, the machine owner and any configured infrastructure may retain
conversation or process data under their own policies. This notice does not
promise deletion from the host, operating system, memory dumps or backups.
Do not submit credentials or sensitive personal/customer data to this preview.

Support emails are processed by the publisher's email provider and retained as
needed to respond. Request deletion by email; applicable obligations or records
already held by other providers may limit what the publisher can delete.

This notice describes the current local implementation. A hosted service would
require a revised notice covering hosting, access, retention and subprocessors.
