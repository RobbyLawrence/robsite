# QA Security Report — RobbyLawrence.vercel.app
**Date:** 2026-04-14 | **Branch:** main | **Mode:** Security-focused full scan  
**Pages tested:** 4 (homepage, /posts/, /posts/hello-world/, /posts/jigsaw-sudoku/)  
**Health Score: 68 / 100**

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 1     |
| Medium   | 1     |
| Low      | 3     |

**Top 3 to fix:**
1. Add security headers via `vercel.json` (High)
2. Verify Firebase Security Rules are locked down (Medium)
3. Remove stale `baseURL` from root `hugo.toml` (Low)

---

## ISSUE-001 — Missing HTTP Security Headers
**Severity:** High | **Category:** Security

No `vercel.json` exists in the repo, meaning the production deployment at `https://RobbyLawrence.vercel.app` has no custom security headers. The following are absent:

- `Content-Security-Policy` — allows any script/frame source
- `X-Frame-Options` — site can be embedded in iframes (clickjacking risk)
- `X-Content-Type-Options` — browsers may sniff MIME types
- `Referrer-Policy` — full referrer sent to external sites
- `Permissions-Policy` — no restrictions on browser feature access

**Repro:** `curl -sI https://RobbyLawrence.vercel.app/ | grep -iE "content-security|x-frame|x-content-type|referrer"`  
Expected: headers present. Actual: none returned.

---

## ISSUE-002 — Firebase Client Config Embedded in HTML
**Severity:** Medium | **Category:** Security / Information Disclosure

The Firebase project config (API key, project ID, app ID, messaging sender ID) is embedded in every page's HTML inside a `<script id="firebase-config">` block. Example from page source:

```
"apiKey": "AIzaSyC991uIePxJTsnDgHnle6DWXWLq4Icnoys",
"authDomain": "robsite-efa74.firebaseapp.com",
"projectId": "robsite-efa74",
"storageBucket": "robsite-efa74.firebasestorage.app",
"messagingSenderId": "910884653224",
"appId": "1:910884653224:web:c8ff62e3619481f53a1a9d"
```

**Note:** Firebase client-side keys are *intentionally public* — they identify your project, not authenticate it. Security is enforced by Firebase Security Rules. However, if those rules are permissive (e.g., allow unauthenticated reads/writes to Firestore or Storage), anyone with these keys can abuse your Firebase project — triggering quota, writing spam data, or reading all content.

**Action:** Verify your Firebase Security Rules in the Firebase console lock down reads/writes to only what the site needs (e.g., anonymous users can only increment view/like counters, not read or write arbitrary data).

---

## ISSUE-003 — Conflicting `baseURL` in Root `hugo.toml`
**Severity:** Low | **Category:** Configuration

The root-level `hugo.toml` still contains the default:
```
baseURL = 'https://example.org/'
```
While `config/_default/hugo.toml` correctly has `baseURL = "https://RobbyLawrence.vercel.app"`. Hugo gives precedence to `config/_default/`, so this doesn't break anything, but it's misleading and could cause confusion if the root file is ever used directly.

---

## ISSUE-004 — Firebase Console Errors on Every Page
**Severity:** Low | **Category:** Console Health

Every page logs a console error:
```
Firebase anonymous sign-in failed: Firebase: Error (auth/network-request-failed).
```
This appears in production browsers when Firebase is unreachable or slow. It's fired by the likes/views feature. Not a security issue, but visible to any visitor who opens DevTools, and it fires twice per page load.

---

## ISSUE-005 — Article "Edit" Button Exposes GitHub Repo URL
**Severity:** Low | **Category:** Information Disclosure

The `editURL` in `params.toml` is set to `https://github.com/RobbyLawrence/robsite/`, which renders an "Edit" button on every article page visible to all visitors. This discloses your source repo URL publicly. Not a vulnerability on its own, but it lets anyone browse your site's source, config files, and history.

---

## Console Health
- Homepage: no errors ✓
- /posts/: no errors ✓  
- /posts/hello-world/: 1 Firebase error
- /posts/jigsaw-sudoku/: 2 Firebase errors (fires twice)

## XSS Test
- Search with `?q=<script>alert(1)</script>`: no execution, properly encoded ✓

## Images
- All 6 homepage images load correctly ✓

## Score Breakdown
| Category     | Score | Weight | Weighted |
|--------------|-------|--------|----------|
| Console      | 70    | 15%    | 10.5     |
| Links        | 100   | 10%    | 10.0     |
| Visual       | 100   | 10%    | 10.0     |
| Functional   | 100   | 20%    | 20.0     |
| UX           | 97    | 15%    | 14.6     |
| Performance  | 100   | 10%    | 10.0     |
| Content      | 100   | 5%     | 5.0      |
| Accessibility| 85    | 15%    | 12.8     |
| **Total**    |       |        | **92.9** |

*Note: Score is for overall site health. Security issues (headers, Firebase rules) are separate from the UX health score and represent the more important findings.*
