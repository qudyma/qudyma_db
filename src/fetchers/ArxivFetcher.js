/**
 * ArxivFetcher - Handles fetching from arXiv API
 */

const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const XmlParser = require('../parsers/XmlParser');
const DateUtils = require('../utils/DateUtils');

class ArxivFetcher {
    constructor() {
        // No state needed
    }

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

    async fetchForResearcher(researcher) {
        /**
         * Fetches publications for a single researcher from arXiv
         * Returns an array of publication entries
         */
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
        
        // Filter entries by date range
        const entries = [];
        if (data && data.entries) {
            for (const entry of data.entries) {
                if (DateUtils.shouldIncludePublication(entry.published, researcher, entry.journal_ref)) {
                    entries.push(entry);
                }
            }
        }
        
        return entries;
    }

    async searchByDOI(doi) {
        /**
         * Searches arXiv by DOI
         * Returns arXiv ID if found, null otherwise
         */
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

    async searchByTitleAndAuthor(title, authorName) {
        /**
         * Searches arXiv by title and author name
         * Returns the entry data if found, null otherwise
         */
        return new Promise((resolve) => {
            // Clean and prepare search query
            const cleanTitle = title.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const cleanAuthor = authorName.split(',')[0].trim(); // Take first author
            
            // Search by title AND author
            const query = encodeURIComponent(`ti:"${cleanTitle}" AND au:"${cleanAuthor}"`);
            const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=1`;
            
            http.get(url, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', async () => {
                    try {
                        const idMatch = data.match(/<id>http:\/\/arxiv\.org\/abs\/([\d.]+v?\d*)<\/id>/);
                        if (idMatch) {
                            // Fetch full metadata for this arXiv ID
                            const metadata = await this.fetchMetadata(idMatch[1]);
                            resolve(metadata);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null))
              .on('timeout', () => resolve(null));
        });
    }

    async fetchMetadata(arxivId) {
        /**
         * Fetches metadata for a specific arXiv ID
         * Returns entry object with all metadata
         */
        return new Promise((resolve, reject) => {
            const url = `http://export.arxiv.org/api/query?id_list=${arxivId}&max_results=1`;
            
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const entry = {
                            id: `http://arxiv.org/abs/${arxivId}`,
                            published: XmlParser.extractXMLField(data, 'published'),
                            updated: XmlParser.extractXMLField(data, 'updated'),
                            title: XmlParser.extractXMLField(data, 'title').replace(/\s+/g, ' ').trim(),
                            summary: XmlParser.extractXMLField(data, 'summary').replace(/\s+/g, ' ').trim(),
                            authors: XmlParser.extractAuthors(data),
                            categories: XmlParser.extractCategories(data),
                            doi: XmlParser.extractDOI(data),
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
}

module.exports = ArxivFetcher;
