const fs = require('fs');
const https = require('https');

// Read configuration files
const basicsData = JSON.parse(fs.readFileSync('basics.json', 'utf8'));
const orcidAuth = JSON.parse(fs.readFileSync('orcid_oauth.json', 'utf8'));

// Helper function to make ORCID API requests
function orcidRequest(orcid, path = '') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'pub.orcid.org',
            path: `/v3.0/${orcid}${path}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${orcidAuth.access_token}`
            },
            timeout: 30000
        };

        https.get(options, (res) => {
            let data = '';
            
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        }).on('timeout', () => {
            reject(new Error('Request timeout'));
        });
    });
}

// Helper function to check if a date is between two dates
function isDateInRange(dateObj, dateInStr, dateOutStr) {
    if (!dateObj || !dateObj.year) return false;
    
    // Construct date from ORCID date object (year/month/day)
    const year = dateObj.year.value;
    const month = dateObj.month ? dateObj.month.value : '01';
    const day = dateObj.day ? dateObj.day.value : '01';
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    const date = new Date(dateStr);
    const dateIn = new Date(dateInStr);
    const dateOut = dateOutStr ? new Date(dateOutStr) : new Date();
    
    return date >= dateIn && date <= dateOut;
}

// Main function to fetch ORCID publications
async function fetchOrcidPublications() {
    const publications = {};
    
    for (const [id, researcher] of Object.entries(basicsData)) {
        console.log(`Processing ${researcher.name} (ID: ${id})...`);
        
        // Skip if no ORCID
        if (!researcher.orcid) {
            console.log(`  Skipping: no ORCID`);
            continue;
        }
        
        // Skip if date_in is null
        if (!researcher.date_in) {
            console.log(`  Skipping: date_in is null`);
            continue;
        }
        
        try {
            console.log(`  Fetching works from ORCID API...`);
            const worksData = await orcidRequest(researcher.orcid, '/works');
            
            if (!worksData || !worksData.group) {
                console.log(`  No works found`);
                continue;
            }
            
            const filteredWorks = [];
            
            for (const group of worksData.group) {
                const workSummary = group['work-summary'] && group['work-summary'][0];
                if (!workSummary) continue;
                
                // Check publication date
                const pubDate = workSummary['publication-date'];
                if (!isDateInRange(pubDate, researcher.date_in, researcher.date_out)) {
                    continue;
                }
                
                // Extract work details
                const work = {
                    title: workSummary.title && workSummary.title.title ? workSummary.title.title.value : 'Untitled',
                    type: workSummary.type,
                    publication_date: pubDate,
                    journal: workSummary['journal-title'] ? workSummary['journal-title'].value : null,
                    url: workSummary.url ? workSummary.url.value : null,
                    put_code: workSummary['put-code'],
                    external_ids: workSummary['external-ids'] ? workSummary['external-ids']['external-id'] : []
                };
                
                // Check if this work needs full details (no DOI or arXiv ID)
                const hasDOI = work.external_ids.some(id => id['external-id-type'] === 'doi');
                const hasArxiv = work.external_ids.some(id => id['external-id-type'] === 'arxiv');
                
                if (!hasDOI && !hasArxiv) {
                    // Fetch full work details to get contributors and citation
                    try {
                        console.log(`    Fetching full details for: ${work.title.substring(0, 50)}...`);
                        const fullWork = await orcidRequest(researcher.orcid, `/work/${work.put_code}`);
                        
                        // Add contributors if available
                        if (fullWork.contributors && fullWork.contributors.contributor) {
                            work.contributors = fullWork.contributors.contributor.map(c => {
                                const creditName = c['credit-name'];
                                return creditName ? creditName.value : null;
                            }).filter(n => n);
                        }
                        
                        // Add citation if available
                        if (fullWork.citation && fullWork.citation['citation-value']) {
                            work.citation = {
                                type: fullWork.citation['citation-type'],
                                value: fullWork.citation['citation-value']
                            };
                        }
                        
                        // Add delay to respect rate limits
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (err) {
                        console.log(`    Could not fetch full details: ${err.message}`);
                    }
                }
                
                filteredWorks.push(work);
            }
            
            if (filteredWorks.length > 0) {
                publications[id] = {
                    name: researcher.name,
                    orcid: researcher.orcid,
                    date_in: researcher.date_in,
                    date_out: researcher.date_out,
                    works: filteredWorks
                };
                console.log(`  Found ${filteredWorks.length} works in date range`);
            } else {
                console.log(`  No works in date range`);
            }
            
        } catch (error) {
            console.log(`  ✗ ORCID API error: ${error.message}`);
        }
        
        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save to JSON file
    const outputFile = 'orcid_publications.json';
    fs.writeFileSync(outputFile, JSON.stringify(publications, null, 4));
    console.log(`\n✓ Publications saved to ${outputFile}`);
}

// Run the main function
fetchOrcidPublications().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
