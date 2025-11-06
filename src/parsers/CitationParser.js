/**
 * Citation parser for BibTeX and RIS formats
 */

class CitationParser {
    /**
     * Parses citation data (BibTeX, RIS, etc.) to extract metadata
     * Returns { authors: string, journal_ref: string, doi: string }
     */
    static parseCitationData(citation) {
        if (!citation || !citation.value) return { authors: null, journal_ref: null, doi: null };
        
        const result = { authors: null, journal_ref: null, doi: null };
        const citationText = citation.value;
        const citationType = citation.type ? citation.type.toLowerCase() : '';
        
        if (citationType === 'bibtex') {
            return this.parseBibTeX(citationText);
        } else if (citationType === 'ris') {
            return this.parseRIS(citationText);
        } else {
            return this.parseGeneric(citationText);
        }
    }

    static parseBibTeX(citationText) {
        const result = { authors: null, journal_ref: null, doi: null };
        
        // Extract authors
        const authorMatch = citationText.match(/author\s*=\s*\{([^}]+)\}/is);
        if (authorMatch) {
            // BibTeX uses "and" as separator
            const authors = authorMatch[1].split(' and ').map(a => a.trim()).filter(a => a);
            result.authors = authors.join(', ');
        }
        
        // Extract journal or booktitle (for conferences)
        // Handle both {...} and "..." formats, including nested content
        let journalMatch = citationText.match(/journal\s*=\s*\{([^}]+)\}/is);
        if (!journalMatch) {
            journalMatch = citationText.match(/journal\s*=\s*"([^"]+)"/is);
        }
        if (!journalMatch) {
            journalMatch = citationText.match(/booktitle\s*=\s*\{([^}]+)\}/is);
        }
        if (!journalMatch) {
            journalMatch = citationText.match(/booktitle\s*=\s*"([^"]+)"/is);
        }
        
        const volumeMatch = citationText.match(/volume\s*=\s*[{"{}]([^"{}]+)[}"{}]/is);
        const numberMatch = citationText.match(/number\s*=\s*[{"{}]([^"{}]+)[}"{}]/is);
        const pagesMatch = citationText.match(/pages\s*=\s*[{"{}]([^"{}]+)[}"{}]/is);
        const yearMatch = citationText.match(/year\s*=\s*[{"{}]([^"{}]+)[}"{}]/is);
        
        if (journalMatch) {
            let ref = journalMatch[1].trim();
            if (volumeMatch) {
                ref += ` ${volumeMatch[1].trim()}`;
                if (numberMatch) {
                    ref += `(${numberMatch[1].trim()})`;
                }
            }
            if (pagesMatch) {
                ref += `, ${pagesMatch[1].trim()}`;
            }
            if (yearMatch) {
                ref += ` (${yearMatch[1].trim()})`;
            }
            result.journal_ref = ref;
        } else if (yearMatch) {
            // If no journal/booktitle but we have a year, at least include the year
            result.journal_ref = `(${yearMatch[1].trim()})`;
        }
        
        // Extract DOI
        const doiMatch = citationText.match(/doi\s*=\s*[{"{}]([^"{}]+)[}"{}]/is);
        if (doiMatch) {
            result.doi = `https://doi.org/${doiMatch[1].trim()}`;
        }
        
        return result;
    }

    static parseRIS(citationText) {
        const result = { authors: null, journal_ref: null, doi: null };
        const lines = citationText.split('\n');
        const authors = [];
        let journal = null;
        let volume = null;
        let issue = null;
        let pages = null;
        let year = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('AU  - ') || trimmed.startsWith('A1  - ')) {
                authors.push(trimmed.substring(6).trim());
            } else if (trimmed.startsWith('JO  - ') || trimmed.startsWith('T2  - ')) {
                journal = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('VL  - ')) {
                volume = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('IS  - ')) {
                issue = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('SP  - ')) {
                const startPage = trimmed.substring(6).trim();
                pages = startPage;
            } else if (trimmed.startsWith('EP  - ') && pages) {
                pages += `-${trimmed.substring(6).trim()}`;
            } else if (trimmed.startsWith('PY  - ') || trimmed.startsWith('Y1  - ')) {
                year = trimmed.substring(6).trim().substring(0, 4); // Take just the year
            } else if (trimmed.startsWith('DO  - ')) {
                result.doi = `https://doi.org/${trimmed.substring(6).trim()}`;
            }
        }
        
        if (authors.length > 0) {
            result.authors = authors.join(', ');
        }
        
        if (journal) {
            let ref = journal;
            if (volume) {
                ref += ` ${volume}`;
                if (issue) {
                    ref += `(${issue})`;
                }
            }
            if (pages) {
                ref += `, ${pages}`;
            }
            if (year) {
                ref += ` (${year})`;
            }
            result.journal_ref = ref;
        }
        
        return result;
    }

    static parseGeneric(citationText) {
        const result = { authors: null, journal_ref: null, doi: null };
        
        // Try generic parsing for other formats
        // Look for common patterns in the text
        const doiMatch = citationText.match(/(?:doi|DOI)[:.\s]*([0-9.]+\/[^\s,]+)/);
        if (doiMatch) {
            result.doi = `https://doi.org/${doiMatch[1].trim()}`;
        }
        
        return result;
    }
}

module.exports = CitationParser;
