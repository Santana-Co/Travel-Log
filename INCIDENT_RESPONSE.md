# Santana-Co Travel Log incident response

This pilot checklist applies to suspected loss, unauthorised access, disclosure, alteration, or unavailability of Travel Log data or services. The incident contact is **jfsantana0691@gmail.com**. Do not send passwords, API keys, access tokens, or detailed trip records by email.

## 1. Record and triage

- Record when the issue was detected, who reported it, affected services, and only the minimum personal information needed to investigate.
- Treat exposed credentials, cross-user data access, unauthorised account access, or public trip/address data as urgent.
- Preserve relevant GitHub, Supabase, and Cloudflare security logs without copying unnecessary user data.

## 2. Contain

- Revoke or rotate exposed credentials in the provider that issued them; never place replacements in GitHub or browser code.
- Disable or roll back only the affected deployment or feature where practical.
- End compromised sessions, restrict affected administrator access, and keep multi-factor authentication enabled.
- Do not delete evidence until the cause and notification obligations have been assessed.

## 3. Assess

- Identify the cause, time window, affected accounts and data types, whether information was actually accessed or disclosed, and the likely harm.
- Check Supabase row-level policies, authentication logs, Cloudflare Worker logs, GitHub audit/security results, and recent deployments.
- Seek qualified legal or privacy advice when an incident may cause serious harm. Assess the Australian Notifiable Data Breaches scheme and document the decision: <https://www.oaic.gov.au/privacy/notifiable-data-breaches>.

## 4. Recover and communicate

- Correct the cause, test the fix, review access, and restore service from a known-safe version.
- Notify affected users promptly when appropriate, using clear facts, protective steps, and a contact channel. Do not speculate or expose another user's information.
- Notify regulators or other parties when legally required.

## 5. Follow up

- Write a short incident timeline, impact statement, root cause, actions taken, and owner/due date for each remaining improvement.
- Review monitoring, rate limits, tests, provider configuration, retention, and this checklist.
- Confirm rotated credentials are removed from screenshots, notes, logs, and repositories where possible.
