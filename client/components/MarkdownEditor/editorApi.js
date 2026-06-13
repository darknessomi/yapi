export function getEditorHtml(editor) {
  if (!editor) {
    return '';
  }
  if (typeof editor.getHTML === 'function') {
    return editor.getHTML();
  }
  if (typeof editor.getHtml === 'function') {
    return editor.getHtml();
  }
  return '';
}

export function getEditorMarkdown(editor) {
  return editor?.getMarkdown?.() || '';
}
