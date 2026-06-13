const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const markdownItTableOfContents = require('markdown-it-table-of-contents');

function createExportMarkdownIt() {
  const md = markdownIt({ html: true, breaks: true });
  md.use(markdownItAnchor);
  md.use(markdownItTableOfContents, {
    markerPattern: /^\[toc\]/im
  });
  return md;
}

module.exports = {
  createExportMarkdownIt
};
