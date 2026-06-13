import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';

export { getEditorHtml, getEditorMarkdown } from './editorApi.js';

export function createMarkdownEditor({ el, initialValue, height = '500px' }) {
  if (!el) {
    throw new Error('Markdown editor mount element is required');
  }
  return new Editor({
    el,
    height,
    initialEditType: 'wysiwyg',
    initialValue: initialValue || '',
    usageStatistics: false
  });
}

export function destroyMarkdownEditor(editor) {
  editor?.destroy?.();
}
