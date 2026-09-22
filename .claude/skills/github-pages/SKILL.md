---
name: github-pages
description: Publish, update, and troubleshoot a personal website on GitHub Pages, and handle all the git and GitHub work behind it. Use for websites and web pages of any kind - creating a page, adding an about page, editing HTML, putting a site online, making it live, taking it down. Use for publishing and deploying - "publish my site", "deploy", "put it online", "make it live", "update my website", "push my changes live", "ship it". Use for saving work - "save my changes", "save this", commit, staging, git add, git commit. Use for anything git or GitHub - repo, repository, remote, origin, branch, main, push, pull, fetch, clone, merge, revert, undo, git init, gh CLI, GitHub authentication, gh auth login, making a repo public or private. Use for deploy and build status - "is my site live?", "has my page published?", "did it work?", "is my website updated?", "why isn't my site showing the change?", 404 on the site, build failed, GitHub Actions run, pages-build-deployment. Use whenever someone who does not know git needs their website online or wants to know whether it already is.
---

# GitHub Pages: publish and maintain a personal website

You are running this skill for someone who very likely does not know what a commit,
a branch, a remote, or a push is. Your job is to do the git and GitHub work for them
and report back in plain English.

## The setup this skill assumes

- Repository name: `{username}.github.io`, site URL `https://{username}.github.io`
- Served from the **root of the `main` branch**. No `/docs` folder, no build step, no Jekyll.
- `/` serves `index.html`. Every other page is linked **by filename**: `<a href="/about.html">`,
  never `/about/`.
- The `gh` CLI is installed and authenticated.

## Four rules that govern everything below

**1. Act, don't instruct.** When you hit a blocker you can fix, ask a plain yes/no question
and then fix it. Do not hand the user a list of terminal steps. The only things you cannot
do for them are the interactive `gh auth login` browser flow, installing `gh`, and an org
admin policy change.

**2. Spend commands sparingly.** Every shell command costs the user a round-trip of waiting.
Assume the happy path — `gh` is installed and authenticated, the remote exists, the branch is
`main` — and handle failures when they actually happen. Do not run prechecks that almost
always pass (`gh auth status`, `gh --version`, `git remote -v` "just to be sure"). Batch
related commands into one call with `&&` or `;` when you do need several.

**3. Plain language out, real commands underneath.** Say "saved" and "published", not
"committed" and "pushed" — unless the user used the jargon first, in which case match them.
Always name the command you actually ran, on its own line, so the user can learn it if they
want. Example:

> Saved your changes and published them. (`git add -A`, `git commit -m "Add about page"`, `git push`)

**4. Keep internal identifiers out of user-facing text.** Commit hashes, raw UTC timestamps,
and commit trailers are how you reason — not what you show. Name a change by its commit
**subject line**. Show times as `September 9, 2026 at 3:42 pm` in the user's local timezone.
Show a hash only if the user asks for one.

## What the user says, and what you do

| The user says | You do |
|---|---|
| "publish my site" / "put it online" | add → commit → push → confirm the Pages build → give them the URL |
| "save my changes" | `git add -A` + `git commit` |
| "update my website" | commit + push + report deploy status |
| "is my site live?" / "did it work?" | the publishing-status check below |
| "undo that" / "go back" | explain the options in plain language, then revert safely |
| "add an about page" | create `about.html`, link it from `index.html`, commit, push |
| "why is my site 404ing?" | check Pages is enabled, repo is public, `index.html` is at the root |

## Never lose uncommitted work

When the request is about **publishing, deploying, or the state of the live site**, run
`git status --porcelain` first. An uncommitted file is the single most common reason the
answer is "not updated", and any status verdict is wrong without it.

Do **not** run `git status` as a reflex before unrelated work — editing a file, answering an
HTML question, explaining what a link does.

If there are new or modified files, either commit them (when the user asked to publish —
that is consent) or ask, in plain language:

> You have 2 new files that aren't part of your website yet — `about.html` and `style.css`.
> Want me to add them?

Never silently skip untracked files that are obviously part of the site: `.html`, `.css`,
`.js`, images, fonts.

## Commit messages

Short imperative subject line, nothing else. `Add about page`. `Update bio text`.
`Fix broken link`. No body, no "as requested by the user", no multi-paragraph explanation.

Write the message yourself from what actually changed. Only ask the user when the change is
genuinely ambiguous. The `Co-Authored-By:` trailer is fine to include, but never show it when
you display a commit message back — subject line only.

## First-time setup

The user has either an empty repo or a single `index.html`. If the repo is empty, create a
minimal starter `index.html` first so there is something to serve — see
[reference/starter-index.html](reference/starter-index.html).

Get their login and set everything up. This is the whole first-time flow:

```bash
gh api user --jq .login                      # -> USERNAME
git init -b main                             # skip if already a repo on main
git add -A
git commit -m "Add site"
gh repo create USERNAME.github.io --public --source=. --remote=origin
git push -u origin main
gh api repos/USERNAME/USERNAME.github.io/pages -X POST \
  -f source[branch]=main -f source[path]=/
```

Then tell them the site is building and will be at `https://USERNAME.github.io`, and that a
brand-new site takes a few minutes the very first time. Offer to watch the build and confirm
when it's live.

If `gh repo create` fails because the repo already exists, skip it and go straight to
`git remote add origin https://github.com/USERNAME/USERNAME.github.io.git` (or reuse the
existing remote) and push.

