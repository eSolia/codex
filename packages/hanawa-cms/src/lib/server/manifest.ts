/**
 * Document Manifest Utilities
 * Parse, serialize, and manipulate manifest YAML for assembled documents.
 * InfoSec: Manifest data is validated before R2 storage (OWASP A03)
 */

import YAML from 'yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManifestSection {
  file: string;
  label: string;
  label_ja?: string;
  source: string | null;
  source_version?: string;
  locked: boolean;
}

export interface DocumentManifest {
  id: string;
  document_type: string;
  client_code: string;
  client_name: string;
  client_name_ja: string;
  title: string;
  title_ja: string;
  language_mode: string;
  status: string;
  contact_name: string;
  contact_name_ja: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  sections: ManifestSection[];
}

// ---------------------------------------------------------------------------
// Parse / Serialize
// ---------------------------------------------------------------------------

/** Parse manifest YAML string into a typed object */
export function parseManifest(yamlStr: string): DocumentManifest {
  const raw = YAML.parse(yamlStr) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    document_type: String(raw.document_type ?? 'proposal'),
    client_code: String(raw.client_code ?? ''),
    client_name: String(raw.client_name ?? ''),
    client_name_ja: String(raw.client_name_ja ?? ''),
    title: String(raw.title ?? ''),
    title_ja: String(raw.title_ja ?? ''),
    language_mode: String(raw.language_mode ?? 'en'),
    status: String(raw.status ?? 'draft'),
    contact_name: String(raw.contact_name ?? ''),
    contact_name_ja: String(raw.contact_name_ja ?? ''),
    created_by: String(raw.created_by ?? ''),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    sections: parseSections(raw.sections),
  };
}

function parseSections(raw: unknown): ManifestSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => ({
    file: String(s.file ?? ''),
    label: String(s.label ?? ''),
    label_ja: s.label_ja !== null && s.label_ja !== undefined ? String(s.label_ja) : undefined,
    source: s.source !== null && s.source !== undefined ? String(s.source) : null,
    source_version:
      s.source_version !== null && s.source_version !== undefined
        ? String(s.source_version)
        : undefined,
    locked: Boolean(s.locked),
  }));
}

/** Serialize a manifest object to YAML */
export function serializeManifest(manifest: DocumentManifest): string {
  // Build a clean object (avoid undefined values in YAML output)
  const doc: Record<string, unknown> = {
    id: manifest.id,
    document_type: manifest.document_type,
    client_code: manifest.client_code,
    client_name: manifest.client_name,
    client_name_ja: manifest.client_name_ja,
    title: manifest.title,
    title_ja: manifest.title_ja,
    language_mode: manifest.language_mode,
    status: manifest.status,
    contact_name: manifest.contact_name,
    contact_name_ja: manifest.contact_name_ja,
    created_by: manifest.created_by,
    created_at: manifest.created_at,
    updated_at: manifest.updated_at,
    sections: manifest.sections.map((s) => {
      const out: Record<string, unknown> = {
        file: s.file,
        label: s.label,
      };
      if (s.label_ja) out.label_ja = s.label_ja;
      out.source = s.source;
      if (s.source_version) out.source_version = s.source_version;
      out.locked = s.locked;
      return out;
    }),
  };

  return YAML.stringify(doc, { lineWidth: 120 });
}

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

/** Return the next zero-padded file prefix (e.g. "04") */
export function getNextFilePrefix(manifest: DocumentManifest): string {
  let max = 0;
  for (const s of manifest.sections) {
    const m = s.file.match(/^(\d+)-/);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return String(max + 1).padStart(2, '0');
}

/** Slugify a label for use as a file stem */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Append a section to the manifest. Returns a new manifest (immutable). */
export function addSection(
  manifest: DocumentManifest,
  section: Omit<ManifestSection, 'file'> & { file?: string }
): DocumentManifest {
  const prefix = getNextFilePrefix(manifest);
  const file = section.file ?? `${prefix}-${slugify(section.label)}`;
  return {
    ...manifest,
    updated_at: new Date().toISOString().slice(0, 10),
    sections: [...manifest.sections, { ...section, file }],
  };
}

/** Remove a section by index. Returns a new manifest. */
export function removeSection(manifest: DocumentManifest, index: number): DocumentManifest {
  if (index < 0 || index >= manifest.sections.length) return manifest;
  return {
    ...manifest,
    updated_at: new Date().toISOString().slice(0, 10),
    sections: manifest.sections.filter((_, i) => i !== index),
  };
}

/** Move a section from one index to another. Returns a new manifest. */
export function reorderSections(
  manifest: DocumentManifest,
  fromIndex: number,
  toIndex: number
): DocumentManifest {
  if (
    fromIndex < 0 ||
    fromIndex >= manifest.sections.length ||
    toIndex < 0 ||
    toIndex >= manifest.sections.length ||
    fromIndex === toIndex
  ) {
    return manifest;
  }

  const sections = [...manifest.sections];
  const [moved] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, moved!);

  return {
    ...manifest,
    updated_at: new Date().toISOString().slice(0, 10),
    sections,
  };
}
