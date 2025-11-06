/**
 * Author name utilities
 */

class AuthorUtils {
    static buildNameVariantsMap(basics) {
        const map = {};
        for (const [id, researcher] of Object.entries(basics)) {
            const canonicalName = researcher.name;
            map[canonicalName] = canonicalName;
            
            if (researcher.name_variants) {
                for (const variant of researcher.name_variants) {
                    map[variant] = canonicalName;
                }
            }
        }
        return map;
    }

    static normalizeAuthorNames(authorsString, nameVariantsMap) {
        if (!authorsString) return authorsString;
        
        const authors = authorsString.split(',').map(author => author.trim());
        const normalizedAuthors = authors.map(author => {
            return nameVariantsMap[author] || author;
        });
        
        return normalizedAuthors.join(', ');
    }

    static findQudymaAuthorIdsByName(authorsString, nameVariantsMap, basics) {
        if (!authorsString) return [];
        
        const foundIds = new Set();
        const authors = authorsString.split(',').map(author => author.trim());
        
        for (const author of authors) {
            const canonicalName = nameVariantsMap[author];
            if (canonicalName) {
                for (const [id, researcher] of Object.entries(basics)) {
                    if (researcher.name === canonicalName) {
                        foundIds.add(id);
                        break;
                    }
                }
            }
        }
        
        return Array.from(foundIds).sort();
    }
}

module.exports = AuthorUtils;
