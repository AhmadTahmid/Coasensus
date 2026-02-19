# GitHub Setup (Beginner)

## Current status in this environment
1. `git` is available.
2. `gh` CLI is not installed yet.

## Option A: GitHub Desktop (easiest)
1. Install GitHub Desktop.
2. Sign in to your GitHub account.
3. Add this folder as a local repository.
4. Publish repository to GitHub.

## Option B: Git CLI only
1. Create an empty GitHub repo in browser, for example `coasensus`.
2. In this folder run:
   - `git init`
   - `git add -A`
   - `git commit -m "chore: initialize coasensus scaffold and docs"`
   - `git branch -M main`
   - `git remote add origin https://github.com/<YOUR_USERNAME>/coasensus.git`
   - `git push -u origin main`

## Option C: GitHub CLI
1. Install GitHub CLI from https://cli.github.com/
2. Authenticate:
   - `gh auth login`
3. Create repo and push:
   - `git init`
   - `git add -A`
   - `git commit -m "chore: initialize coasensus scaffold and docs"`
   - `gh repo create coasensus --private --source . --remote origin --push`

