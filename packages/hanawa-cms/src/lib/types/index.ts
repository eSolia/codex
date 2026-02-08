// Hanawa CMS Type Definitions

export interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string | null;
  default_language: string;
  languages: string[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContentType {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  description: string | null;
  schema: Record<string, unknown>;
  template: string | null;
  created_at: string;
  updated_at: string;
}

export interface Content {
  id: string;
  site_id: string;
  content_type_id: string;
  slug: string;
  path: string | null;
  title: string;
  title_translations: Record<string, string>;
  body: string | null;
  body_translations: Record<string, string>;
  frontmatter: Record<string, unknown>;
  excerpt: string | null;
  status: 'draft' | 'review' | 'published' | 'archived';
  language: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
}

export interface Fragment {
  id: string;
  site_id: string | null;
  name: string;
  slug: string;
  category: string | null;
  content_en: string | null;
  content_ja: string | null;
  description: string | null;
  tags: string[];
  version: string;
  status: 'active' | 'deprecated' | 'draft';
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  site_id: string | null;
  filename: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  alt_text: string | null;
  alt_text_ja: string | null;
  caption: string | null;
  folder: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  access_id: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Comment types (client-facing subset)
export interface CommentAuthor {
  id: string;
  email: string;
  name?: string;
}

export interface CommentData {
  id: string;
  content: string;
  contentHtml?: string;
  type: 'inline' | 'document' | 'suggestion';
  status: 'open' | 'resolved' | 'rejected';
  suggestionText?: string;
  author: CommentAuthor;
  createdAt: number;
  updatedAt: number;
  reactions?: Record<string, string[]>;
}

export interface CommentThread {
  id: string;
  rootComment: CommentData;
  replies: CommentData[];
  status: 'open' | 'resolved' | 'rejected';
  participantCount: number;
  lastActivity: number;
}

export interface CommentCounts {
  total: number;
  open: number;
  resolved: number;
}

// Editor-specific types
export type CalloutType = 'info' | 'warning' | 'danger' | 'success';
export type StatusType =
  | 'compliant'
  | 'non-compliant'
  | 'in-progress'
  | 'pending-review'
  | 'not-applicable';

export interface FragmentReference {
  id: string;
  lang?: 'en' | 'ja';
  filter?: string;
}
