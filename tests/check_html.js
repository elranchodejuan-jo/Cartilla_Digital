const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Basic balance check of divs/sections etc
const tagsToCheck = ['div', 'section', 'form', 'select', 'table', 'tbody', 'tr', 'td', 'thead'];

tagsToCheck.forEach(tag => {
    const openingMatches = html.match(new RegExp(`<${tag}\\b`, 'g')) || [];
    const closingMatches = html.match(new RegExp(`</${tag}>`, 'g')) || [];
    if (openingMatches.length !== closingMatches.length) {
        console.warn(`Tag <${tag}> mismatch: ${openingMatches.length} opening, ${closingMatches.length} closing.`);
    } else {
        console.log(`Tag <${tag}> matches perfectly: ${openingMatches.length}`);
    }
});
