# GiziSync Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Counter Monotonicity (`site_metrics/visitors`)**: Visitor and click counters (`totalVisits`, `sispermbgClicks`, `statusGiziClicks`, `sopSistakolClicks`, and backward-compatible `giziSeimbangClicks`) may only initialize to exact starting zeros/one (`totalVisits == 1`, clicks `== 0`) and may only increment by strictly `+1` per valid action (or initialize `giziSeimbangClicks` from absent to `1` on legacy documents) with exact server timestamp `request.time`. Arbitrary jumps, decrements, deletions, or creation of arbitrary metric document IDs are strictly forbidden.
2. **Review Integrity (`reviews/{reviewId}`)**:
   - Every created review must satisfy exact allowed keys (`hasAll` + `hasOnly`), string length bounds (`authorName` 2–60, `authorRole` 0–80, `comment` 3–600), integer star rating (`1..5`), allowed `appTarget` (`Umum`, `SISPERMBG`, `Status Gizi`, `SOP SISTAKOL BGN`, `Aplikasi Gizi Seimbang`), initial `status == 'published'`, and server timestamp `createdAt == request.time`.
   - `authorUid` must be `''` for unauthenticated guests or strictly equal to `request.auth.uid` for email-verified authenticated users (no impersonation).
   - No PII fields (`email`, `phone`, `address`) are permitted in `reviews`.
   - Only verified admins may update a review's moderation `status`, keeping `createdAt` and `authorUid` immutable. Only admins or the verified original author may delete a review.
3. **Media Slot Protection (`media_slots/{slotId}`)**:
   - Only the 5 known slot IDs (`hero_portrait`, `app_sispermbg`, `app_status_gizi`, `app_sop_sistakol`, `app_gizi_seimbang`) may be read or written, and `slotId` field must match the document path ID.
   - Public visitors may read published slots (`get` only; `list` denied), while creating, updating, or deleting published slots is restricted strictly to verified admins (`isAdmin()`).
   - Image payloads are bounded (`maxLength: 350000` chars) and must begin with `data:image/(jpeg|png|webp);base64,` to block HTML/SVG XSS data URIs.
4. **Admin Isolation (`admins/{uid}`)**:
   - Client SDK writes (`create`, `update`, `delete`) and `list` queries are unconditionally denied (`false`). Only a verified user may `get` their own document.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)

1. **Shadow Field Injection on Review Create**: Adding ghost field `"isVerified": true` to a review payload.
2. **Rating Out-of-Bounds Poisoning**: Creating a review with `"rating": 99` or `"rating": 0` or `"rating": "5"`.
3. **Author UID Impersonation**: Unauthenticated user or User A setting `"authorUid": "victim-uid-123"` on review create.
4. **Client Timestamp Forgery**: Creating a review with backdated client `createdAt` instead of `request.time`.
5. **Hidden Review Creation Bypass**: Creating a review directly with `"status": "hidden"` instead of `"published"`.
6. **Denial-of-Wallet Oversized Comment**: Submitting a review with `comment` length > 600 chars or `reviewId` length > 128 chars / invalid regex characters.
7. **Visitor Counter Inflation**: Updating `site_metrics/visitors` with `totalVisits: existing + 500` or decrementing `totalVisits`.
8. **Arbitrary Metric Document Poisoning**: Creating `/site_metrics/fake_metric` with arbitrary data.
9. **Unauthorized Media Overwrite**: Unauthenticated or non-admin user attempting to write `/media_slots/hero_portrait`.
10. **Email Spoofing Admin Bypass**: Authenticated user whose token has `email: "syukriyusuf00@gmail.com"` but `email_verified: false` attempting to update `/media_slots/app_sispermbg` or moderate a review.
11. **XSS SVG Data URI Injection**: Even an admin attempting to save `imageDataUrl: "data:image/svg+xml;base64,..."` into `/media_slots/app_sispermbg`.
12. **Privilege Escalation via Admins Collection**: Regular user attempting to create `/admins/{theirUid}` with `{ role: "admin" }`.
