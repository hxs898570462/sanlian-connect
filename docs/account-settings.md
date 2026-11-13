# Reader Account Settings

## Scope

My Profile (`#profile`) is a read-only view of nickname, gender, city/region, signature, account group, email and registration date. Empty optional fields are shown as not provided. The edit form is available only under Settings, and changing profile fields does not change account details.

The Settings landing page (`#settings`) lists only five category links. Each opens its own page (`#settings/profile`, `#settings/display`, `#settings/security`, `#settings/privacy` or `#settings/about`) and links back to Settings. Keep existing reader navigation and staff workflows. Show a store contact only after the store supplies an approved contact channel.

Light/dark mode and standard/large/extra-large type apply to the reader interface, persist in the current browser, and do not affect the staff dashboard. No synchronisation, notifications, public profiles, password recovery or email changes.

## API And Storage

| API | Contract |
| --- | --- |
| `GET /api/profile` | Authenticated; returns the caller's current profile, including `gender`, `region` and `signature`. The session/user summary and admin endpoints do not expose the new fields. |
| `PATCH /api/profile` | Authenticated partial update of `name` (1-60 characters), `gender` (empty, `female`, `male`, `other`), `region` (0-60) and `signature` (0-100). Empty optional strings clear the fields. Unknown fields are rejected. |
| `POST /api/auth/change-password` | Authenticated and rate-limited. Takes `current_password` and `new_password` (6–128 characters each). Wrong credentials return 401 and leave the account untouched. A successful transaction changes the password and revokes every session for the caller; the response clears the current cookie. |
| `GET /api/version` | Authenticated; returns the running application's package version. |

Schema migration 2 adds three columns with empty defaults to existing users. It runs in the existing startup transaction and advisory lock. It does not rewrite account IDs, logins or business records. Version remains release-managed by `package.json`; the feature branch does not create a release.

## Tasks And Verification

1. Add the additive migration and authenticated API changes. Verify default values on upgrade, private field isolation, clearing fields and rejecting invalid or forbidden edits.
2. Verify that My Profile displays the complete saved record without editable fields, and that the editor lives in its own Settings category. Save and return to the profile to verify the result. Check category routing, browser back, preference persistence, desktop and narrow-screen layout, keyboard access and staff style isolation.
3. Test rejected password changes, concurrent changes, old-password rejection, and revocation across two sessions and two server instances. Run the existing PostgreSQL suite before pushing the feature branch.

Do not run these checks against Render or Neon. The feature branch is not a deployment.
