# Santana-Co Travel Log security

## Reporting a concern

Please report suspected security or privacy issues privately to **jfsantana0691@gmail.com**. Do not open a public GitHub issue containing personal information, addresses, passwords, access tokens, API keys, or instructions that could put users at risk.

Include a short description, the affected page or feature, what you observed, and safe steps to reproduce it. Santana-Co will acknowledge reports as soon as practical, assess their severity, contain active risks, correct confirmed issues, and notify affected users or authorities when required.

## Pilot safeguards

- Each user must authenticate and database row-level security limits access to that user's profile and trips.
- Administrator accounts use multi-factor authentication and unique passwords.
- Secrets are held in provider secret stores and are not committed to the public repositories.
- Routing requests require a valid signed-in user session and accept only bounded address inputs.
- Routing calculations are throttled per signed-in user to reduce automated abuse and unexpected provider use.
- Connections use HTTPS, and the browser app applies a restrictive content security policy.
- Users can export their information. Permanent account deletion requires recent password confirmation.
- GitHub runs automated code scanning and checks weekly for dependency and workflow updates.
- Access, dependencies, privacy wording, and provider configuration should be reviewed at least quarterly and whenever the service changes materially.

## Pilot data rules

Travel Log is intended for ordinary work-trip records. Users must not enter health information, financial account information, identity documents, passwords, authentication secrets, or highly confidential client information in trip notes.

Access to production data is limited to support, security, legal compliance, and essential operation. Account and trip records are retained while an account is active and deleted from the active database when the user completes self-service deletion. Provider backup and security-log copies may expire later under provider retention schedules.

## If an incident occurs

Santana-Co should preserve evidence without unnecessarily copying personal data, revoke exposed credentials, contain the affected component, determine what data and users were affected, restore safe operation, document decisions, and assess notification obligations. Credentials must never be sent by email or placed in an incident ticket.

Use the operational checklist in [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for triage, containment, assessment, recovery, and follow-up.