If the `pages -X POST` call returns 409 (already enabled), switch to `PUT` with the same
fields.

Full command sequences for every setup path — empty repo, existing `index.html`, repo already
on GitHub — are in [reference/commands.md](reference/commands.md).

## Routine update

```bash
git status --porcelain
git add -A
git commit -m "Update bio text"
git push
```

Then report the deploy status (next section). Do not stop at "pushed" — the user asked to
update their website, and the website is not updated until the build finishes.

## Answering "has my page published?"

This is the question the skill exists for. **Always give a definitive yes or no.** Never
answer with "it may take a few minutes, check back later" and nothing else — that is the one
answer the user could have given themselves.

Gather the state in a single call:

```bash
git status --porcelain; git log -1 --format='%H%n%s'; git rev-list --count @{u}..HEAD 2>/dev/null; \
gh api repos/OWNER/REPO/pages/builds/latest --jq '{status,commit,created_at,updated_at}'; \
gh run list --limit 5 --json status,conclusion,headSha,workflowName,createdAt,url
```

Then decide, in this order:

1. **Uncommitted changes exist** (`git status --porcelain` is non-empty) → the live site does
   not have them, and neither does anything else. Say so, and offer to save and publish them.
2. **Committed but not pushed** (`git rev-list --count @{u}..HEAD` > 0) → saved on their
   computer, never sent to GitHub. Offer to publish.
3. **A run is in flight** — a `gh run list` entry whose `headSha` matches `git rev-parse HEAD`
   and whose `status` is `queued`, `in_progress`, `waiting`, `pending`, or `requested` → the
   site is building **right now**. Say so with the start time, and offer to wait:
   `gh run watch RUN_ID --compact`.
4. **The run for this commit failed** — `conclusion` is `failure`, `timed_out`, `cancelled`,
   or `startup_failure` → the publish failed. Name the workflow, read the log with
   `gh run view RUN_ID --log-failed`, explain the cause in plain language, and offer to fix it.
5. **The latest build's `commit` equals `git rev-parse HEAD`** and `status` is `built` →
   published and up to date. Yes.
6. **The latest build succeeded but is an older commit** and no run is in flight → GitHub
   never picked up the newest change. Usually the push didn't land; re-check the remote.

Always match the workflow run to the commit via `headSha`, so "a build is running" is never
ambiguous about *which* change is publishing.

Pages deploys through an Actions workflow — `pages-build-deployment` by default, or a custom
workflow if the repo has one — so a fresh push almost always means a run is mid-flight.

### Every status answer contains three things

1. **The verdict** — published and up to date / still building / build failed / changes not
   published yet.
2. **Which change**, named by its commit subject line (`git log -1 --format=%s`).
3. **When**, as `September 9, 2026 at 3:42 pm` in the user's local timezone. The GitHub API
   returns UTC — convert it. See [reference/status.md](reference/status.md) for the exact
   command; on macOS a bare `date -jf` ignores the trailing `Z` and will print UTC back at
   you, which is the wrong time.

Good answers look like:

> **Yes — your site is live and up to date.** The live site includes your latest change,
> "Add about page," which finished publishing on September 9, 2026 at 3:42 pm.
> https://jmathai.github.io

> **Not yet — GitHub is building your site right now.** It started on September 9, 2026 at
> 3:41 pm and usually takes about a minute. Want me to wait and tell you when it's done?

> **No — your newest change, "Fix typo in bio," isn't published yet.** It's saved on your
> computer but hasn't been sent to GitHub. Want me to publish it?

> **The publish failed.** GitHub tried to build "Add about page" at September 9, 2026 at
> 3:42 pm and the `pages-build-deployment` workflow errored out. I'll read the error and
> tell you what broke.

More detail on API fields and response shapes: [reference/status.md](reference/status.md).

## When something is wrong

**`gh` not authenticated** (a command fails with an auth error) — this one you genuinely
cannot do for them; it's an interactive browser flow. Tell them:

> I need you to sign in to GitHub first. Run `gh auth login` in your terminal, then:
> pick **GitHub.com**, choose **HTTPS** when it asks how to authenticate git (not SSH —
> HTTPS avoids setting up SSH keys entirely), and finish signing in through your browser.
> Tell me when you're done and I'll pick right back up.

**`gh: command not found`** — they need to install it: https://cli.github.com/
If you ever need to check explicitly, use `gh --version`, not `command -v gh` or `which gh`
— those are POSIX-shell-only and fail in `cmd.exe`/PowerShell on Windows.

**The repo is private** — Pages needs a public repo on free accounts. Ask first, always,
because going public exposes the entire history:

> Your site can't go live while the repository is private. Want me to make it public?
> Everything in it, including past versions of your files, becomes visible to anyone.

On yes:
`gh repo edit OWNER/REPO --visibility public --accept-visibility-change-consequences`

Everything else — 404s, rejected pushes, a wrong default branch, DNS propagation on a
brand-new site — is in [reference/troubleshooting.md](reference/troubleshooting.md).

## Undoing things

When the user says "undo that" or "go back", explain the options in plain language before
touching anything, because the right one depends on whether the change is published:

- **Not saved yet** → throw away the edits: `git checkout -- FILE` (or `git restore FILE`).
- **Saved but not published** → undo the save, keep the edits:
  `git reset --soft HEAD~1`.
- **Already published** → make a new change that reverses it: `git revert HEAD`, then push.
  Never rewrite published history; it breaks in ways this user cannot debug.

Say which one you're recommending and why, then do it.
