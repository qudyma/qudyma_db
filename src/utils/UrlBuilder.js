/**
 * URL builder utilities
 */

class UrlBuilder {
    static buildArxivUrl(entry) {
        const arxivIdMatch = entry.id ? entry.id.match(/arxiv\.org\/abs\/([\d.]+v?\d*)/) : null;
        if (arxivIdMatch) {
            const arxivId = arxivIdMatch[1].replace(/v\d+$/, '');
            return `https://arxiv.org/abs/${arxivId}`;
        }
        return null;
    }

    static buildJournalUrl(doi) {
        if (!doi) return null;
        if (doi.startsWith('http')) return doi;
        return `https://doi.org/${doi}`;
    }
}

module.exports = UrlBuilder;
