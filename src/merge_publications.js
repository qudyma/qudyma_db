const fs = require('fs');
const http = require('http');
const https = require('https');

const arxivPubs = JSON.parse(fs.readFileSync('arxiv_publications.json', 'utf8'));
const orcidPubs = JSON.parse(fs.readFileSync('orcid_publications.json', 'utf8'));
const journalAbbreviations = JSON.parse(fs.readFileSync('journal_abbreviations.json', 'utf8'));
const normalizationPatterns = JSON.parse(fs.readFileSync('journal_normalization_patterns.json', 'utf8'));
const basics = JSON.parse(fs.readFileSync('basics.json', 'utf8'));

// Load highlights (coverage and awards) if the file exists
let highlights = { entries: [] };
try {
    highlights = JSON.parse(fs.readFileSync('highlights.json', 'utf8'));
} catch (err) {
    console.log('Note: highlights.json not found, skipping coverage and awards.');
}

// Build name variants map for author normalization
const nameVariantsMap = {};
for (const [id, researcher] of Object.entries(basics)) {
    const canonicalName = researcher.name;
    
    // Map canonical name to itself
    nameVariantsMap[canonicalName] = canonicalName;
    
    // Map all variants to canonical name
    if (researcher.name_variants) {
        for (const variant of researcher.name_variants) {
            nameVariantsMap[variant] = canonicalName;
        }
    }
}

// Normalize author names using name variants
function normalizeAuthorNames(authorsString) {
    if (!authorsString) return authorsString;
    
    // Split by comma, trim, and normalize each author
    const authors = authorsString.split(',').map(author => author.trim());
    const normalizedAuthors = authors.map(author => {
        // Check if this author matches any variant
        return nameVariantsMap[author] || author;
    });
    
    return normalizedAuthors.join(', ');
}

async function searchArxivByDOI(doi) {
    return new Promise((resolve, reject) => {
        const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
        const query = encodeURIComponent(`doi:"${cleanDoi}"`);
        const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=1`;
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const idMatch = data.match(/<id>http:\/\/arxiv\.org\/abs\/([\d.]+v?\d*)<\/id>/);
                if (idMatch) {
                    resolve(idMatch[1]);
                } else {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function fetchArxivMetadata(arxivId) {
    return new Promise((resolve, reject) => {
        const url = `http://export.arxiv.org/api/query?id_list=${arxivId}&max_results=1`;
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const entry = {
                        id: `http://arxiv.org/abs/${arxivId}`,
                        published: extractXMLField(data, 'published'),
                        updated: extractXMLField(data, 'updated'),
                        title: extractXMLField(data, 'title').replace(/\s+/g, ' ').trim(),
                        summary: extractXMLField(data, 'summary').replace(/\s+/g, ' ').trim(),
                        authors: extractAuthors(data),
                        categories: extractCategories(data),
                        doi: extractDOI(data),
                        formats: {
                            html: `http://arxiv.org/abs/${arxivId.replace(/v\d+$/, '')}`,
                            pdf: `http://arxiv.org/pdf/${arxivId.replace(/v\d+$/, '')}`
                        }
                    };
                    resolve(entry);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function extractXMLField(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
    return match ? match[1] : '';
}

function extractAuthors(xml) {
    const authors = [];
    const regex = /<name>([^<]+)<\/name>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        authors.push(match[1]);
    }
    return authors.join(', ');
}

function extractCategories(xml) {
    const categories = [];
    const regex = /<category[^>]+term="([^"]+)"[^>]*\/>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        categories.push(match[1]);
    }
    return categories;
}

function extractDOI(xml) {
    const match = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
    return match ? match[1] : null;
}

function extractDOIFromExternalIds(externalIds) {
    if (!externalIds) return null;
    for (const id of externalIds) {
        if (id['external-id-type'] === 'doi') {
            return id['external-id-value'];
        }
    }
    return null;
}

function extractArxivIdFromExternalIds(externalIds) {
    if (!externalIds) return null;
    for (const id of externalIds) {
        if (id['external-id-type'] === 'arxiv') {
            return id['external-id-value'];
        }
    }
    return null;
}

// Standardize journal abbreviations to ISO/ISSN standards
function standardizeJournalRef(journalRef) {
    if (!journalRef) return null;
    
    let standardized = journalRef;
    
    // First pass: replace full journal names with abbreviations
    for (const [full, abbrev] of Object.entries(journalAbbreviations)) {
        // Case-insensitive replacement
        const regex = new RegExp(full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        standardized = standardized.replace(regex, abbrev);
    }
    
    // Second pass: normalize inconsistent abbreviations using patterns from external config
    for (const [pattern, replacement] of Object.entries(normalizationPatterns)) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        standardized = standardized.replace(regex, replacement);
    }
    
    return standardized;
}

// Extract arXiv ID from entry and build arXiv URL
function buildArxivUrl(entry) {
    if (!entry.id) return null;
    const arxivIdMatch = entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/);
    if (!arxivIdMatch) return null;
    const arxivId = arxivIdMatch[1].replace(/v\d+$/, ''); // Remove version
    return `https://arxiv.org/abs/${arxivId}`;
}

// Build journal URL from DOI
function buildJournalUrl(doi) {
    if (!doi) return null;
    const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
    return `https://doi.org/${cleanDoi}`;
}

