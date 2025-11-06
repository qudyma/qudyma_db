/**
 * CrossRefFetcher - Handles fetching from CrossRef API
 */

const https = require('https');

class CrossRefFetcher {
    constructor() {
        // No state needed
    }

    async fetchMetadata(doi) {
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

    async inferJournalRef(doi, orcidEntry = null) {
        /**
         * Infers journal reference from DOI using CrossRef API
         * If ISBN is present (and type is 'book'), return "ISBN: <code>"
         */
        if (!doi) return null;
        
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

    async searchByTitleAndAuthor(title, authorName) {
        /**
         * Searches CrossRef by title and author name
         * Returns { doi, authors, summary, journal_ref } if found, null otherwise
         */
        return new Promise((resolve) => {
            const cleanTitle = title.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const lastName = authorName.split(',')[0].trim().split(' ').pop(); // Get last name
            
            const query = encodeURIComponent(`${cleanTitle} ${lastName}`);
            const url = `https://api.crossref.org/works?query=${query}&rows=3`;
            
            https.get(url, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.message && json.message.items && json.message.items.length > 0) {
                            // Find best match by comparing titles
                            const cleanSearchTitle = cleanTitle.toLowerCase();
                            let bestMatch = null;
                            let bestScore = 0;
                            
                            for (const item of json.message.items) {
                                if (!item.title || !item.title[0]) continue;
                                
                                const itemTitle = item.title[0].toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
                                
                                // Simple similarity: count matching words
                                const searchWords = cleanSearchTitle.split(' ');
                                const itemWords = itemTitle.split(' ');
                                const matches = searchWords.filter(w => w.length > 3 && itemWords.some(iw => iw.includes(w) || w.includes(iw))).length;
                                const score = matches / searchWords.length;
                                
                                if (score > bestScore && score > 0.6) {
                                    bestScore = score;
                                    bestMatch = item;
                                }
                            }
                            
                            if (bestMatch) {
                                const result = {
                                    doi: bestMatch.DOI ? `https://doi.org/${bestMatch.DOI}` : null,
                                    authors: null,
                                    summary: null,
                                    journal_ref: null
                                };
                                
                                // Extract authors
                                if (bestMatch.author && bestMatch.author.length > 0) {
                                    const authorsList = bestMatch.author.map(a => {
                                        if (a.literal) return a.literal;
                                        const name = [];
                                        if (a.given) name.push(a.given);
                                        if (a.family) name.push(a.family);
                                        return name.join(' ') || '';
                                    }).filter(a => a).join(', ');
                                    result.authors = authorsList || null;
                                }
                                
                                // Extract abstract
                                if (bestMatch.abstract) {
                                    result.summary = bestMatch.abstract
                                        .replace(/<[^>]*>/g, '')
                                        .replace(/&lt;/g, '<')
                                        .replace(/&gt;/g, '>')
                                        .replace(/&amp;/g, '&')
                                        .trim() || null;
                                }
                                
                                // Extract journal reference
                                if (bestMatch['container-title'] && bestMatch['container-title'][0]) {
                                    const journal = bestMatch['container-title'][0];
                                    const volume = bestMatch.volume || '';
                                    const page = bestMatch.page || '';
                                    const year = bestMatch.published?.['date-parts']?.[0]?.[0] || '';
                                    
                                    let ref = journal;
                                    if (volume) ref += ` ${volume}`;
                                    if (page) ref += `, ${page}`;
                                    if (year) ref += ` (${year})`;
                                    result.journal_ref = ref;
                                }
                                
                                resolve(result);
                                return;
                            }
                        }
                        resolve(null);
                    } catch (e) {
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null))
              .on('timeout', () => resolve(null));
        });
    }
}

module.exports = CrossRefFetcher;
