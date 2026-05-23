# Phase 1: Scraping Documentation — CricSearch SG

## Overview

Phase 1 connects the CricSearch SG frontend to live cricket data from the **Singapore Cricket Association (SCA)** platform hosted on CricClubs. The SPORTYGO platform was assessed but found to be blocked by anti-bot protection.

---

## Platform: SCA (Singapore Cricket Association)

### Target URLs

| Purpose | URL | Method |
|---------|-----|--------|
| Search Page (GET form) | `https://scores.cricketsingapore.com/SingaporeCricketAssoc/searchPlayer.do?clubId=7683` | GET |
| Search Submit | `https://scores.cricketsingapore.com/SingaporeCricketAssoc/searchPlayer.do` | POST |
| Player Profile | `https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId={id}&clubId=7683` | GET |

### Rendering Type

**Server-Side Rendered (SSR)** — The entire page, including search results, is rendered as HTML on the server. No JavaScript rendering is needed. Cheerio + axios is sufficient.

### Request Flow

```
1. GET /searchPlayer.do?clubId=7683
   → Obtain JSESSIONID cookie from Set-Cookie header
   
2. POST /searchPlayer.do
   Content-Type: application/x-www-form-urlencoded
   Cookie: JSESSIONID=<from step 1>
   Referer: https://scores.cricketsingapore.com/SingaporeCricketAssoc/searchPlayer.do?clubId=7683
   
   Body: firstName=Kintul&lastName=&teamName=&playerCCId=&emailId=&gender=&internalClub=&battingStyle=&bowlingStyle=&playerStatus=&clubId=7683
   
   → Returns HTML page with form (pre-filled) + results table
```

### Form Fields

| Field Name | Input Type | Values | Required |
|------------|-----------|--------|----------|
| `firstName` | text | Free text | At least one field |
| `lastName` | text (hidden on page) | Free text | At least one field |
| `teamName` | text | Free text | At least one field |
| `playerCCId` | number | Numeric CC ID | At least one field |
| `emailId` | email | Email address | At least one field |
| `gender` | select | `""` (All), `"M"`, `"F"` | Optional |
| `internalClub` | select | `""` (All), or exact club name string | At least one field |
| `battingStyle` | select | `""` (All), `"Right Handed Batsman"`, `"Left Handed Batsman"` | Optional |
| `bowlingStyle` | select | `""` (All), `"Right Arm Medium"`, `"Right Arm Fast"`, `"Right Arm Off Spin"`, `"Right Arm Leg Spin"`, `"Left Arm Fast"`, `"Left Arm Medium"`, `"Left Arm Off Spin"`, `"Left Arm Leg Spin"` | Optional |
| `playerStatus` | select | `""` (All), `"1"` (Active), `"3"` (In-Active) | Optional |
| `clubId` | hidden | `"7683"` (appended to POST body) | Always required |

**Validation**: At least one of `firstName`, `teamName`, `playerCCId`, `emailId`, `internalClub`, `mclId`, or `usaca` must be provided. The upstream site validates this client-side via `verifyInput()`.

### Selectors Used

```javascript
// Results table
'#playersData'                    // Main results table
'#playersData tbody tr'           // Result rows
'th'                              // Cell selector (NOT td - SCA uses <th> in tbody!)

// Player data extraction
'a[href*="viewPlayer.do"]'        // Player profile link in name cell
'img[alt="Verified"]'             // Verified player icon
'img[alt="Not Verified"]'         // Unverified player icon
'table td'                        // Nested table for team name

// Error/empty states
'#noSearchPlayer'                 // No results message
'#searchError'                    // Validation error message

// URL patterns
/playerId=(\d+)/                  // Extract player ID from URL
/clubId=(\d+)/                    // Extract club ID from URL
```

### Results Table HTML Structure

```html
<table class="table sortable table-striped" id="playersData">
  <thead>
    <tr>
      <th>No</th>
      <th>Player Name</th>
      <th>Player Role</th>
      <th>Team</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>1</th>
      <th style="text-align:left!important">
        <a href="/SingaporeCricketAssoc/viewPlayer.do?playerId=1077340&clubId=7683">
          Kintul Mistry (1077340)
        </a>
        <img alt="Verified" title="Verified" src="/utilsv2/images/ok.png" ...>
      </th>
      <th>All Rounder</th>
      <th>
        <table>
          <tr>
            <td><img src="..." class="img-responsive img-circle" .../></td>
            <td>&nbsp;IIT ALUMNI</td>
          </tr>
        </table>
      </th>
    </tr>
  </tbody>
</table>
```

