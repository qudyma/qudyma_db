/**
 * PublicationFetcher - Handles fetching and merging publications
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

class PublicationFetcher {
    constructor(configPath = '../config', dataPath = '../data') {
        // Handle both relative and absolute paths
        if (path.isAbsolute(configPath)) {
            this.configPath = configPath;
        } else {
            this.configPath = path.join(__dirname, configPath);
        }
        
        if (path.isAbsolute(dataPath)) {
            this.dataPath = dataPath;
        } else {
            this.dataPath = path.join(__dirname, dataPath);
        }
        
        // Load configuration files
        this.loadConfig();
    }

    loadConfig() {
        this.basics = this.loadJSON(path.join(this.configPath, 'basics.json'));
        this.journalAbbreviations = this.loadJSON(path.join(this.configPath, 'journal_abbreviations.json'));
        this.normalizationPatterns = this.loadJSON(path.join(this.configPath, 'journal_normalization_patterns.json'));
        
        // Load highlights if exists
        try {
            this.highlights = this.loadJSON(path.join(this.configPath, 'highlights.json'));
        } catch (err) {
            this.highlights = { entries: [] };
        }
        
        // Load ORCID credentials if exists
        try {
            this.orcidOAuth = this.loadJSON(path.join(this.configPath, 'orcid_oauth.json'));
        } catch (err) {
            this.orcidOAuth = null;
        }
        
        // Build name variants map
        this.buildNameVariantsMap();
    }

    loadJSON(filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    buildNameVariantsMap() {
        this.nameVariantsMap = {};
        for (const [id, researcher] of Object.entries(this.basics)) {
            const canonicalName = researcher.name;
            this.nameVariantsMap[canonicalName] = canonicalName;
            
            if (researcher.name_variants) {
                for (const variant of researcher.name_variants) {
                    this.nameVariantsMap[variant] = canonicalName;
                }
            }
        }
    }

    // ==================== arXiv Fetching ====================

    async fetchJSON(url) {
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

    isDateInRange(dateStr, dateInStr, dateOutStr, journalRef = null) {
        const date = new Date(dateStr);
        const dateIn = new Date(dateInStr);
        const dateOut = dateOutStr ? new Date(dateOutStr) : new Date();
        
        // Check if the publication date is in range
        if (date >= dateIn && date <= dateOut) {
            return true;
        }
        
        // If the publication date is before date_in but there's a journal reference,
        // check if the journal year is within range (for arXiv papers published before
        // the final journal version)
        if (journalRef && date < dateIn) {
            // Extract year from journal_ref (common formats: "Journal 20, 1141 (2020)" or "Journal 20(2), 1141-1147 (2020)")
            const yearMatch = journalRef.match(/\((\d{4})\)/);
            if (yearMatch) {
                const journalYear = parseInt(yearMatch[1], 10);
                const dateInYear = dateIn.getFullYear();
                const dateOutYear = dateOut.getFullYear();
                if (journalYear >= dateInYear && journalYear <= dateOutYear) {
                    return true;
                }
            }
        }
        
        return false;
    }

    async fetchArxiv() {
        const publications = {};
        
        for (const [id, researcher] of Object.entries(this.basics)) {
            console.log(`  Processing ${researcher.name} (ID: ${id})...`);
            
            if (!researcher.date_in) {
                console.log(`    Skipping: date_in is null`);
                continue;
            }
            
            if (!researcher.arxiv_authorid && !researcher.orcid) {
                console.log(`    Skipping: no arXiv author ID or ORCID`);
                continue;
            }
            
            publications[id] = {
                name: researcher.name,
                arxiv_authorid: researcher.arxiv_authorid,
                orcid: researcher.orcid,
                date_in: researcher.date_in,
                date_out: researcher.date_out,
                entries: []
            };
            
            let data = null;
            
            // Try arXiv author ID first
            if (researcher.arxiv_authorid) {
                try {
                    const url = `https://arxiv.org/a/${researcher.arxiv_authorid}.json`;
                    data = await this.fetchJSON(url);
                    console.log(`    Fetched from arXiv author ID`);
                } catch (error) {
                    console.log(`    arXiv author ID failed: ${error.message}`);
                }
            }
            
            // Fallback to ORCID if arXiv author ID failed or not available
            if (!data && researcher.orcid) {
                try {
                    const url = `https://arxiv.org/a/${researcher.orcid}.json`;
                    data = await this.fetchJSON(url);
                    console.log(`    Fetched from ORCID`);
                } catch (error) {
                    console.log(`    ORCID fallback also failed: ${error.message}`);
                }
            }
            
            // Process entries if we got data
            if (data && data.entries) {
                for (const entry of data.entries) {
                    if (this.isDateInRange(entry.published, researcher.date_in, researcher.date_out, entry.journal_ref)) {
                        publications[id].entries.push(entry);
                    }
                }
                console.log(`    Fetched ${publications[id].entries.length} publications`);
            } else {
                console.log(`    No data available`);
            }
        }
        
        // Save to data directory
        const outputPath = path.join(this.dataPath, 'arxiv_publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(publications, null, 4));
        console.log(`  Saved to ${outputPath}`);
        
        return publications;
    }

    // ==================== ORCID Fetching ====================

    async orcidRequest(endpoint) {
        if (!this.orcidOAuth || !this.orcidOAuth.access_token) {
            throw new Error('ORCID OAuth credentials not available');
        }

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'pub.orcid.org',
                path: endpoint,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.orcidOAuth.access_token}`,
                    'Accept': 'application/json'
                }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async fetchOrcid() {
        if (!this.orcidOAuth) {
            console.log('  ORCID OAuth credentials not found, skipping ORCID fetch');
            return {};
        }

        const publications = {};

        for (const [id, researcher] of Object.entries(this.basics)) {
            console.log(`  Processing ${researcher.name} (ID: ${id})...`);
            
            if (!researcher.date_in) {
                console.log(`    Skipping: date_in is null`);
                continue;
            }
            
            if (!researcher.orcid) {
                console.log(`    Skipping: no ORCID`);
                continue;
            }

            publications[id] = {
                name: researcher.name,
                orcid: researcher.orcid,
                date_in: researcher.date_in,
                date_out: researcher.date_out,
                entries: []
            };

            try {
                const endpoint = `/v3.0/${researcher.orcid}/works`;
                const data = await this.orcidRequest(endpoint);

                if (data && data.group) {
                    for (const group of data.group) {
                        const workSummary = group['work-summary']?.[0];
                        if (!workSummary) continue;

                        const pubDate = workSummary['publication-date'];
                        if (!pubDate || !pubDate.year) continue;

                        const dateStr = `${pubDate.year.value}-${String(pubDate.month?.value || 1).padStart(2, '0')}-${String(pubDate.day?.value || 1).padStart(2, '0')}`;

                        if (this.isDateInRange(dateStr, researcher.date_in, researcher.date_out)) {
                            publications[id].entries.push({
                                title: workSummary.title?.title?.value || 'Untitled',
                                'publication-date': pubDate,
                                'external-ids': workSummary['external-ids']?.['external-id'] || []
                            });
                        }
                    }
                    console.log(`    Fetched ${publications[id].entries.length} publications`);
                }
            } catch (error) {
                console.log(`    Error: ${error.message}`);
            }
        }

        // Save to data directory
        const outputPath = path.join(this.dataPath, 'orcid_publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(publications, null, 4));
        console.log(`  Saved to ${outputPath}`);

        return publications;
    }

    // ==================== Merging and Processing ====================

    async searchArxivByDOI(doi) {
        return new Promise((resolve, reject) => {
            const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
            const query = encodeURIComponent(`doi:"${cleanDoi}"`);
            const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=1`;
            
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    const idMatch = data.match(/<id>http:\/\/arxiv\.org\/abs\/([\d.]+v?\d*)<\/id>/);
                    resolve(idMatch ? idMatch[1] : null);
                });
            }).on('error', reject);
        });
    }

    async fetchArxivMetadata(arxivId) {
        return new Promise((resolve, reject) => {
            const url = `http://export.arxiv.org/api/query?id_list=${arxivId}&max_results=1`;
            
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const entry = {
                            id: `http://arxiv.org/abs/${arxivId}`,
                            published: this.extractXMLField(data, 'published'),
                            updated: this.extractXMLField(data, 'updated'),
                            title: this.extractXMLField(data, 'title').replace(/\s+/g, ' ').trim(),
                            summary: this.extractXMLField(data, 'summary').replace(/\s+/g, ' ').trim(),
                            authors: this.extractAuthors(data),
                            categories: this.extractCategories(data),
                            doi: this.extractDOI(data),
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

    extractXMLField(xml, tag) {
        const match = xml.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
        return match ? match[1] : '';
    }

    extractAuthors(xml) {
        const authors = [];
        const regex = /<name>([^<]+)<\/name>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            authors.push(match[1]);
        }
        return authors.join(', ');
    }

    extractCategories(xml) {
        const categories = [];
        const regex = /<category[^>]+term="([^"]+)"[^>]*\/>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            categories.push(match[1]);
        }
        return categories;
    }

    extractDOI(xml) {
        const match = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
        return match ? match[1] : null;
    }

    extractDOIFromExternalIds(externalIds) {
        if (!externalIds) return null;
        for (const id of externalIds) {
            if (id['external-id-type'] === 'doi') {
                return id['external-id-value'];
            }
        }
        return null;
    }

    extractArxivIdFromExternalIds(externalIds) {
        if (!externalIds) return null;
        for (const id of externalIds) {
            if (id['external-id-type'] === 'arxiv') {
                return id['external-id-value'];
            }
        }
        return null;
    }

    formatOrcidDate(dateObj) {
        if (!dateObj) return new Date().toISOString();
        
        const year = dateObj.year?.value || new Date().getFullYear();
        const month = dateObj.month?.value || 1;
        const day = dateObj.day?.value || 1;
        
        return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`).toISOString();
    }

    standardizeJournalRef(journalRef) {
        if (!journalRef) return null;
        
        let standardized = journalRef;
        
        for (const [full, abbrev] of Object.entries(this.journalAbbreviations)) {
            const regex = new RegExp(full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            standardized = standardized.replace(regex, abbrev);
        }
        
        for (const [pattern, replacement] of Object.entries(this.normalizationPatterns)) {
            const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
            standardized = standardized.replace(regex, replacement);
        }
        
        return standardized;
    }

    buildArxivUrl(entry) {
        if (!entry.id) return null;
        const arxivIdMatch = entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/);
        if (!arxivIdMatch) return null;
        const arxivId = arxivIdMatch[1].replace(/v\d+$/, '');
        return `https://arxiv.org/abs/${arxivId}`;
    }

    buildJournalUrl(doi) {
        if (!doi) return null;
        const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
        return `https://doi.org/${cleanDoi}`;
    }

    findHighlights(doi) {
        if (!doi || !this.highlights.entries) return null;
        const cleanDoi = doi.toLowerCase();
        return this.highlights.entries.find(h => h.doi.toLowerCase() === cleanDoi);
    }

    normalizeAuthorNames(authorsString) {
        if (!authorsString) return authorsString;
        
        const authors = authorsString.split(',').map(author => author.trim());
        const normalizedAuthors = authors.map(author => {
            return this.nameVariantsMap[author] || author;
        });
        
        return normalizedAuthors.join(', ');
    }

    async inferJournalRefFromDOI(doi, orcidEntry) {
        /**
         * Infers journal reference from DOI using CrossRef API
         * If ISBN is present (and type is 'book'), return "ISBN: <code>"
         */
        if (!doi) return null;
        
        try {
            // Try to fetch from CrossRef API first to determine type
            const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
            const url = `https://api.crossref.org/works/${cleanDoi}`;
            
            return new Promise((resolve) => {
                const req = https.get(url, { timeout: 10000 }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.message) {
                                const msg = json.message;
                                
                                // Check if this is a book or book chapter
                                const isBook = msg.type === 'book' || 
                                             msg.type === 'book-chapter' || 
                                             msg.type === 'monograph' ||
                                             msg.type === 'edited-book';
                                
                                // If it's a book, check for ISBN in ORCID entry
                                if (isBook && orcidEntry && orcidEntry['external-ids']) {
                                    const isbn = orcidEntry['external-ids'].find(e => e['external-id-type'] === 'isbn');
                                    if (isbn && isbn['external-id-value']) {
                                        resolve(`ISBN: ${isbn['external-id-value']}`);
                                        return;
                                    }
                                }
                                
                                // Try container-title (journal name)
                                if (msg['container-title'] && msg['container-title'].length > 0) {
                                    const journal = msg['container-title'][0];
                                    
                                    // Format: "Journal Name vol(issue), page-page (year)"
                                    let ref = journal;
                                    
                                    if (msg.volume) {
                                        ref += ` ${msg.volume}`;
                                        if (msg.issue) {
                                            ref += `(${msg.issue})`;
                                        }
                                    }
                                    
                                    if (msg.page) {
                                        ref += `, ${msg.page}`;
                                    }
                                    
                                    if (msg.issued && msg.issued['date-parts'] && msg.issued['date-parts'][0]) {
                                        ref += ` (${msg.issued['date-parts'][0][0]})`;
                                    }
                                    
                                    resolve(ref);
                                    return;
                                }
                            }
                            resolve(null);
                        } catch (e) {
                            resolve(null);
                        }
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve(null);
                });
                req.on('error', () => resolve(null));
            });
        } catch (e) {
            return null;
        }
    }

    async fetchMetadataFromCrossRef(doi) {
        /**
         * Fetches authors and abstract from CrossRef API for a given DOI
         * Returns { authors: string, summary: string } or { authors: null, summary: null }
         */
        if (!doi) return { authors: null, summary: null };
        
        try {
            const cleanDoi = doi.replace('https://doi.org/', '').replace('http://doi.org/', '');
            const url = `https://api.crossref.org/works/${cleanDoi}`;
            
            return new Promise((resolve) => {
                const req = https.get(url, { timeout: 10000 }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.message) {
                                const msg = json.message;
                                const result = { authors: null, summary: null };
                                
                                // Extract authors
                                if (msg.author && msg.author.length > 0) {
                                    const authorsList = msg.author.map(a => {
                                        if (a.literal) return a.literal;
                                        const name = [];
                                        if (a.given) name.push(a.given);
                                        if (a.family) name.push(a.family);
                                        return name.join(' ') || '';
                                    }).filter(a => a).join(', ');
                                    
                                    if (authorsList) {
                                        result.authors = authorsList;
                                    }
                                }
                                
                                // Extract abstract/summary
                                if (msg.abstract) {
                                    // Clean up the abstract (remove HTML tags if any)
                                    let abstract = msg.abstract
                                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                                        .replace(/&lt;/g, '<')
                                        .replace(/&gt;/g, '>')
                                        .replace(/&amp;/g, '&')
                                        .trim();
                                    
                                    if (abstract && abstract.length > 50) {
                                        result.summary = abstract;
                                    }
                                }
                                
                                resolve(result);
                                return;
                            }
                            resolve({ authors: null, summary: null });
                        } catch (e) {
                            resolve({ authors: null, summary: null });
                        }
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({ authors: null, summary: null });
                });
                req.on('error', () => resolve({ authors: null, summary: null }));
            });
        } catch (e) {
            return { authors: null, summary: null };
        }
    }

    normalizeAuthorNames(authorsString) {
        if (!authorsString) return authorsString;
        
        const authors = authorsString.split(',').map(author => author.trim());
        const normalizedAuthors = authors.map(author => {
            return this.nameVariantsMap[author] || author;
        });
        
        return normalizedAuthors.join(', ');
    }

    async mergePublications() {
        // Load cached data
        const arxivPubs = this.loadJSON(path.join(this.dataPath, 'arxiv_publications.json'));
        const orcidPubs = this.loadJSON(path.join(this.dataPath, 'orcid_publications.json'));

        const merged = {};
        const processedDOIs = new Set();

        // Step 1: Process arXiv publications
        console.log('  Step 1: Processing arXiv publications...');
        for (const [researcherId, data] of Object.entries(arxivPubs)) {
            if (!merged[researcherId]) {
                merged[researcherId] = {
                    name: data.name,
                    entries: []
                };
            }
            
            if (data.entries) {
                merged[researcherId].entries.push(...data.entries);
                for (const entry of data.entries) {
                    if (entry.doi) {
                        processedDOIs.add(entry.doi.toLowerCase());
                    }
                }
            }
        }

        // Step 2: Process ORCID publications
        console.log('  Step 2: Processing ORCID publications...');
        for (const [researcherId, data] of Object.entries(orcidPubs)) {
            if (!data.entries) continue;
            
            let addedCount = 0;
            let skippedCount = 0;

            for (const orcidEntry of data.entries) {
                const doi = this.extractDOIFromExternalIds(orcidEntry['external-ids']);
                const arxivId = this.extractArxivIdFromExternalIds(orcidEntry['external-ids']);
                
                // Skip if this DOI was already added from arXiv
                if (doi && processedDOIs.has(doi.toLowerCase())) {
                    skippedCount++;
                    continue;
                }

                // Try to get or fetch arXiv metadata
                let arxivEntry = null;
                
                if (arxivId) {
                    try {
                        arxivEntry = await this.fetchArxivMetadata(arxivId);
                    } catch (e) {
                        // Ignore errors
                    }
                }
                
                if (!arxivEntry && doi) {
                    try {
                        const foundArxivId = await this.searchArxivByDOI(doi);
                        if (foundArxivId) {
                            arxivEntry = await this.fetchArxivMetadata(foundArxivId);
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }

                // If we have arXiv metadata, use it; otherwise create entry from ORCID data
                if (arxivEntry) {
                    if (!merged[researcherId]) {
                        merged[researcherId] = {
                            name: data.name,
                            entries: []
                        };
                    }
                    merged[researcherId].entries.push(arxivEntry);
                    if (doi) {
                        processedDOIs.add(doi.toLowerCase());
                    }
                    addedCount++;
                } else {
                    // Create entry from ORCID data if no arXiv found
                    const orcidOnlyEntry = {
                        id: doi ? `doi:${doi}` : `orcid:${researcherId}-${orcidEntry.title}`,
                        title: orcidEntry.title || '',
                        journal_ref: orcidEntry.journal ? orcidEntry.journal : null,
                        doi: doi || null,
                        published: this.formatOrcidDate(orcidEntry['publication-date']),
                        updated: this.formatOrcidDate(orcidEntry['publication-date']),
                        summary: '',
                        authors: '',
                        categories: [],
                        formats: { html: null, pdf: null },
                        // Store ORCID external-ids for later ISBN/ISSN detection
                        _orcid_external_ids: orcidEntry['external-ids']
                    };
                    
                    if (!merged[researcherId]) {
                        merged[researcherId] = {
                            name: data.name,
                            entries: []
                        };
                    }
                    merged[researcherId].entries.push(orcidOnlyEntry);
                    if (doi) {
                        processedDOIs.add(doi.toLowerCase());
                    }
                    addedCount++;
                }
            }
            
            console.log(`    ${data.name}: Added ${addedCount}, skipped ${skippedCount}`);
        }

        // Step 3: Flatten and enrich
        console.log('  Step 3: Flattening and enriching...');
        const allPublications = { entries: [] };
        const seenIds = new Set();
        const seenDOIs = new Set();
        const titleMap = {};
        const publicationAuthors = {}; // Maps publication ID to set of researcher IDs

        // Build a map of titles for duplicate detection
        for (const [researcherId, data] of Object.entries(merged)) {
            if (!data.entries || data.entries.length === 0) continue;
            
            for (const entry of data.entries) {
                const title = entry.title ? entry.title.toLowerCase().trim() : '';
                if (!titleMap[title]) {
                    titleMap[title] = [];
                }
                titleMap[title].push({ researcherId, entry });
                
                // Track author IDs for this publication
                const pubKey = entry.doi || entry.id || title;
                if (!publicationAuthors[pubKey]) {
                    publicationAuthors[pubKey] = new Set();
                }
                publicationAuthors[pubKey].add(researcherId);
            }
        }

        // Process each researcher's entries
        for (const [researcherId, data] of Object.entries(merged)) {
            if (!data.entries || data.entries.length === 0) continue;
            
            for (const entry of data.entries) {
                const arxivIdMatch = entry.id ? entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/) : null;
                const arxivId = arxivIdMatch ? arxivIdMatch[1] : null;
                const doi = entry.doi ? entry.doi.toLowerCase() : null;
                
                let isDuplicate = false;
                if (arxivId && seenIds.has(arxivId)) isDuplicate = true;
                if (doi && seenDOIs.has(doi)) isDuplicate = true;
                
                // Check for title-based duplicates (for ORCID entries with no arXiv ID)
                if (!isDuplicate && !arxivId) {
                    const titleKey = entry.title ? entry.title.toLowerCase().trim() : '';
                    const duplicateEntries = titleMap[titleKey];
                    
                    if (duplicateEntries && duplicateEntries.length > 1) {
                        // Multiple entries with same title - find the best one
                        const completeEntries = duplicateEntries.filter(d => 
                            d.entry.id && 
                            (d.entry.id.includes('arxiv.org') || d.entry.authors) &&
                            (d.entry.summary || d.entry.journal_ref)
                        );
                        
                        if (completeEntries.length > 0) {
                            // Use the complete entry (usually from arXiv)
                            const bestEntry = completeEntries[0].entry;
                            
                            // Skip this entry if the complete one was already processed
                            if (bestEntry === entry) {
                                // This is the complete entry, process it
                                isDuplicate = false;
                            } else {
                                // This is a duplicate ORCID entry, skip it
                                isDuplicate = true;
                            }
                        }
                    }
                }
                
                if (!isDuplicate) {
                    // Normalize author names
                    if (entry.authors) {
                        entry.authors = this.normalizeAuthorNames(entry.authors);
                    }
                    
                    // Fetch missing authors and summary from CrossRef if needed
                    if (entry.doi && ((!entry.authors || entry.authors.trim() === '') || (!entry.summary || entry.summary.trim() === ''))) {
                        const crossrefData = await this.fetchMetadataFromCrossRef(entry.doi);
                        if (crossrefData.authors && (!entry.authors || entry.authors.trim() === '')) {
                            entry.authors = crossrefData.authors;
                        }
                        if (crossrefData.summary && (!entry.summary || entry.summary.trim() === '')) {
                            entry.summary = crossrefData.summary;
                        }
                    }
                    
                    // Add QUDYMA author IDs from the tracking map
                    const pubKey = entry.doi || entry.id || (entry.title ? entry.title.toLowerCase().trim() : '');
                    entry.author_ids = publicationAuthors[pubKey] ? Array.from(publicationAuthors[pubKey]).sort() : [];
                    
                    // Standardize journal ref, or infer from DOI if missing
                    if (entry.journal_ref) {
                        entry.journal_ref = this.standardizeJournalRef(entry.journal_ref);
                    } else if (entry.doi) {
                        // Infer journal_ref from DOI using CrossRef (will detect books vs articles)
                        const inferredRef = await this.inferJournalRefFromDOI(entry.doi, entry._orcid_external_ids ? { 'external-ids': entry._orcid_external_ids } : null);
                        if (inferredRef) {
                            entry.journal_ref = inferredRef;
                        }
                    }
                    
                    // Add URLs - try to find arXiv version even for DOI-only entries
                    entry.arxiv_url = this.buildArxivUrl(entry);
                    
                    // If no arXiv URL yet but we have a DOI, try to find the arXiv version
                    if (!entry.arxiv_url && entry.doi) {
                        try {
                            const foundArxivId = await this.searchArxivByDOI(entry.doi);
                            if (foundArxivId) {
                                const arxivIdClean = foundArxivId.replace(/v\d+$/, '');
                                entry.arxiv_url = `https://arxiv.org/abs/${arxivIdClean}`;
                                // Also populate formats if they're empty
                                if (!entry.formats || !entry.formats.html) {
                                    entry.formats = {
                                        html: `http://arxiv.org/abs/${arxivIdClean}`,
                                        pdf: `http://arxiv.org/pdf/${arxivIdClean}`
                                    };
                                }
                            }
                        } catch (e) {
                            // Ignore errors when searching for arXiv version
                        }
                    }
                    
                    entry.journal_url = entry.doi ? this.buildJournalUrl(entry.doi) : null;
                    
                    // Remove internal metadata fields
                    delete entry._orcid_external_ids;
                    
                    // Add highlights
                    const highlightData = this.findHighlights(entry.doi);
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

        // Save to data directory
        const outputPath = path.join(this.dataPath, 'publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(allPublications, null, 4));
        console.log(`  Saved ${allPublications.entries.length} publications to ${outputPath}`);

        return allPublications;
    }
}

module.exports = PublicationFetcher;
