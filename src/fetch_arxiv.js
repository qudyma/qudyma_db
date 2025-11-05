const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const basicsData = JSON.parse(fs.readFileSync('basics.json', 'utf8'));

async function fetchJSON(url) {
    const tmpFile = `/tmp/arxiv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.js`;
    try {
        const jsUrl = url.replace('.json', '.js');
        await execPromise(`wget -q -T 30 -t 3 -O "${tmpFile}" "${jsUrl}"`);
        
        if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
            throw new Error('Empty or missing file');
        }
        
        let data = fs.readFileSync(tmpFile, 'utf8');
        fs.unlinkSync(tmpFile);
        
        const match = data.match(/jsonarXivFeed\((.*)\)/s);
        if (match && match[1]) {
            return JSON.parse(match[1]);
        } else {
            return JSON.parse(data);
        }
    } catch (error) {
        if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
        }
        throw new Error('Failed to fetch or parse');
    }
}

function isDateInRange(dateStr, dateInStr, dateOutStr) {
    const date = new Date(dateStr);
    const dateIn = new Date(dateInStr);
    const dateOut = dateOutStr ? new Date(dateOutStr) : new Date();
    return date >= dateIn && date <= dateOut;
}

async function fetchArxivPublications() {
    const publications = {};
    
    for (const [id, researcher] of Object.entries(basicsData)) {
        console.log(`Processing ${researcher.name} (ID: ${id})...`);
        
        if (!researcher.date_in) {
            console.log(`  Skipping: date_in is null`);
            continue;
        }
        
        let arxivData = null;
        
        if (researcher.orcid) {
            const orcidUrl = `https://arxiv.org/a/${researcher.orcid}.json`;
            console.log(`  Trying ORCID...`);
            try {
                arxivData = await fetchJSON(orcidUrl);
                console.log(`  ✓ Success with ORCID`);
            } catch (error) {
                console.log(`  ✗ ORCID failed`);
            }
        }
        
        if (!arxivData && researcher.arxiv_authorid) {
            const authorIdUrl = `https://arxiv.org/a/${researcher.arxiv_authorid}.json`;
            console.log(`  Trying arXiv Author ID...`);
            try {
                arxivData = await fetchJSON(authorIdUrl);
                console.log(`  ✓ Success with arXiv Author ID`);
            } catch (error) {
                console.log(`  ✗ arXiv Author ID failed`);
            }
        }
        
        if (!arxivData) {
            console.log(`  Skipping: no data available`);
            continue;
        }
        
        if (arxivData.entries && Array.isArray(arxivData.entries)) {
            const filteredEntries = arxivData.entries.filter(entry => {
                const published = entry.published;
                const updated = entry.updated;
                const publishedInRange = published && isDateInRange(published, researcher.date_in, researcher.date_out);
                const updatedInRange = updated && isDateInRange(updated, researcher.date_in, researcher.date_out);
                return publishedInRange || updatedInRange;
            });
            
            if (filteredEntries.length > 0) {
                publications[id] = {
                    name: researcher.name,
                    orcid: researcher.orcid,
                    arxiv_authorid: researcher.arxiv_authorid,
                    date_in: researcher.date_in,
                    date_out: researcher.date_out,
                    entries: filteredEntries
                };
                console.log(`  Found ${filteredEntries.length} publications in date range`);
            } else {
                console.log(`  No publications in date range`);
            }
        } else {
            console.log(`  No entries found`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const outputFile = 'arxiv_publications.json';
    fs.writeFileSync(outputFile, JSON.stringify(publications, null, 4));
    console.log(`\n✓ Publications saved to ${outputFile}`);
}

fetchArxivPublications().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
