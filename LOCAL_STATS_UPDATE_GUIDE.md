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

2. **Install dependencies.** Open a terminal (Command Prompt or PowerShell), navigate to the `scripts` folder inside the repo, and run:
   ```
   npm install
   npx playwright install chromium
   ```

3. **Make sure git is configured** with your GitHub credentials so pushes work without prompting for a password. If you are unsure, ask the team.

---

## How to run it

1. Open **Command Prompt** or **PowerShell**.

2. Navigate to the `scripts` folder:
   ```
   cd path\to\SG_Cricket_Search_Repo\scripts
   ```
   (Replace `path\to` with wherever you cloned the repo, e.g. `C:\Users\YourName\SG_Cricket_Search_Repo\scripts`)

3. Run:
   ```
   npm run update:local-cricheroes
   ```

4. A **browser window will open automatically**. Do not close it — the script is using it to download the stats. You can watch it click through the pages.

5. Wait for the terminal to print `Push complete. Stats are live on GitHub.`

That's it. The website will update automatically after the push.

---

## What happens step by step

1. Browser opens and visits the SGIA SHL 3 leaderboard on CricHeroes.
2. Clicks the **Batting** tab → downloads the Excel file.
3. Clicks the **Bowling** tab → downloads the Excel file.
4. Repeats steps 1–3 for the BPL 2025 leaderboard.
5. Parses both Excel files and checks for changes.
6. If there are changes:
   - Saves a backup of the old stats file (see below).
   - Writes the new stats file.
7. Commits and pushes to GitHub.
8. Browser closes automatically.

**Important:** The stats file is only overwritten if BOTH the batting and bowling downloads succeed. If either download fails, the existing file is left untouched.

---

## Where backups are saved

Before every write, the old stats file is backed up to:

```
backups/cricheroes/sgia/sgiaStats-YYYY-MM-DD-HH-mm-ss.json
backups/cricheroes/bpl/bplStats-YYYY-MM-DD-HH-mm-ss.json
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