**Key Observations:**
1. Result rows use `<th>` instead of `<td>` — this is unusual but consistent
2. Player name cell includes CC ID in parentheses: ` Kintul Mistry (1077340) `
3. Team cell contains a nested `<table>` with team logo and name
4. Team name text starts with `&nbsp;`

### Cookie/Session Notes

- A `JSESSIONID` cookie is set on the initial GET request
- This cookie MUST be included in the subsequent POST request
- No CSRF tokens or hidden form tokens were observed
- No rate limiting was detected during testing

### Anti-Bot Notes

- No anti-bot protection on the SCA domain (scores.cricketsingapore.com)
- Standard User-Agent header is sufficient
- No CAPTCHA, no Cloudflare, no JavaScript challenges

---

## Platform: SPORTYGO (CricClubs)

### Target URL

`https://www.cricclubs.com/sportygo/searchPlayer.do?clubId=4263`

### Status: BLOCKED ❌

**HTTP scraping returns 403 Forbidden.**

```
GET https://www.cricclubs.com/sportygo/searchPlayer.do?clubId=4263
→ 403 Forbidden
```

### Anti-Bot Assessment

- The `www.cricclubs.com` domain has anti-bot protection that blocks non-browser HTTP clients
- The same CricClubs platform works fine on the `scores.cricketsingapore.com` subdomain (SCA)
- This suggests CricClubs applies different protection rules per domain/deployment

### Recommendation

SPORTYGO integration requires **Playwright** (headless browser) to:
1. Navigate to the page and pass any JavaScript challenges
2. Fill and submit the search form
3. Wait for results to render
4. Extract data from the rendered DOM

This is deferred to Phase 2.

---

## Sample Request & Response

### Backend API Request

```bash
POST http://localhost:5000/api/sca/players/search
Content-Type: application/json

{
  "firstName": "Kintul"
}
```

### Backend API Response

```json
{
  "source": "sca",
  "query": {
    "firstName": "Kintul"
  },
  "totalResults": 3,
  "players": [
    {
      "id": "1077340",
      "name": "Kintul Mistry",
      "profileUrl": "https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1077340&clubId=7683",
      "playerRole": "All Rounder",
      "teamName": "IIT ALUMNI",
      "verified": true,
      "raw": {
        "rowNumber": "1",
        "nameCell": " Kintul Mistry (1077340) ",
        "roleCell": "All Rounder",
        "teamCell": "IIT ALUMNI"
      }
    },
    {
      "id": "1013948",
      "name": "Mist3331 Kintul Mistry",
      "profileUrl": "https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1013948&clubId=7683",
      "playerRole": "All Rounder",
      "teamName": "IIT ALUMNI ASSOCIATION SINGAPORE IIT Alumni",
      "verified": false,
      "raw": {
        "rowNumber": "2",
        "nameCell": " Mist3331 Kintul Mistry (1013948) ",
        "roleCell": "All Rounder",
        "teamCell": "IIT ALUMNI ASSOCIATION SINGAPORE IIT Alumni"
      }
    },
    {
      "id": "1013949",
      "name": "Mist3331mistry Kintul",
      "profileUrl": "https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1013949&clubId=7683",
      "playerRole": "All Rounder",
      "teamName": "Cognizant",
      "verified": false,
      "raw": {
        "rowNumber": "3",
        "nameCell": " Mist3331mistry Kintul (1013949) ",
        "roleCell": "All Rounder",
        "teamCell": "Cognizant"
      }
    }
  ],
  "meta": {
    "method": "cheerio",
    "upstreamUrl": "https://scores.cricketsingapore.com/SingaporeCricketAssoc/searchPlayer.do",
    "responseStatus": 200,
    "blocked": false,
    "empty": false,
    "message": null,
    "scrapedAt": "2026-05-23T04:15:00.000Z"
  }
}
```

---

## Architecture

```
Frontend (React, port 3000)
    │
    └─── POST /api/sca/players/search ──→ Backend (Express, port 5000)
                                               │
                                               ├── GET searchPlayer.do (get session cookie)
                                               │
                                               └── POST searchPlayer.do (submit search form)
                                                      │
                                                      └── Cheerio parses HTML response
                                                             │
                                                             └── Normalized JSON returned to frontend
```

## Setup Instructions

### Backend
```bash
cd cricsearch-backend
npm install
npm start
# Server runs on http://localhost:5000
```

### Frontend
```bash
cd cricsearch-sg
npm install
npm start
# App runs on http://localhost:3000
```

### Environment Variables

**Backend** (`cricsearch-backend/.env`):
```
PORT=5000
NODE_ENV=development
DEBUG_SCRAPER=true
```

**Frontend** (`cricsearch-sg/.env`):
```
REACT_APP_API_URL=http://localhost:5000
```
