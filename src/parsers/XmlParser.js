/**
 * XML Parser for arXiv API responses
 */

class XmlParser {
    static extractXMLField(xml, tag) {
        const match = xml.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
        return match ? match[1] : '';
    }

    static extractAuthors(xml) {
        const authors = [];
        const regex = /<name>([^<]+)<\/name>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            authors.push(match[1]);
        }
        return authors.join(', ');
    }

    static extractCategories(xml) {
        const categories = [];
        const regex = /<category[^>]+term="([^"]+)"[^>]*\/>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            categories.push(match[1]);
        }
        return categories;
    }

    static extractDOI(xml) {
        const match = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
        return match ? match[1] : null;
    }
}

module.exports = XmlParser;
