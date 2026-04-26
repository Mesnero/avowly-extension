# Contributing

External contributions welcome. By submitting a PR, you agree to license your contribution under the project's AGPL-3.0 license.

## Read before you write code

1. `../ai-guides/00-vision.md` — what we're building
2. `../ai-guides/01-principles.md` — non-negotiable rules
3. `../ai-guides/06-extension-design.md` — extension architecture
4. `PERMISSIONS.md` and `CAPTURE.md` — the trust contract with users

## Branching & commits

- Trunk-based. Short-lived feature branches off `main`.
- Conventional Commits, enforced by commitlint.

## PR checklist

- [ ] Tests for new behavior
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] If a permission was added, it's documented in `PERMISSIONS.md` *and* in the manifest *and* in the PR body
- [ ] If capture behavior changed, `CAPTURE.md` is updated *in the same PR*
- [ ] No `TODO` / `FIXME` left without a tracked issue link

## What to *not* add without an ADR

- New runtime dependencies
- New manifest permissions
- New host_permissions entries beyond a documented platform adapter
- Any code that reads model responses, page text outside the input area, or anything else outside the documented capture surface
