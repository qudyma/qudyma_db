/**
 * PublicationMerger - Handles merging and enriching publications from multiple sources
 */

const fs = require('fs');
const path = require('path');
const ArxivFetcher = require('../fetchers/ArxivFetcher');
const CrossRefFetcher = require('../fetchers/CrossRefFetcher');
const CitationParser = require('../parsers/CitationParser');
const AuthorUtils = require('../utils/AuthorUtils');
const UrlBuilder = require('../utils/UrlBuilder');
const DateUtils = require('../utils/DateUtils');

class PublicationMerger {
    constructor(dataPath, basics, journalAbbreviations, normalizationPatterns, highlights) {
        this.dataPath = dataPath;
        this.basics = basics;
        this.journalAbbreviations = journalAbbreviations;
        this.normalizationPatterns = normalizationPatterns;
        this.highlights = highlights;
        
        // Initialize fetchers
        this.arxivFetcher = new ArxivFetcher();
        this.crossrefFetcher = new CrossRefFetcher();
        
        // Build name variants map
        this.nameVariantsMap = AuthorUtils.buildNameVariantsMap(basics);
    }

    normalizeDoi(doi) {
        if (!doi) return null;
        // Remove http/https prefix and normalize to lowercase
        return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').toLowerCase().trim();
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

    findHighlights(doi) {
        if (!doi || !this.highlights.entries) return null;
        const cleanDoi = doi.toLowerCase();
        return this.highlights.entries.find(h => h.doi.toLowerCase() === cleanDoi);
    }

    normalizeAuthorNames(authorsString) {
        return AuthorUtils.normalizeAuthorNames(authorsString, this.nameVariantsMap);
    }

    findQudymaAuthorIdsByName(authorsString) {
        return AuthorUtils.findQudymaAuthorIdsByName(authorsString, this.nameVariantsMap, this.basics);
    }

    extractDOIFromExternalIds(externalIds) {
        if (!externalIds) return null;
        
        const doiEntry = externalIds.find(id => id['external-id-type'] === 'doi');
        if (doiEntry && doiEntry['external-id-value']) {
            const doi = doiEntry['external-id-value'];
            if (doi.startsWith('http')) {
                return doi;
            } else {
                return `https://doi.org/${doi}`;
            }
        }
        return null;
    }

    extractArxivIdFromExternalIds(externalIds) {
        if (!externalIds) return null;
        
        const arxivEntry = externalIds.find(id => id['external-id-type'] === 'arxiv');
        if (arxivEntry && arxivEntry['external-id-value']) {
            return arxivEntry['external-id-value'];
        }
        return null;
    }

    async mergePublications() {
        // Load cached data
        const arxivPubs = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'arxiv_publications.json'), 'utf8'));
        const orcidPubs = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'orcid_publications.json'), 'utf8'));

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
                        const normalizedDoi = this.normalizeDoi(entry.doi);
                        if (normalizedDoi) {
                            processedDOIs.add(normalizedDoi);
                        }
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
                if (doi) {
                    const normalizedDoi = this.normalizeDoi(doi);
                    if (normalizedDoi && processedDOIs.has(normalizedDoi)) {
                        skippedCount++;
                        continue;
                    }
                }

                // Try to get or fetch arXiv metadata
                let arxivEntry = null;
                
                if (arxivId) {
                    try {
                        arxivEntry = await this.arxivFetcher.fetchMetadata(arxivId);
                    } catch (e) {
                        // Ignore errors
                    }
                }
                
                if (!arxivEntry && doi) {
                    try {
                        const foundArxivId = await this.arxivFetcher.searchByDOI(doi);
                        if (foundArxivId) {
                            arxivEntry = await this.arxivFetcher.fetchMetadata(foundArxivId);
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
                        const normalizedDoi = this.normalizeDoi(doi);
                        if (normalizedDoi) {
                            processedDOIs.add(normalizedDoi);
                        }
                    }
                    addedCount++;
                } else {
                    // Create entry from ORCID data if no arXiv found
                    const orcidOnlyEntry = {
                        id: doi ? `doi:${doi}` : `orcid:${researcherId}-${orcidEntry.title}`,
                        title: orcidEntry.title || '',
                        journal_ref: orcidEntry.journal ? orcidEntry.journal : null,
                        doi: doi || null,
                        published: DateUtils.formatOrcidDate(orcidEntry['publication-date']),
                        updated: DateUtils.formatOrcidDate(orcidEntry['publication-date']),
                        summary: '',
                        authors: '',
                        categories: [],
                        formats: { html: null, pdf: null },
                        // Store ORCID external-ids for later ISBN/ISSN detection
                        _orcid_external_ids: orcidEntry['external-ids'],
                        // Store contributors and citation if available (for entries without DOI/arXiv)
                        _orcid_contributors: orcidEntry.contributors || null,
                        _orcid_citation: orcidEntry.citation || null
                    };
                    
                    if (!merged[researcherId]) {
                        merged[researcherId] = {
                            name: data.name,
                            entries: []
                        };
                    }
                    merged[researcherId].entries.push(orcidOnlyEntry);
                    if (doi) {
                        const normalizedDoi = this.normalizeDoi(doi);
                        if (normalizedDoi) {
                            processedDOIs.add(normalizedDoi);
                        }
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
                let pubKey;
                if (entry.doi) {
                    const normalizedDoi = this.normalizeDoi(entry.doi);
                    pubKey = normalizedDoi || entry.doi.toLowerCase();
                } else if (entry.id && entry.id.startsWith('orcid:')) {
                    pubKey = title;
                } else {
                    pubKey = entry.id || title;
                }
                
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
                const doi = entry.doi ? this.normalizeDoi(entry.doi) : null;
                
                let isDuplicate = false;
                if (arxivId && seenIds.has(arxivId)) isDuplicate = true;
                if (doi && seenDOIs.has(doi)) isDuplicate = true;
                
                // Check for title-based duplicates (for ORCID entries with no arXiv ID)
                if (!isDuplicate && !arxivId) {
                    const titleKey = entry.title ? entry.title.toLowerCase().trim() : '';
                    const duplicateEntries = titleMap[titleKey];
                    
                    if (duplicateEntries && duplicateEntries.length > 1) {
                        const completeEntries = duplicateEntries.filter(d => 
                            d.entry.id && 
                            (d.entry.id.includes('arxiv.org') || d.entry.authors) &&
                            (d.entry.summary || d.entry.journal_ref)
                        );
                        
                        if (completeEntries.length > 0) {
                            const bestEntry = completeEntries[0].entry;
                            if (bestEntry === entry) {
                                isDuplicate = false;
                            } else {
                                isDuplicate = true;
                            }
                        } else {
                            const firstEntry = duplicateEntries[0].entry;
                            if (firstEntry !== entry) {
                                isDuplicate = true;
                            }
                        }
                    }
                }
                
                if (!isDuplicate) {
                    await this.enrichEntry(entry, researcherId, publicationAuthors);
                    
                    // Check again for DOI duplicates after enrichment (DOI may have been added during enrichment)
                    const enrichedDoi = entry.doi ? this.normalizeDoi(entry.doi) : null;
                    if (enrichedDoi && seenDOIs.has(enrichedDoi)) {
                        // Skip this entry - it's a duplicate that was discovered during enrichment
                        continue;
                    }
                    
                    allPublications.entries.push(entry);
                    if (arxivId) seenIds.add(arxivId);
                    if (enrichedDoi) seenDOIs.add(enrichedDoi);
                }
            }
        }

        // Save to data directory
        const outputPath = path.join(this.dataPath, 'publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(allPublications, null, 4));
        console.log(`  Saved ${allPublications.entries.length} publications to ${outputPath}`);

        return allPublications;
    }

    async enrichEntry(entry, researcherId, publicationAuthors) {
        /**
         * Enriches a single publication entry with missing metadata
         */
        
        // For ORCID entries with missing authors, add the researcher's name
        if (entry.id && entry.id.startsWith('orcid:') && (!entry.authors || entry.authors.trim() === '')) {
            const orcidIdMatch = entry.id.match(/^orcid:(\d+)-/);
            if (orcidIdMatch) {
                const researcherId = orcidIdMatch[1];
                if (this.basics[researcherId]) {
                    entry.authors = this.basics[researcherId].name;
                }
            }
        }
        
        // For ORCID entries with missing data, try to extract from contributors and citation
        if (entry.id && entry.id.startsWith('orcid:')) {
            const needsMetadata = !entry.authors || !entry.journal_ref || !entry.doi;
            
            if (needsMetadata) {
                // Extract from contributors
                if (entry._orcid_contributors && entry._orcid_contributors.length > 0) {
                    if (!entry.authors || entry.authors.trim() === '') {
                        entry.authors = entry._orcid_contributors.join(', ');
                    } else {
                        const allAuthors = [entry.authors, ...entry._orcid_contributors];
                        entry.authors = [...new Set(allAuthors)].join(', ');
                    }
                }
                
                // Extract from citation
                if (entry._orcid_citation) {
                    const citationData = CitationParser.parseCitationData(entry._orcid_citation);
                    
                    if (citationData.authors && (!entry.authors || entry.authors.trim() === '')) {
                        entry.authors = citationData.authors;
                    }
                    
                    if (citationData.journal_ref && !entry.journal_ref) {
                        entry.journal_ref = citationData.journal_ref;
                    }
                    
                    if (citationData.doi && !entry.doi) {
                        entry.doi = citationData.doi;
                    }
                }
            }
        }
        
        // Normalize author names
        if (entry.authors) {
            entry.authors = this.normalizeAuthorNames(entry.authors);
        }
        
        // Fetch missing authors and summary from CrossRef if needed
        if (entry.doi && ((!entry.authors || entry.authors.trim() === '') || (!entry.summary || entry.summary.trim() === ''))) {
            const crossrefData = await this.crossrefFetcher.fetchMetadata(entry.doi);
            if (crossrefData.authors && (!entry.authors || entry.authors.trim() === '')) {
                entry.authors = crossrefData.authors;
            }
            if (crossrefData.summary && (!entry.summary || entry.summary.trim() === '')) {
                entry.summary = crossrefData.summary;
            }
        }
        
        // For ORCID entries with missing data and no DOI (or DOI lookup failed), try searching by title + author
        if (entry.id && entry.id.startsWith('orcid:') && entry.title && entry.authors) {
            const needsEnrichment = !entry.doi || !entry.summary || !entry.arxiv_url || !entry.journal_ref;
            
            if (needsEnrichment) {
                // Try arXiv first
                try {
                    const arxivResult = await this.arxivFetcher.searchByTitleAndAuthor(entry.title, entry.authors);
                    if (arxivResult) {
                        if (!entry.doi && arxivResult.doi) entry.doi = arxivResult.doi;
                        if (!entry.summary && arxivResult.summary) entry.summary = arxivResult.summary;
                        if (!entry.authors || entry.authors.trim() === '') entry.authors = arxivResult.authors;
                        if (arxivResult.id) {
                            const arxivId = arxivResult.id.match(/arxiv\.org\/abs\/(.+)$/)?.[1];
                            if (arxivId) {
                                const arxivIdClean = arxivId.replace(/v\d+$/, '');
                                if (!entry.formats || !entry.formats.html) {
                                    entry.formats = {
                                        html: `http://arxiv.org/abs/${arxivIdClean}`,
                                        pdf: `http://arxiv.org/pdf/${arxivIdClean}`
                                    };
                                }
                            }
                        }
                        if (arxivResult.categories && (!entry.categories || entry.categories.length === 0)) {
                            entry.categories = arxivResult.categories;
                        }
                    }
                } catch (e) {
                    // Ignore arXiv search errors
                }
                
                // Try CrossRef if still missing data
                if (!entry.doi || !entry.summary || !entry.journal_ref) {
                    try {
                        const crossrefResult = await this.crossrefFetcher.searchByTitleAndAuthor(entry.title, entry.authors);
                        if (crossrefResult) {
                            if (!entry.doi && crossrefResult.doi) entry.doi = crossrefResult.doi;
                            if (!entry.summary && crossrefResult.summary) entry.summary = crossrefResult.summary;
                            if (!entry.authors || entry.authors.trim() === '') entry.authors = crossrefResult.authors;
                            if (!entry.journal_ref && crossrefResult.journal_ref) entry.journal_ref = crossrefResult.journal_ref;
                        }
                    } catch (e) {
                        // Ignore CrossRef search errors
                    }
                }
            }
        }
        
        // Add QUDYMA author IDs
        let pubKey;
        if (entry.doi) {
            pubKey = entry.doi.toLowerCase();
        } else if (entry.id && entry.id.startsWith('orcid:')) {
            pubKey = entry.title ? entry.title.toLowerCase().trim() : '';
        } else {
            pubKey = entry.id || (entry.title ? entry.title.toLowerCase().trim() : '');
        }
        
        const trackedIds = publicationAuthors[pubKey] ? Array.from(publicationAuthors[pubKey]) : [];
        const nameMatchedIds = this.findQudymaAuthorIdsByName(entry.authors);
        const allIds = new Set([...trackedIds, ...nameMatchedIds]);
        entry.author_ids = Array.from(allIds).sort();
        
        // Standardize journal ref, or infer from DOI if missing
        if (entry.journal_ref) {
            entry.journal_ref = this.standardizeJournalRef(entry.journal_ref);
        } else if (entry.doi) {
            const inferredRef = await this.crossrefFetcher.inferJournalRef(
                entry.doi, 
                entry._orcid_external_ids ? { 'external-ids': entry._orcid_external_ids } : null
            );
            if (inferredRef) {
                entry.journal_ref = inferredRef;
            }
        }
        
        // Add URLs
        entry.arxiv_url = UrlBuilder.buildArxivUrl(entry);
        
        // If no arXiv URL yet but we have a DOI, try to find the arXiv version
        if (!entry.arxiv_url && entry.doi) {
            try {
                const foundArxivId = await this.arxivFetcher.searchByDOI(entry.doi);
                if (foundArxivId) {
                    const arxivIdClean = foundArxivId.replace(/v\d+$/, '');
                    entry.arxiv_url = `https://arxiv.org/abs/${arxivIdClean}`;
                    if (!entry.formats || !entry.formats.html) {
                        entry.formats = {
                            html: `http://arxiv.org/abs/${arxivIdClean}`,
                            pdf: `http://arxiv.org/pdf/${arxivIdClean}`
                        };
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
        
        entry.journal_url = entry.doi ? UrlBuilder.buildJournalUrl(entry.doi) : null;
        
        // Remove internal metadata fields
        delete entry._orcid_external_ids;
        delete entry._orcid_contributors;
        delete entry._orcid_citation;
        
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
    }
}

module.exports = PublicationMerger;
