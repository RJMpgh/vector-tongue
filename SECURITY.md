# Security Policy

Vector Tongue is an AI model-comparison and release-assurance system. Security claims should be evidence-backed and deployment-specific.

## Current security posture

- Provider API keys are server-side environment variables only.
- The browser UI does not request or store provider secrets.
- API responses do not intentionally expose provider keys.
- Express disables the `X-Powered-By` header.
- Basic content-type, referrer, and permissions headers are set by the application server.
- Request JSON is size-limited.
- Production deployments can restrict browser origins with `CORS_ORIGIN`.
- Synthetic demo data is explicitly separated from measured evidence.
- CI includes a product truth-boundary check to prevent simulated commerce claims from reappearing.

## Not yet claimed

This repository does not currently claim SOC 2, ISO 27001, HIPAA, FedRAMP, PCI DSS, or any other formal compliance certification.

Before a regulated or enterprise production deployment, buyers should perform their own security review and configure secrets, logging, retention, authentication, network controls, and access policy appropriate to their environment.

## Reporting a vulnerability

Please report security issues privately to **rjmarler8@gmail.com** with the subject `Vector Tongue security report`.

Do not include live API keys, credentials, or sensitive customer data in a public GitHub issue.
