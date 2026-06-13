import { describe, it, expect } from 'vitest';
import {
  getEditorHtml,
  getEditorMarkdown
} from '../../client/components/MarkdownEditor/editorApi.js';

describe('MarkdownEditor helpers', () => {
  it('reads html from getHTML (toast-ui v3)', () => {
    const editor = {
      getHTML: () => '<p>hello</p>'
    };

    expect(getEditorHtml(editor)).toBe('<p>hello</p>');
  });

  it('falls back to getHtml (legacy tui-editor)', () => {
    const editor = {
      getHtml: () => '<p>legacy</p>'
    };

    expect(getEditorHtml(editor)).toBe('<p>legacy</p>');
  });

  it('reads markdown from editor instance', () => {
    const editor = {
      getMarkdown: () => '# title'
    };

    expect(getEditorMarkdown(editor)).toBe('# title');
  });
});
