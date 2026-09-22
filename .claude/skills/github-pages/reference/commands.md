# Command sequences

`USERNAME` = output of `gh api user --jq .login`. `REPO` = `USERNAME.github.io`.
Never ask the user to type their username — read it from the API.

## A. First-time setup, empty repository

```bash
gh api user --jq .login
```

Create `index.html` from `starter-index.html` in this folder (substitute the user's name if
you know it), then:

```bash
git init -b main
git add -A
git commit -m "Add site"
gh repo create USERNAME.github.io --public --source=. --remote=origin
git push -u origin main
gh api repos/USERNAME/USERNAME.github.io/pages -X POST -f source[branch]=main -f source[path]=/
```

`gh repo create --source=.` sets the `origin` remote for you, so no separate
`git remote add` is needed. If the directory is already a git repo, skip `git init`.

## B. First-time setup, existing `index.html`

Identical to A, minus creating the file. Commit message: `Add site`.

If the repo already has commits, skip `git init` and `git commit` may be a no-op — check
`git status --porcelain` first and only commit when there is something to commit.

## C. Repository already exists on GitHub, no local remote

```bash
git remote add origin https://github.com/USERNAME/USERNAME.github.io.git
git push -u origin main
```

If the push is rejected because the remote has commits the local repo doesn't:

```bash
git pull --rebase origin main
git push -u origin main
```

## D. Routine update

```bash
git status --porcelain
git add -A
git commit -m "Update bio text"
git push
```

Then run the status check (E) and report the verdict.

## E. Status check — one call

```bash
git status --porcelain; \
git log -1 --format='%H%n%s'; \
git rev-list --count @{u}..HEAD 2>/dev/null; \
gh api repos/OWNER/REPO/pages/builds/latest --jq '{status,commit,created_at,updated_at}'; \
gh run list --limit 5 --json status,conclusion,headSha,workflowName,createdAt,url
```

Scoped to the newest commit instead:

```bash
gh run list --commit $(git rev-parse HEAD) --json status,conclusion,headSha,workflowName,url
```

Wait for an in-flight build:

```bash
gh run watch RUN_ID --compact
```

Read a failed build's log:

```bash
gh run view RUN_ID --log-failed
```

## F. Enable or reconfigure Pages

Enable (first time):

```bash
gh api repos/OWNER/REPO/pages -X POST -f source[branch]=main -f source[path]=/
```

Already enabled — `POST` returns 409, so update instead:

```bash
gh api repos/OWNER/REPO/pages -X PUT -f source[branch]=main -f source[path]=/
```

Read the current config and site URL:

```bash
gh api repos/OWNER/REPO/pages --jq '{url:.html_url,status,source:.source}'
```

## G. Normalize the default branch to `main`

```bash
git branch -M main
git push -u origin main
gh api repos/OWNER/REPO -X PATCH -f default_branch=main
```

If HEAD is detached (`git symbolic-ref -q HEAD` fails):

```bash
git checkout -B main
```

## H. Make the repository public

Ask first — it exposes the full history.

```bash
gh repo edit OWNER/REPO --visibility public --accept-visibility-change-consequences
```

## I. Add a new page

Create `about.html`, then add a link in `index.html` — **by filename**, not a directory path:

```html
<a href="/about.html">About</a>
```

```bash
git add -A
git commit -m "Add about page"
git push
```

## J. Undo

| Situation | Command |
|---|---|
| Edits not saved yet | `git restore FILE` |
| Saved, not published — keep the edits | `git reset --soft HEAD~1` |
| Saved, not published — discard the edits too | `git reset --hard HEAD~1` |
| Already published | `git revert HEAD` then `git push` |

Never rewrite published history for this user.
