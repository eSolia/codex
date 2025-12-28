// Hanawa Editor - Main Exports
// Named after Hanawa Hokiichi (塙保己一, 1746–1821)

export { createEditor, togglePrivacyMode, type EditorConfig } from './editor';
export { markdownToHTML, htmlToMarkdown, exportToMarkdown, importFromMarkdown, type ExportOptions } from './markdown';
export { defaultCommands, type SlashCommand } from './extensions/slash-command';

// Custom extensions
export { CalloutExtension, type CalloutType, type CalloutAttributes } from './extensions/callout';
export { StatusBadgeExtension, type StatusType, type StatusBadgeAttributes } from './extensions/status-badge';
export { EvidenceLinkExtension, type EvidenceLinkAttributes } from './extensions/evidence-link';
export { PrivacyMaskExtension, type MaskType, type PrivacyMaskAttributes } from './extensions/privacy-mask';
export { TableOfContentsExtension, type TocItem } from './extensions/table-of-contents';
export { SlashCommandExtension } from './extensions/slash-command';
