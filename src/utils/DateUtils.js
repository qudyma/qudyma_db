/**
 * Date utility functions
 */

class DateUtils {
    /**
     * Check if a publication date should be included based on researcher's category and dates
     * 
     * Rules:
     * - Non-visiting members with date_out=null: include ALL publications (no date filtering)
     * - Members with date_out: only publications up to date_out
     * - Visiting members: use date_in to date_out range
     */
    static shouldIncludePublication(dateStr, researcher, journalRef = null) {
        if (!dateStr) return false;
        
        const date = new Date(dateStr);
        const isVisiting = researcher?.status === 'visitor';
        
        // For non-visiting members with no date_out, include all publications
        if (!isVisiting && !researcher.date_out) {
            return true;
        }
        
        // For members with date_out or visiting members, apply date range filtering
        return this.isDateInRange(dateStr, researcher.date_in, researcher.date_out, journalRef);
    }

    /**
     * Check if a date is within a range, with special handling for 2024 cutoff
     */
    static isDateInRange(dateStr, dateInStr, dateOutStr, journalRef = null) {
        if (!dateStr || !dateInStr) return false;
        
        const date = new Date(dateStr);
        const dateIn = new Date(dateInStr);
        const dateOut = dateOutStr ? new Date(dateOutStr) : new Date();
        
        // Special handling for 2024 cutoff with journal_ref check
        if (dateInStr === '2024-01-01') {
            const targetDate = new Date('2024-01-01');
            if (date < targetDate) return false;
            
            // If we have a journal ref with a year, check that too
            if (journalRef) {
                const yearMatch = journalRef.match(/\((\d{4})\)$/);
                if (yearMatch) {
                    const journalYear = parseInt(yearMatch[1]);
                    if (journalYear < 2024) return false;
                }
            }
        }
        
        return date >= dateIn && date <= dateOut;
    }

    /**
     * Format ORCID date object to ISO string
     */
    static formatOrcidDate(dateObj) {
        if (!dateObj || !dateObj.year) return new Date().toISOString();
        
        const year = dateObj.year.value;
        const month = dateObj.month ? String(dateObj.month.value).padStart(2, '0') : '01';
        const day = dateObj.day ? String(dateObj.day.value).padStart(2, '0') : '01';
        
        return new Date(`${year}-${month}-${day}`).toISOString();
    }
}

module.exports = DateUtils;
