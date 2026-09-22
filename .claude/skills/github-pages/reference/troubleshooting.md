# Troubleshooting

Every entry: detect it, then **fix it** after a plain-language yes/no. Only hand the user
instructions when the action genuinely cannot be automated.

## Pages is not enabled

**Symptom:** `gh api repos/OWNER/REPO/pages` returns 404. The site 404s everywhere.

**Fix:**

```bash
gh api repos/OWNER/REPO/pages -X POST -f source[branch]=main -f source[path]=/
```

If that returns 409 (already enabled with different settings), use `PUT` with the same
fields. Confirm afterward with
`gh api repos/OWNER/REPO/pages --jq '{url:.html_url,status,source:.source}'` and give the
user the URL as a clickable link.

## The site 404s

Check in this order — stop at the first one that's wrong.

1. **Repo is private.** Free accounts need a public repo. Ask first (it exposes the whole
   history), then
   `gh repo edit OWNER/REPO --visibility public --accept-visibility-change-consequences`.
2. **Pages not enabled** — above.
3. **No `index.html` at the repository root.** `ls index.html`. A site with only
   `about.html` will 404 at `/`. Create one.
4. **Serving from the wrong branch or path.** `gh api repos/OWNER/REPO/pages --jq .source`
   must be `{"branch":"main","path":"/"}`. Fix with the `PUT` above.
5. **Brand-new site, DNS not propagated** — below.
6. **Link points at a directory.** `<a href="/about/">` 404s; this setup serves
   `/about.html`. Fix the link.

## Brand-new `{username}.github.io`, first deploy

The very first deploy of a brand-new user site can take up to ~10 minutes to resolve even
after the build reports success — DNS and CDN propagation, not a broken build.

**Say this, don't leave them guessing:** the build succeeded (name the change and the
time), the address just isn't answering yet, and it's normal only for the first deploy.
Offer to wait and re-check:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://USERNAME.github.io
```

`200` → live. `404` on a build that succeeded minutes ago → still propagating.

This excuse applies **only** to the first deploy of a new site. On any later update, a 404
is a real problem — work the list above.

## Build failed

**Symptom:** `gh run list` shows `conclusion` of `failure`, `timed_out`, `cancelled`, or
`startup_failure` for the commit, or `pages/builds/latest` has `status: "errored"`.

```bash
gh run view RUN_ID --log-failed
gh api repos/OWNER/REPO/pages/builds/latest --jq .error.message
```

Common causes on a no-build-step site:

| Log says | Cause | Fix |
|---|---|---|
| Liquid syntax error | Jekyll is choking on `{{ }}` or `{% %}` in the HTML | Add an empty `.nojekyll` file at the root, commit, push |
| File not found / symlink | A symlink or a file outside the repo | Replace with a real file |
| `_config.yml` error | A stray Jekyll config | Remove it, or fix the YAML |
| Payload too large | Repo over 1 GB, or a single file over 100 MB | Remove the large file |

Translate the error into plain language, then offer to fix it. Do not paste raw logs at the
user unless they ask.

## Push rejected — remote is ahead

**Symptom:** `! [rejected] main -> main (fetch first)` or `(non-fast-forward)`.

Someone (often the user, editing on github.com) changed the repo on GitHub. Bring those
changes down first:

```bash
git pull --rebase origin main
git push
```

If the rebase stops with a conflict, both sides edited the same lines. Show the user both
versions in plain language, ask which they want, then:

```bash
git add FILE
git rebase --continue
git push
```

Never resolve a content conflict by guessing, and never `push --force` for this user.

## Wrong default branch

**Symptom:** the branch is `master`, or something else, and Pages is configured for `main`
(or vice versa).

Normalize to `main`:

```bash
git branch -M main
git push -u origin main
gh api repos/OWNER/REPO -X PATCH -f default_branch=main
gh api repos/OWNER/REPO/pages -X PUT -f source[branch]=main -f source[path]=/
```

Delete the stale remote branch once the new one is confirmed working:
`git push origin --delete master`.

## Detached HEAD

**Symptom:** `git symbolic-ref -q HEAD` fails; git says "HEAD detached at …".

```bash
git checkout -B main
```

This puts the current work on `main`. If `main` already existed with different commits,
inspect `git log --oneline main..HEAD` and explain the difference before overwriting.

## No commits yet

**Symptom:** `git log` says "your current branch 'main' does not have any commits yet".

The repo exists but is empty. Create `index.html` if there isn't one, then commit. This is
the normal starting state — not an error to report.

## `gh` not authenticated

**Symptom:** any `gh` command fails with an auth error, or `gh api user` returns 401.

Cannot be automated — it is an interactive browser flow. Tell the user:

> Run `gh auth login` in your terminal. Pick **GitHub.com**, choose **HTTPS** when it asks
> how to authenticate git operations (not SSH — HTTPS avoids setting up SSH keys entirely),
> and finish signing in through your browser. Tell me when you're done and I'll continue.

Then retry the failed command.

## `gh: command not found`

Not installed. Point them at https://cli.github.com/ for the installer.

For an explicit check use `gh --version` — **not** `command -v gh` or `which gh`, which are
POSIX-shell-only and fail in `cmd.exe`/PowerShell on Windows.

## Repository already exists

**Symptom:** `gh repo create` fails with "Name already exists on this account".

Skip creation and wire up the remote:

```bash
git remote add origin https://github.com/USERNAME/USERNAME.github.io.git
git push -u origin main
```

If `origin` already exists pointing elsewhere:
`git remote set-url origin https://github.com/USERNAME/USERNAME.github.io.git`.

## Organization policy blocks it

**Symptom:** `gh repo edit --visibility public` or Pages enablement fails with a 403
mentioning organization policy.

Cannot be fixed from the CLI. Tell the user which setting an org owner needs to change
(public repositories, or GitHub Pages for the org) and offer to continue once it's done.

## Changes published but the browser shows the old page

Build succeeded, commit matches, `curl` returns the new content, but the browser doesn't.
That's the browser cache, not GitHub. Have them hard-reload — Cmd-Shift-R on macOS,
Ctrl-Shift-R on Windows/Linux. Confirm what the server is actually serving first:

```bash
curl -sS https://USERNAME.github.io | head -20
```
