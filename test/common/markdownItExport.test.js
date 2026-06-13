import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createExportMarkdownIt } = require('../../common/markdownItExport.js');

describe('createExportMarkdownIt', () => {
  it('renders headings with anchor ids', () => {
    const md = createExportMarkdownIt();
    const html = md.render('# Hello World');

    expect(html).toMatch(/id="hello-world"/);
    expect(html).toContain('<h1');
  });

  it('renders table of contents for [TOC] marker', () => {
    const md = createExportMarkdownIt();
    const html = md.render('# Category\n\n[TOC]\n\n## Sub heading');

    expect(html).toContain('class="table-of-contents"');
    expect(html).toMatch(/href="#sub-heading"/);
  });
});
