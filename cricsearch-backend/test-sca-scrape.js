// Quick test script to POST to SCA search and capture results HTML
const axios = require('axios');
const cheerio = require('cheerio');
const { URLSearchParams } = require('url');

const SCA_BASE_URL = 'https://scores.cricketsingapore.com/SingaporeCricketAssoc';
const CLUB_ID = '7683';

async function testSearch() {
  try {
    // Step 1: GET the search page first to get any cookies/session
    console.log('Step 1: GET search page...');
    const getResp = await axios.get(`${SCA_BASE_URL}/searchPlayer.do?clubId=${CLUB_ID}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 5,
      timeout: 15000,
    });
    
    // Extract cookies from response
    const cookies = getResp.headers['set-cookie'] || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('Cookies:', cookieStr || '(none)');
    console.log('GET status:', getResp.status);

    // Step 2: POST search with firstName
    console.log('\nStep 2: POST search for "Kintul"...');
    const formData = new URLSearchParams();
    formData.append('firstName', 'Kintul');
    formData.append('lastName', '');
    formData.append('teamName', '');
    formData.append('playerCCId', '');
    formData.append('emailId', '');
    formData.append('gender', '');
    formData.append('internalClub', '');
    formData.append('battingStyle', '');
    formData.append('bowlingStyle', '');
    formData.append('playerStatus', '');
    formData.append('clubId', CLUB_ID);
    
    const postResp = await axios.post(`${SCA_BASE_URL}/searchPlayer.do`, formData.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${SCA_BASE_URL}/searchPlayer.do?clubId=${CLUB_ID}`,
        'Cookie': cookieStr,
      },
      maxRedirects: 5,
      timeout: 15000,
    });
    
    console.log('POST status:', postResp.status);
    console.log('Response length:', postResp.data.length);
    
    // Parse results
    const $ = cheerio.load(postResp.data);
    
    // Look for tables - check #playersData first
    const playersDataTable = $('#playersData');
    console.log('\n#playersData exists:', playersDataTable.length > 0);
    
    // Check for any table with player data
    const allTables = $('table');
    console.log('Total tables found:', allTables.length);
    
    // Look for "noSearchPlayer" message
    const noPlayerMsg = $('#noSearchPlayer');
    console.log('noSearchPlayer element:', noPlayerMsg.length > 0, noPlayerMsg.text().trim());
    
    // Find all table headers to understand table structure
    allTables.each((idx, table) => {
      const headers = $(table).find('th');
      if (headers.length > 0) {
        const headerTexts = [];
        headers.each((i, th) => headerTexts.push($(th).text().trim()));
        console.log(`\nTable ${idx} headers:`, headerTexts.join(' | '));
        
        // Print first 3 rows of data
        const rows = $(table).find('tbody tr, tr').slice(0, 5);
        rows.each((i, row) => {
          const cells = [];
          $(row).find('td').each((j, td) => cells.push($(td).text().trim()));
          if (cells.length > 0) {
            console.log(`  Row ${i}:`, cells.join(' | '));
          }
          // Check for links
          $(row).find('a[href]').each((j, a) => {
            const href = $(a).attr('href');
            if (href && href.includes('player')) {
              console.log(`  Link: ${href}`);
            }
          });
        });
      }
    });
    
    // Save the response body portion for analysis
    const bodyStart = postResp.data.indexOf('<div class="holder point"');
    const bodyEnd = postResp.data.indexOf('</footer>');
    if (bodyStart > 0 && bodyEnd > bodyStart) {
      const relevantHtml = postResp.data.substring(bodyStart, bodyEnd);
      require('fs').writeFileSync('sca-results-sample.html', relevantHtml);
      console.log('\nSaved relevant HTML to sca-results-sample.html');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
  }
}

testSearch();
