# RNX Trust-Case Evidence Vault — v3.12.0

## File policy

The trust-case evidence vault accepts PDF, JPEG, PNG and WebP files. Each file is limited to 4 MB and each case is limited to 20 files. The server inspects the file signature before uploading and rejects unsupported or mismatched content types. Original filenames are normalised before they are stored.

## Who can submit evidence

- **Customer:** uses the request's private tracking token and may add files while the case is open (`new`, `triaged`, `awaiting_customer`, `awaiting_supplier` or `under_review`). New uploads are blocked after `resolved` or `closed`.
- **Supplier:** must be signed into an active approved supplier account that owns the supplier introduction. RNX must have requested a response and the case must currently be `awaiting_supplier`.
- **RNX staff:** must have `trust:write`. Staff choose either customer-visible evidence or internal-only evidence. Bootstrap-owner uploads are attributed to the staff role even when no staff user ID is attached to the emergency owner session.

## Who can view evidence

- Customer-visible evidence is available to the customer through the matching private tracking link, to the assigned supplier through its private case response centre after RNX has requested a response, and to RNX staff with `trust:read`.
- Internal-only evidence is available only to RNX staff with `trust:read`.
- All objects live in the private `rnx-trust-case-evidence` bucket. No public object URLs are used. Download routes re-check identity, tracking token, case ownership and visibility before issuing a 5-minute signed URL.
- Raw Storage paths are not returned to browser clients.

## Operational behaviour

Migration `030_rnx_trust_case_evidence_vault.sql` creates the metadata table and a service-role-only function that atomically inserts file metadata, records an `evidence_uploaded` case event, and updates the case and linked request activity timestamps. The first successful upload creates or repairs the private Storage bucket through the Supabase Storage API.

Uploads do not replace investigation. RNX must distinguish material submitted by a customer or supplier from verified findings. The platform checks file signatures but does not scan for malware. Staff should not invite users to provide passwords, bank PINs, payment-card information or unnecessary identity-document numbers.

## Test scenarios

1. Customer A's tracking token can upload and download files only for cases on Customer A's request.
2. Customer A cannot access another request's case by changing case or attachment IDs.
3. Supplier A cannot access a case assigned to Supplier B.
4. Supplier evidence submission is rejected unless RNX has requested a response and the current status is `awaiting_supplier`.
5. Internal staff evidence is returned by the Operations API but never by customer or supplier APIs.
6. Staff upload is rejected without `trust:write`; download is rejected without `trust:read`.
7. A fake extension or spoofed MIME type cannot bypass signature detection.
8. A 21st file or file larger than 4 MB is rejected; the original file metadata and existing case records remain intact.
9. Signed links expire after five minutes.
