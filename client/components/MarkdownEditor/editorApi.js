export function getEditorHtml(editor) {
  if (!editor) {
    return '';
  }
  if (typeof editor.getHTML === 'function') {
    return editor.getHTML();
  }
  return '';
}

export function getEditorMarkdown(editor) {
  return editor?.getMarkdown?.() || '';
}
