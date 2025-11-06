/**
 * OrcidFetcher - Handles fetching from ORCID API
 */

const https = require('https');
const DateUtils = require('../utils/DateUtils');

class OrcidFetcher {
    constructor(orcidOAuth) {
        this.orcidOAuth = orcidOAuth;
    }

    async request(endpoint) {
        /**
         * Makes an authenticated request to ORCID API
         */
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

    async fetchForResearcher(researcher) {
        /**
         * Fetches publications for a single researcher from ORCID
         * Returns an array of publication entries
         */
        const entries = [];

        try {
            const endpoint = `/v3.0/${researcher.orcid}/works`;
            const data = await this.request(endpoint);

            if (data && data.group) {
                for (const group of data.group) {
                    const workSummary = group['work-summary']?.[0];
                    if (!workSummary) continue;

                    const pubDate = workSummary['publication-date'];
                    if (!pubDate || !pubDate.year) continue;

                    const dateStr = `${pubDate.year.value}-${String(pubDate.month?.value || 1).padStart(2, '0')}-${String(pubDate.day?.value || 1).padStart(2, '0')}`;

                    if (DateUtils.shouldIncludePublication(dateStr, researcher)) {
                        const entry = {
                            title: workSummary.title?.title?.value || 'Untitled',
                            'publication-date': pubDate,
                            'external-ids': workSummary['external-ids']?.['external-id'] || []
                        };
                        
                        // Check if this work needs full details (no DOI or arXiv ID)
                        const hasDOI = entry['external-ids'].some(id => id['external-id-type'] === 'doi');
                        const hasArxiv = entry['external-ids'].some(id => id['external-id-type'] === 'arxiv');
                        
                        if (!hasDOI && !hasArxiv && workSummary['put-code']) {
                            // Fetch full work details to get contributors and citation
                            try {
                                const fullWorkEndpoint = `/v3.0/${researcher.orcid}/work/${workSummary['put-code']}`;
                                const fullWork = await this.request(fullWorkEndpoint);
                                
                                // Add contributors if available
                                if (fullWork.contributors && fullWork.contributors.contributor) {
                                    entry.contributors = fullWork.contributors.contributor.map(c => {
                                        const creditName = c['credit-name'];
                                        return creditName ? creditName.value : null;
                                    }).filter(n => n);
                                }
                                
                                // Add citation if available
                                if (fullWork.citation && fullWork.citation['citation-value']) {
                                    entry.citation = {
                                        type: fullWork.citation['citation-type'],
                                        value: fullWork.citation['citation-value']
                                    };
                                }
                                
                                // Small delay to respect rate limits
                                await new Promise(resolve => setTimeout(resolve, 500));
                            } catch (err) {
                                // Silently ignore errors fetching full details
                            }
                        }
                        
                        entries.push(entry);
                    }
                }
            }
        } catch (error) {
            console.log(`    Error: ${error.message}`);
        }

        return entries;
    }

    extractDOIFromExternalIds(externalIds) {
        /**
         * Extracts DOI from ORCID external IDs
         */
        if (!externalIds) return null;
        
        const doiEntry = externalIds.find(id => id['external-id-type'] === 'doi');
        if (doiEntry && doiEntry['external-id-value']) {
            const doi = doiEntry['external-id-value'];
            // Ensure DOI is in URL format
            if (doi.startsWith('http')) {
                return doi;
            } else {
                return `https://doi.org/${doi}`;
            }
        }
        return null;
    }

    extractArxivIdFromExternalIds(externalIds) {
        /**
         * Extracts arXiv ID from ORCID external IDs
         */
        if (!externalIds) return null;
        
        const arxivEntry = externalIds.find(id => id['external-id-type'] === 'arxiv');
        if (arxivEntry && arxivEntry['external-id-value']) {
            return arxivEntry['external-id-value'];
        }
        return null;
    }
}

module.exports = OrcidFetcher;
