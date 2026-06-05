# Cricket Stats Generator

A local browser app for generating cricket stats JSON files from manually downloaded CSV/Excel files.

## Quick Start

Open two terminals from the `stats-generator/` directory:

**Terminal 1 — Backend:**
```bash
cd stats-generator/backend
npm install
npm start
# Runs on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd stats-generator/frontend
npm install
npm run dev
# Opens on http://localhost:5173
```

Then open http://localhost:5173 in your browser.

## Workflow

1. Select competition (SG IA / BPL / YPL / SCA)
2. Add one or more tournaments — fill in year, ID, name, status
3. Upload batting and bowling CSV/Excel files for each tournament
4. Click **Generate JSON** — the app validates and converts the files
5. Download the generated JSON or preview it
6. Optionally upload the existing JSON from the repo to compare
7. Click **Save Backup & Replace JSON** to write the file to the repo with a timestamped backup
8. Click **Push to GitHub** to run `git pull → add → commit → push`

## Expected CSV Column Names

### Batting
| CSV Column | JSON Field |
|------------|-----------|
| name | player |
| team_name | team |
| batting_hand | hand |
| total_match | mat |
| innings | inns |
| total_runs | runs |
| ball_faced | balls |
| highest_run | highest |
| not_out | no |
| average | avg |
| strike_rate | sr |
| 4s | fours |
| 6s | sixes |
| 50s | fifties |
| 100s | hundreds |

### Bowling
| CSV Column | JSON Field |
|------------|-----------|
| name | player |
| team_name | team |
| bowling_style | style |
| total_match | mat |
| innings | inns |
| overs | overs |
| runs | runs |
| total_wickets | wickets |
| highest_wicket | highest |
| maidens | maidens |
| avg | avg |
| economy | econ |

## Output JSON paths

| Competition | File |
|------------|------|
| SG IA | cricsearch-sg/src/data/sgiaStats.json |
| BPL | cricsearch-sg/src/data/bplStats.json |
| YPL | cricsearch-sg/src/data/yplStats.json |
| SCA | cricsearch-sg/src/data/scaStats.json |

Backups are saved to: `cricsearch-sg/src/data/backups/`

## Configuration

Set `REPO_ROOT` environment variable if running the backend from a different directory:
```bash
REPO_ROOT=/path/to/SG_Cricket_Search_Repo npm start
```