// Find highlights (coverage and awards) for a given DOI
function findHighlights(doi) {
    if (!doi) return null;
    const cleanDoi = doi.toLowerCase().replace('https://doi.org/', '').replace('http://doi.org/', '');
    
    for (const highlight of highlights.entries) {
        const highlightDoi = highlight.doi.toLowerCase().replace('https://doi.org/', '').replace('http://doi.org/', '');
        if (highlightDoi === cleanDoi) {
            return {
                coverage: highlight.coverage || [],
                awards: highlight.awards || []
            };
        }
    }
    return null;
}

async function mergePublications() {
    const merged = {};
    const processedDOIs = new Set();
    const processedArxivIds = new Set();
    
    console.log('Step 1: Processing arXiv publications...');
    
    for (const [researcherId, data] of Object.entries(arxivPubs)) {
        if (!merged[researcherId]) {
            merged[researcherId] = {
                name: data.name,
                orcid: data.orcid,
                arxiv_authorid: data.arxiv_authorid,
                date_in: data.date_in,
                date_out: data.date_out,
                entries: []
            };
        }
        
        for (const entry of data.entries) {
            merged[researcherId].entries.push(entry);
            
            if (entry.doi) {
                processedDOIs.add(entry.doi.toLowerCase());
            }
            const arxivIdMatch = entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/);
            if (arxivIdMatch) {
                processedArxivIds.add(arxivIdMatch[1]);
            }
        }
        
        console.log(`  ${data.name}: Added ${data.entries.length} arXiv entries`);
    }
    
    console.log('\nStep 2: Processing ORCID publications...');
    
    for (const [researcherId, data] of Object.entries(orcidPubs)) {
        let addedCount = 0;
        let skippedCount = 0;
        
        if (!merged[researcherId]) {
            merged[researcherId] = {
                name: data.name,
                orcid: data.orcid,
                arxiv_authorid: null,
                date_in: data.date_in,
                date_out: data.date_out,
                entries: []
            };
        }
        
        for (const work of data.works) {
            const doi = extractDOIFromExternalIds(work.external_ids);
            const arxivId = extractArxivIdFromExternalIds(work.external_ids);
            
            if (doi && processedDOIs.has(doi.toLowerCase())) {
                skippedCount++;
                continue;
            }
            
            if (arxivId && processedArxivIds.has(arxivId)) {
                skippedCount++;
                continue;
            }
            
            let arxivEntry = null;
            
            if (arxivId) {
                console.log(`    Fetching arXiv metadata for ${arxivId}...`);
                try {
                    arxivEntry = await fetchArxivMetadata(arxivId);
                    processedArxivIds.add(arxivId);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.log(`    Failed: ${error.message}`);
                }
            } else if (doi) {
                console.log(`    Searching arXiv for DOI ${doi}...`);
                try {
                    const foundArxivId = await searchArxivByDOI(doi);
                    if (foundArxivId) {
                        console.log(`    Found arXiv ID: ${foundArxivId}`);
                        arxivEntry = await fetchArxivMetadata(foundArxivId);
                        processedArxivIds.add(foundArxivId);
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.log(`    Search failed: ${error.message}`);
                }
            }
            
            if (arxivEntry) {
                merged[researcherId].entries.push(arxivEntry);
                if (doi) processedDOIs.add(doi.toLowerCase());
                addedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log(`  ${data.name}: Added ${addedCount} from ORCID, skipped ${skippedCount}`);
    }
    
    console.log('\nStep 3: Flattening into unified database...');
    
    // Flatten all publications into a single list
    const allPublications = {
        entries: []
    };
    
    const seenIds = new Set();
    const seenDOIs = new Set();
    
    for (const [researcherId, data] of Object.entries(merged)) {
        if (!data.entries || data.entries.length === 0) continue;
        
        console.log(`  Processing ${data.name}: ${data.entries.length} entries`);
        
        for (const entry of data.entries) {
            const arxivIdMatch = entry.id ? entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/) : null;
            const arxivId = arxivIdMatch ? arxivIdMatch[1] : null;
            const doi = entry.doi ? entry.doi.toLowerCase() : null;
            
            let isDuplicate = false;
            if (arxivId && seenIds.has(arxivId)) {
                isDuplicate = true;
            }
            if (doi && seenDOIs.has(doi)) {
                isDuplicate = true;
            }
            
            if (!isDuplicate) {
                // Normalize author names using name variants
                if (entry.authors) {
                    entry.authors = normalizeAuthorNames(entry.authors);
                }
                
                // Standardize journal_ref if present
                if (entry.journal_ref) {
                    entry.journal_ref = standardizeJournalRef(entry.journal_ref);
                }
                
                // Add arXiv URL
                entry.arxiv_url = buildArxivUrl(entry);
                
                // Add journal URL (from DOI if available, null otherwise)
                entry.journal_url = entry.doi ? buildJournalUrl(entry.doi) : null;
                
                // Add coverage and awards from highlights if available
                const highlightData = findHighlights(entry.doi);
                if (highlightData) {
                    if (highlightData.coverage && highlightData.coverage.length > 0) {
                        entry.coverage = highlightData.coverage;
                    }
                    if (highlightData.awards && highlightData.awards.length > 0) {
                        entry.awards = highlightData.awards;
                    }
                }
                
                allPublications.entries.push(entry);
                if (arxivId) seenIds.add(arxivId);
                if (doi) seenDOIs.add(doi);
            }
        }
    }
    
    const outputFile = 'publications.json';
    fs.writeFileSync(outputFile, JSON.stringify(allPublications, null, 4));
    console.log(`\n✓ Unified database saved to ${outputFile}`);
    console.log(`  Total unique publications: ${allPublications.entries.length}`);
}

mergePublications().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
