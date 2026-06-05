# Local Stats Update Guide

How to update the cricket stats on the website from your Windows laptop.

---

## What this does

Running the update command opens a browser window, visits the CricHeroes leaderboard for SGIA SHL 3 and BPL 2025, downloads the latest batting and bowling stats, and saves them to the website's data files. It then automatically commits and pushes the changes to GitHub so the website reflects the new stats within minutes.

---

## When to run it

Run this after any SGIA or BPL match day when you want the website stats to be up to date.

---

## Before you run it (one-time setup)

You only need to do this once on your laptop.

1. **Install Node.js** (version 18 or newer) from https://nodejs.org — choose the LTS version.

2. **Make sure git is configured** with your GitHub credentials so pushes work without prompting for a password. If you are unsure, ask the team.

---

## How to run it

1. Open **Command Prompt** or **PowerShell**.

2. Navigate to the repo root folder:
   ```
   cd C:\Users\aksha\Documents\Cricket_Search_SG_Project
   ```

3. Pull the latest changes:
   ```
   git pull origin main
   ```

4. Run:
   ```
   npm run update:local-cricheroes
   ```

   The first time you run this, it will automatically install the required packages and download the Chromium browser (about 130 MB). This only happens once — subsequent runs skip this step.

5. A **browser window will open automatically**. Do not close it — the script is using it to download the stats. You can watch it click through the pages.

6. Wait for the terminal to print `Push complete. Stats are live on GitHub.`

That's it. The website will update automatically after the push.

---

## What happens step by step

1. Packages are installed automatically if not already present.
2. Browser opens and visits the SGIA SHL 3 leaderboard on CricHeroes.
3. Clicks the **Batting** tab → downloads the Excel file.
4. Clicks the **Bowling** tab → downloads the Excel file.
5. Repeats steps 2–4 for the BPL 2025 leaderboard.
6. Parses both Excel files and checks for changes.
7. If there are changes:
   - Saves a backup of the old stats file (see below).
   - Writes the new stats file.
8. Commits and pushes to GitHub.
9. Browser closes automatically.

**Important:** The stats file is only overwritten if BOTH the batting and bowling downloads succeed. If either download fails, the existing file is left untouched.

---

## Where backups are saved

Before every write, the old stats file is backed up to:

```
backups\cricheroes\sgia\sgiaStats-YYYY-MM-DD-HH-mm-ss.json
backups\cricheroes\bpl\bplStats-YYYY-MM-DD-HH-mm-ss.json
```

These backups are stored locally only and are not pushed to GitHub.

---

## If GitHub push fails

The terminal will print the exact `git add` and `git commit` commands to run manually. Copy and paste them into the terminal, then run `git push origin main`.

Common reasons for push failure:
- **Your local branch is behind main** — run `git pull origin main` first, then re-run the push commands.
- **Not logged in to GitHub** — check that your git credentials are set up (`git config --list | findstr user`).

---

## If CricHeroes blocks the browser

The script takes a screenshot when something goes wrong. Check:
```
scripts\tmp\cricheroes\sgia\error.png
scripts\tmp\cricheroes\bpl\error.png
```

If the screenshots show a CAPTCHA or login page, CricHeroes may be blocking automated access. Try running the script again after a few minutes, or log in to CricHeroes manually in your regular browser first and then re-run.

---

## Confirm the update is live on GitHub

After a successful push, go to the repository on GitHub and look for a new commit with the message **"chore: update CricHeroes stats from local download"**. The website (hosted on Render) will redeploy automatically within a few minutes.
