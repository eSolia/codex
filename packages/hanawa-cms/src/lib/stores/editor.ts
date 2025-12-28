// Editor state store
import { writable, derived } from "svelte/store";
import type { Content, Fragment } from "$lib/types";

// Current content being edited
export const currentContent = writable<Content | null>(null);

// Editor dirty state (unsaved changes)
export const isDirty = writable(false);

// Available fragments for insertion
export const availableFragments = writable<Fragment[]>([]);

// Editor mode
export const editorMode = writable<"edit" | "preview" | "split">("edit");

// Current language for editing
export const editLanguage = writable<"en" | "ja">("ja");

// Auto-save status
export const autoSaveStatus = writable<"idle" | "saving" | "saved" | "error">(
  "idle"
);

// Derived: content title based on current language
export const currentTitle = derived(
  [currentContent, editLanguage],
  ([$content, $lang]) => {
    if (!$content) return "";
    return $content.title_translations[$lang] || $content.title;
  }
);

// Derived: content body based on current language
export const currentBody = derived(
  [currentContent, editLanguage],
  ([$content, $lang]) => {
    if (!$content) return "";
    return $content.body_translations[$lang] || $content.body || "";
  }
);

// Reset editor state
export function resetEditor() {
  currentContent.set(null);
  isDirty.set(false);
  autoSaveStatus.set("idle");
}

// Mark content as modified
export function markDirty() {
  isDirty.set(true);
  autoSaveStatus.set("idle");
}

// Mark content as saved
export function markSaved() {
  isDirty.set(false);
  autoSaveStatus.set("saved");
  // Reset to idle after 2 seconds
  setTimeout(() => {
    autoSaveStatus.update((status) => (status === "saved" ? "idle" : status));
  }, 2000);
}
