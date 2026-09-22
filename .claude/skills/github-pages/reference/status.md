# Reading deploy status

## `gh api repos/OWNER/REPO/pages/builds/latest`

```json
{
  "status": "built",
  "error": { "message": null },
  "commit": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  "duration": 3421,
  "created_at": "2026-09-09T22:41:08Z",
  "updated_at": "2026-09-09T22:42:11Z"
}
```

| `status` | Means |
|---|---|
| `built` | Finished successfully. This commit is on the live site. |
| `building` | In progress right now. |
| `queued` | Accepted, not started. |
| `errored` | Failed. `error.message` says why. |

`commit` is the full SHA that was built. Compare it to `git rev-parse HEAD`:

- equal + `built` → **published and up to date**
- different + no run in flight → GitHub never saw the newest commit; the push probably
  didn't land

A 404 from this endpoint means Pages is not enabled on the repo at all — enable it
(`commands.md` §F) rather than reporting a build failure.

`created_at` / `updated_at` are **UTC**. Convert before showing:

```bash
# macOS/BSD - parse as UTC into an epoch, then format that epoch in local time
e=$(date -jf '%Y-%m-%dT%H:%M:%SZ' -u '2026-09-09T22:42:11Z' '+%s')
date -r "$e" '+%B %-d, %Y at %-I:%M %p' | sed 's/AM$/am/;s/PM$/pm/'

# Linux/GNU
date -d '2026-09-09T22:42:11Z' '+%B %-d, %Y at %-I:%M %p' | sed 's/AM$/am/;s/PM$/pm/'
```

Both print `September 9, 2026 at 6:42 pm` for a viewer in US Eastern.

**The `-u` on the macOS form is required.** Without it, `date -jf` ignores the trailing `Z`,
reads the timestamp as if it were already local, and hands back UTC relabeled as local time
— off by hours, silently. Same trap for any BSD `date`.

The `sed` lowercases `AM`/`PM`, which `%p` always emits uppercase.

## `gh run list`

```bash
gh run list --limit 5 --json status,conclusion,headSha,workflowName,createdAt,url
```

```json
[
  {
    "status": "in_progress",
    "conclusion": "",
    "headSha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    "workflowName": "pages-build-deployment",
    "createdAt": "2026-09-09T22:41:05Z",
    "url": "https://github.com/USER/USER.github.io/actions/runs/1234567890"
  }
]
```

**Always filter by `headSha == git rev-parse HEAD`.** Without that, "a build is running" is
ambiguous about which change is publishing — it may be an older push still finishing.

In-flight `status` values: `queued`, `in_progress`, `waiting`, `pending`, `requested`.
Any of these → the site is building right now. Say so with the start time and offer
`gh run watch RUN_ID --compact`.

Failing `conclusion` values: `failure`, `timed_out`, `cancelled`, `startup_failure`.
Any of these → the publish failed. Name the workflow, run
`gh run view RUN_ID --log-failed`, translate the error, offer to fix it.

`conclusion: "success"` with `status: "completed"` → the build finished; cross-check
`pages/builds/latest` to confirm it's the live one.

The run id is the last path segment of `url`; `gh run list --json databaseId` gives it
directly.

## `gh api repos/OWNER/REPO/deployments`

An alternative view — useful when a repo uses a **custom** Actions workflow instead of
`pages-build-deployment`, since `pages/builds/latest` can lag behind for those.

```bash
gh api repos/OWNER/REPO/deployments --jq '.[0] | {sha,environment,created_at}'
gh api repos/OWNER/REPO/deployments/DEPLOYMENT_ID/statuses --jq '.[0].state'
```

`environment` is `github-pages`. `state` of `success` means live; `in_progress` /
`queued` means building; `failure` / `error` means it failed.

## The three ways "not updated" happens

Diagnose in this order and say **which one** it is — the fix is different for each.

| # | Test | Plain-language verdict | Fix |
|---|---|---|---|
| 1 | `git status --porcelain` non-empty | "Your changes aren't saved yet." | `git add -A && git commit` |
| 2 | `git rev-list --count @{u}..HEAD` > 0 | "Saved on your computer, but not sent to GitHub yet." | `git push` |
| 3 | Pushed; run in flight or failed | "GitHub is building it" / "the build failed" | wait, or read the log and fix |

If `@{u}` errors, there is no upstream tracking branch — the first push never happened.
Treat it as case 2 and use `git push -u origin main`.

## Answer templates

> **Yes — your site is live and up to date.** The live site includes your latest change,
> "Add about page," which finished publishing on September 9, 2026 at 3:42 pm.
> https://USERNAME.github.io

> **Not yet — GitHub is building your site right now.** It started on September 9, 2026 at
> 3:41 pm and usually takes about a minute. Want me to wait and tell you when it's done?

> **No — your newest change, "Fix typo in bio," isn't published yet.** It's saved on your
> computer but hasn't been sent to GitHub. Want me to publish it?

> **No — you have changes that aren't saved yet.** `about.html` has edits that aren't part of
> your website. Want me to save and publish them?

> **The publish failed.** GitHub tried to build "Add about page" at September 9, 2026 at
> 3:42 pm and the `pages-build-deployment` workflow errored out. Here's what broke: …

No commit hashes in any of these unless the user asks for one.
