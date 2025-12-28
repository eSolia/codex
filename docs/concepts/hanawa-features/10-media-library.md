# Hanawa: Media Library Specification

Comprehensive asset management with Cloudflare Images optimization.

## Overview

A proper media library isn't just file storage—it's the backbone of content creation. Authors need to find assets quickly, editors need consistent image quality, and the site needs optimized delivery.

```
┌─────────────────────────────────────────────────────────────────┐
│  MEDIA LIBRARY ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Upload                 Storage              Delivery           │
│  ──────                 ───────              ────────           │
│  ┌─────────┐           ┌─────────┐          ┌─────────┐        │
│  │ Drag &  │──upload──▶│   R2    │──transform─▶│CF Images│       │
│  │ Drop    │           │ Bucket  │          │  CDN    │        │
│  └─────────┘           └─────────┘          └─────────┘        │
│       │                     │                    │              │
│       │                     ▼                    │              │
│       │               ┌─────────┐                │              │
│       │               │   D1    │                │              │
│       │               │Metadata │                │              │
│       │               └─────────┘                │              │
│       │                     │                    │              │
│       ▼                     ▼                    ▼              │
│  • Extract EXIF        • Tags, folders      • Resize on-fly    │
│  • Generate thumb      • Focal point        • WebP/AVIF        │
│  • Detect duplicates   • Alt text           • Blur placeholder │
│  • Scan for PII        • Usage tracking     • Responsive       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Schema

```sql
-- Media assets table
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  
  -- File info
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Storage
  r2_key TEXT NOT NULL UNIQUE,
  r2_bucket TEXT DEFAULT 'media',
  
  -- Cloudflare Images (if enabled)
  cf_image_id TEXT,
  cf_image_hash TEXT,
  
  -- Dimensions (for images/video)
  width INTEGER,
  height INTEGER,
  duration REAL,                    -- For video/audio in seconds
  
  -- Focal point (0-1 coordinates)
  focal_x REAL DEFAULT 0.5,
  focal_y REAL DEFAULT 0.5,
  
  -- Metadata
  title TEXT,
  alt_text TEXT,
  caption TEXT,
  description TEXT,
  
  -- Organization
  folder_id TEXT,
  tags TEXT,                        -- JSON array
  
  -- EXIF data (for photos)
  exif_data TEXT,                   -- JSON
  
  -- Thumbnails
  thumbnail_url TEXT,
  blur_hash TEXT,                   -- BlurHash for placeholders
  
  -- Duplicate detection
  content_hash TEXT,                -- SHA-256 of file content
  perceptual_hash TEXT,             -- pHash for image similarity
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at INTEGER,
  
  -- Audit
  uploaded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  
  FOREIGN KEY (folder_id) REFERENCES media_folders(id)
);

CREATE INDEX idx_media_folder ON media_assets(folder_id, deleted_at);
CREATE INDEX idx_media_type ON media_assets(mime_type);
CREATE INDEX idx_media_hash ON media_assets(content_hash);
CREATE INDEX idx_media_tags ON media_assets(tags);

-- Folders for organization
CREATE TABLE media_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  path TEXT NOT NULL,               -- e.g., "/marketing/2024/q1"
  color TEXT,                       -- For visual distinction
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (parent_id) REFERENCES media_folders(id)
);

CREATE INDEX idx_folders_parent ON media_folders(parent_id);
CREATE INDEX idx_folders_path ON media_folders(path);

-- Track where assets are used
CREATE TABLE media_usage (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  field_path TEXT,                  -- e.g., "content.hero_image"
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(asset_id, document_id, field_path)
);

CREATE INDEX idx_usage_asset ON media_usage(asset_id);
CREATE INDEX idx_usage_document ON media_usage(document_id);
```

### TypeScript Types

```typescript
interface MediaAsset {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  
  // Storage
  r2Key: string;
  cfImageId?: string;
  
  // Dimensions
  width?: number;
  height?: number;
  duration?: number;
  
  // Focal point
  focalPoint: { x: number; y: number };
  
  // Metadata
  title?: string;
  altText?: string;
  caption?: string;
  description?: string;
  
  // Organization
  folderId?: string;
  tags: string[];
  
  // Display
  thumbnailUrl: string;
  blurHash?: string;
  
  // Audit
  uploadedBy: string;
  createdAt: number;
  updatedAt: number;
  
  // Computed
  url: string;
  variants: Record<string, string>;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  color?: string;
  assetCount?: number;
}

interface ImageVariant {
  name: string;
  width?: number;
  height?: number;
  fit: 'contain' | 'cover' | 'crop' | 'scale-down';
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
}
```

---

## API Design

### Media Service

```typescript
// lib/server/media.ts

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function createMediaService(
  db: D1Database,
  r2: R2Bucket,
  cfImages: CloudflareImages | null,
  ai: Ai
) {
  return {
    /**
     * Upload a new asset
     */
    async upload(
      file: File,
      options: {
        folderId?: string;
        title?: string;
        altText?: string;
        tags?: string[];
      },
      context: AuditContext
    ): Promise<MediaAsset> {
      // Validate
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`File type ${file.type} not allowed`);
      }
      
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      }
      
      const id = crypto.randomUUID();
      const now = Date.now();
      
      // Generate content hash for dedup
      const arrayBuffer = await file.arrayBuffer();
      const contentHash = await this.hashContent(arrayBuffer);
      
      // Check for duplicates
      const existing = await db.prepare(`
        SELECT id, filename FROM media_assets WHERE content_hash = ? AND deleted_at IS NULL
      `).bind(contentHash).first();
      
      if (existing) {
        throw new Error(`Duplicate file: "${existing.filename}" already exists`);
      }
      
      // Generate filename
      const ext = file.name.split('.').pop() || '';
      const filename = `${id}.${ext}`;
      const r2Key = options.folderId 
        ? `${options.folderId}/${filename}`
        : `uploads/${filename}`;
      
      // Upload to R2
      await r2.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalFilename: file.name,
          uploadedBy: context.actorEmail,
        },
      });
      
      // Process image-specific data
      let width, height, thumbnailUrl, blurHash, cfImageId, exifData;
      
      if (file.type.startsWith('image/')) {
        const imageData = await this.processImage(arrayBuffer, file.type);
        width = imageData.width;
        height = imageData.height;
        thumbnailUrl = imageData.thumbnailUrl;
        blurHash = imageData.blurHash;
        exifData = imageData.exif;
        
        // Upload to CF Images if available
        if (cfImages) {
          const cfResult = await cfImages.upload(arrayBuffer, {
            metadata: { assetId: id },
          });
          cfImageId = cfResult.id;
        }
      }
      
      // Insert record
      await db.prepare(`
        INSERT INTO media_assets (
          id, filename, original_filename, mime_type, file_size,
          r2_key, cf_image_id, width, height,
          focal_x, focal_y, title, alt_text, folder_id, tags,
          exif_data, thumbnail_url, blur_hash, content_hash,
          uploaded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.5, 0.5, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, filename, file.name, file.type, file.size,
        r2Key, cfImageId || null, width || null, height || null,
        options.title || null, options.altText || null,
        options.folderId || null, JSON.stringify(options.tags || []),
        exifData ? JSON.stringify(exifData) : null,
        thumbnailUrl || null, blurHash || null, contentHash,
        context.actorEmail, now, now
      ).run();
      
      return this.get(id) as Promise<MediaAsset>;
    },
    
    /**
     * Process uploaded image
     */
    async processImage(
      buffer: ArrayBuffer,
      mimeType: string
    ): Promise<{
      width: number;
      height: number;
      thumbnailUrl?: string;
      blurHash?: string;
      exif?: object;
    }> {
      // Use Workers AI for image processing
      const imageInfo = await ai.run('@cf/llava-hf/llava-1.5-7b-hf', {
        image: [...new Uint8Array(buffer)],
        prompt: 'Describe this image briefly',
      });
      
      // For dimensions, we'd use a proper image library
      // This is simplified - real implementation would use sharp or similar
      
      return {
        width: 0, // Would extract from image
        height: 0,
        // thumbnailUrl would be generated
        // blurHash would be computed
      };
    },
    
    /**
     * Get asset by ID
     */
    async get(id: string): Promise<MediaAsset | null> {
      const row = await db.prepare(`
        SELECT * FROM media_assets WHERE id = ? AND deleted_at IS NULL
      `).bind(id).first();
      
      if (!row) return null;
      
      return this.rowToAsset(row);
    },
    
    /**
     * List assets with filtering
     */
    async list(options: {
      folderId?: string | null;
      type?: 'image' | 'video' | 'audio' | 'document';
      search?: string;
      tags?: string[];
      page?: number;
      perPage?: number;
      sortBy?: 'created' | 'name' | 'size';
      sortOrder?: 'asc' | 'desc';
    } = {}): Promise<{ assets: MediaAsset[]; total: number }> {
      const {
        folderId,
        type,
        search,
        tags,
        page = 1,
        perPage = 50,
        sortBy = 'created',
        sortOrder = 'desc',
      } = options;
      
      let where = 'deleted_at IS NULL';
      const params: any[] = [];
      
      if (folderId !== undefined) {
        if (folderId === null) {
          where += ' AND folder_id IS NULL';
        } else {
          where += ' AND folder_id = ?';
          params.push(folderId);
        }
      }
      
      if (type) {
        const typeMap = {
          image: 'image/%',
          video: 'video/%',
          audio: 'audio/%',
          document: 'application/%',
        };
        where += ' AND mime_type LIKE ?';
        params.push(typeMap[type]);
      }
      
      if (search) {
        where += ' AND (filename LIKE ? OR title LIKE ? OR alt_text LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }
      
      if (tags && tags.length > 0) {
        // JSON array contains check
        for (const tag of tags) {
          where += ` AND tags LIKE ?`;
          params.push(`%"${tag}"%`);
        }
      }
      
      const sortColumn = {
        created: 'created_at',
        name: 'filename',
        size: 'file_size',
      }[sortBy];
      
      // Get total
      const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM media_assets WHERE ${where}
      `).bind(...params).first();
      
      const total = countResult?.count as number || 0;
      
      // Get page
      const offset = (page - 1) * perPage;
      const { results } = await db.prepare(`
        SELECT * FROM media_assets
        WHERE ${where}
        ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `).bind(...params, perPage, offset).all();
      
      return {
        assets: results.map(this.rowToAsset),
        total,
      };
    },
    
    /**
     * Update asset metadata
     */
    async update(
      id: string,
      data: {
        title?: string;
        altText?: string;
        caption?: string;
        description?: string;
        folderId?: string | null;
        tags?: string[];
        focalPoint?: { x: number; y: number };
      },
      context: AuditContext
    ): Promise<MediaAsset> {
      const updates: string[] = ['updated_at = ?'];
      const params: any[] = [Date.now()];
      
      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }
      
      if (data.altText !== undefined) {
        updates.push('alt_text = ?');
        params.push(data.altText);
      }
      
      if (data.caption !== undefined) {
        updates.push('caption = ?');
        params.push(data.caption);
      }
      
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }
      
      if (data.folderId !== undefined) {
        updates.push('folder_id = ?');
        params.push(data.folderId);
      }
      
      if (data.tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(data.tags));
      }
      
      if (data.focalPoint) {
        updates.push('focal_x = ?, focal_y = ?');
        params.push(data.focalPoint.x, data.focalPoint.y);
      }
      
      params.push(id);
      
      await db.prepare(`
        UPDATE media_assets SET ${updates.join(', ')} WHERE id = ?
      `).bind(...params).run();
      
      return this.get(id) as Promise<MediaAsset>;
    },
    
    /**
     * Set focal point for image
     */
    async setFocalPoint(
      id: string,
      x: number,
      y: number,
      context: AuditContext
    ): Promise<void> {
      // Validate coordinates
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error('Focal point coordinates must be between 0 and 1');
      }
      
      await db.prepare(`
        UPDATE media_assets SET focal_x = ?, focal_y = ?, updated_at = ? WHERE id = ?
      `).bind(x, y, Date.now(), id).run();
    },
    
    /**
     * Get image URL with transformations
     */
    getImageUrl(
      asset: MediaAsset,
      variant?: ImageVariant
    ): string {
      // If using CF Images
      if (asset.cfImageId) {
        const baseUrl = `https://imagedelivery.net/${CF_ACCOUNT_HASH}/${asset.cfImageId}`;
        
        if (!variant) {
          return `${baseUrl}/public`;
        }
        
        // Build variant string
        const params: string[] = [];
        if (variant.width) params.push(`w=${variant.width}`);
        if (variant.height) params.push(`h=${variant.height}`);
        if (variant.fit) params.push(`fit=${variant.fit}`);
        if (variant.quality) params.push(`q=${variant.quality}`);
        if (variant.format) params.push(`f=${variant.format}`);
        
        // Add focal point for crop
        if (variant.fit === 'crop') {
          params.push(`gravity=${asset.focalPoint.x}x${asset.focalPoint.y}`);
        }
        
        return `${baseUrl}/${params.join(',')}`;
      }
      
      // Fallback to R2 with image resizing
      const baseUrl = `https://media.example.com/${asset.r2Key}`;
      
      if (!variant) {
        return baseUrl;
      }
      
      // Use Cloudflare Image Resizing
      const params = new URLSearchParams();
      if (variant.width) params.set('width', String(variant.width));
      if (variant.height) params.set('height', String(variant.height));
      if (variant.fit) params.set('fit', variant.fit);
      if (variant.quality) params.set('quality', String(variant.quality));
      if (variant.format) params.set('format', variant.format);
      
      return `${baseUrl}?${params.toString()}`;
    },
    
    /**
     * Generate responsive image srcset
     */
    getSrcSet(
      asset: MediaAsset,
      widths: number[] = [320, 640, 960, 1280, 1920]
    ): string {
      return widths
        .filter(w => !asset.width || w <= asset.width)
        .map(w => {
          const url = this.getImageUrl(asset, { 
            width: w, 
            fit: 'scale-down',
            format: 'auto',
          });
          return `${url} ${w}w`;
        })
        .join(', ');
    },
    
    /**
     * Delete asset (soft delete)
     */
    async delete(id: string, context: AuditContext): Promise<void> {
      // Check usage
      const usage = await db.prepare(`
        SELECT COUNT(*) as count FROM media_usage WHERE asset_id = ?
      `).bind(id).first();
      
      if (usage && (usage.count as number) > 0) {
        throw new Error(`Asset is used in ${usage.count} document(s)`);
      }
      
      await db.prepare(`
        UPDATE media_assets SET deleted_at = ? WHERE id = ?
      `).bind(Date.now(), id).run();
    },
    
    /**
     * Find similar images (for dedup)
     */
    async findSimilar(id: string): Promise<MediaAsset[]> {
      const asset = await this.get(id);
      if (!asset || !asset.perceptualHash) return [];
      
      // In real implementation, would use hamming distance on perceptual hash
      const { results } = await db.prepare(`
        SELECT * FROM media_assets
        WHERE id != ? AND perceptual_hash IS NOT NULL AND deleted_at IS NULL
        LIMIT 20
      `).bind(id).all();
      
      // Filter by similarity threshold
      return results
        .map(this.rowToAsset)
        .filter(a => this.hammingDistance(asset.perceptualHash!, a.perceptualHash!) < 10);
    },
    
    /**
     * Get asset usage across documents
     */
    async getUsage(id: string): Promise<{
      documentId: string;
      documentTitle: string;
      fieldPath: string;
    }[]> {
      const { results } = await db.prepare(`
        SELECT u.document_id, u.field_path, d.title
        FROM media_usage u
        JOIN documents d ON u.document_id = d.id
        WHERE u.asset_id = ?
      `).bind(id).all();
      
      return results.map(r => ({
        documentId: r.document_id as string,
        documentTitle: r.title as string,
        fieldPath: r.field_path as string,
      }));
    },
    
    /**
     * Create folder
     */
    async createFolder(
      name: string,
      parentId?: string
    ): Promise<MediaFolder> {
      const id = crypto.randomUUID();
      
      let path = `/${name}`;
      if (parentId) {
        const parent = await db.prepare(`
          SELECT path FROM media_folders WHERE id = ?
        `).bind(parentId).first();
        
        if (parent) {
          path = `${parent.path}/${name}`;
        }
      }
      
      await db.prepare(`
        INSERT INTO media_folders (id, name, parent_id, path, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, name, parentId || null, path, Date.now()).run();
      
      return { id, name, parentId, path };
    },
    
    /**
     * Generate AI alt text
     */
    async generateAltText(id: string): Promise<string> {
      const asset = await this.get(id);
      if (!asset) throw new Error('Asset not found');
      
      // Get image from R2
      const object = await r2.get(asset.r2Key);
      if (!object) throw new Error('File not found in storage');
      
      const buffer = await object.arrayBuffer();
      
      // Use Workers AI to describe image
      const result = await ai.run('@cf/llava-hf/llava-1.5-7b-hf', {
        image: [...new Uint8Array(buffer)],
        prompt: 'Describe this image in one sentence for use as alt text. Be concise and descriptive.',
      });
      
      return result.description || '';
    },
    
    // Helpers
    
    async hashContent(buffer: ArrayBuffer): Promise<string> {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },
    
    hammingDistance(hash1: string, hash2: string): number {
      let distance = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
      }
      return distance;
    },
    
    rowToAsset(row: Record<string, unknown>): MediaAsset {
      return {
        id: row.id as string,
        filename: row.filename as string,
        originalFilename: row.original_filename as string,
        mimeType: row.mime_type as string,
        fileSize: row.file_size as number,
        r2Key: row.r2_key as string,
        cfImageId: row.cf_image_id as string | undefined,
        width: row.width as number | undefined,
        height: row.height as number | undefined,
        duration: row.duration as number | undefined,
        focalPoint: {
          x: row.focal_x as number,
          y: row.focal_y as number,
        },
        title: row.title as string | undefined,
        altText: row.alt_text as string | undefined,
        caption: row.caption as string | undefined,
        description: row.description as string | undefined,
        folderId: row.folder_id as string | undefined,
        tags: JSON.parse(row.tags as string || '[]'),
        thumbnailUrl: row.thumbnail_url as string,
        blurHash: row.blur_hash as string | undefined,
        uploadedBy: row.uploaded_by as string,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        url: '', // Computed
        variants: {},
      };
    },
  };
}
```

---

## UI Components

### Media Browser

Full-featured asset browser with grid/list views:

```svelte
<!-- lib/components/media/MediaBrowser.svelte -->
<script lang="ts">
  import { 
    Grid, List, Upload, FolderPlus, Search, 
    Filter, ChevronRight, Image, File, Video 
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import MediaGrid from './MediaGrid.svelte';
  import MediaUploader from './MediaUploader.svelte';
  import FolderTree from './FolderTree.svelte';
  
  interface Props {
    mode?: 'browse' | 'select';
    allowMultiple?: boolean;
    acceptTypes?: string[];
    onSelect?: (assets: MediaAsset[]) => void;
  }
  
  let { mode = 'browse', allowMultiple = false, acceptTypes, onSelect }: Props = $props();
  
  let view = $state<'grid' | 'list'>('grid');
  let searchQuery = $state('');
  let currentFolder = $state<string | null>(null);
  let selectedAssets = $state<Set<string>>(new Set());
  let showUploader = $state(false);
  let typeFilter = $state<'all' | 'image' | 'video' | 'document'>('all');
  
  let assets = $state<MediaAsset[]>([]);
  let folders = $state<MediaFolder[]>([]);
  let loading = $state(true);
  let breadcrumbs = $state<{ id: string | null; name: string }[]>([
    { id: null, name: 'All Files' }
  ]);
  
  async function loadAssets() {
    loading = true;
    const params = new URLSearchParams();
    if (currentFolder) params.set('folderId', currentFolder);
    if (searchQuery) params.set('search', searchQuery);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    
    const response = await fetch(`/api/media?${params}`);
    const data = await response.json();
    assets = data.assets;
    loading = false;
  }
  
  function navigateToFolder(folderId: string | null, folderName?: string) {
    currentFolder = folderId;
    
    if (folderId === null) {
      breadcrumbs = [{ id: null, name: 'All Files' }];
    } else {
      const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
      if (existingIndex >= 0) {
        breadcrumbs = breadcrumbs.slice(0, existingIndex + 1);
      } else {
        breadcrumbs = [...breadcrumbs, { id: folderId, name: folderName! }];
      }
    }
    
    loadAssets();
  }
  
  function toggleSelect(assetId: string) {
    if (selectedAssets.has(assetId)) {
      selectedAssets.delete(assetId);
    } else {
      if (!allowMultiple) {
        selectedAssets.clear();
      }
      selectedAssets.add(assetId);
    }
    selectedAssets = new Set(selectedAssets);
  }
  
  function confirmSelection() {
    const selected = assets.filter(a => selectedAssets.has(a.id));
    onSelect?.(selected);
  }
  
  $effect(() => {
    loadAssets();
  });
</script>

<div class="media-browser">
  <aside class="sidebar">
    <Button onclick={() => showUploader = true} class="upload-btn">
      <Upload class="w-4 h-4" />
      Upload Files
    </Button>
    
    <FolderTree
      {folders}
      currentFolder={currentFolder}
      onNavigate={navigateToFolder}
    />
  </aside>
  
  <main class="content">
    <header class="toolbar">
      <div class="breadcrumbs">
        {#each breadcrumbs as crumb, i}
          {#if i > 0}
            <ChevronRight class="w-4 h-4" />
          {/if}
          <button onclick={() => navigateToFolder(crumb.id, crumb.name)}>
            {crumb.name}
          </button>
        {/each}
      </div>
      
      <div class="toolbar-actions">
        <div class="search-box">
          <Search class="w-4 h-4" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search files..."
            onkeyup={(e) => e.key === 'Enter' && loadAssets()}
          />
        </div>
        
        <select bind:value={typeFilter} onchange={loadAssets}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="document">Documents</option>
        </select>
        
        <div class="view-toggle">
          <button class:active={view === 'grid'} onclick={() => view = 'grid'}>
            <Grid class="w-4 h-4" />
          </button>
          <button class:active={view === 'list'} onclick={() => view = 'list'}>
            <List class="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
    
    {#if loading}
      <div class="loading">Loading...</div>
    {:else if assets.length === 0}
      <div class="empty-state">
        <Image class="w-12 h-12" />
        <p>No files found</p>
        <Button onclick={() => showUploader = true}>Upload Files</Button>
      </div>
    {:else}
      <MediaGrid
        {assets}
        {view}
        {selectedAssets}
        selectable={mode === 'select'}
        onSelect={toggleSelect}
        onOpen={(asset) => {/* open detail panel */}}
      />
    {/if}
    
    {#if mode === 'select' && selectedAssets.size > 0}
      <footer class="selection-bar">
        <span>{selectedAssets.size} selected</span>
        <Button onclick={confirmSelection}>
          Insert Selected
        </Button>
      </footer>
    {/if}
  </main>
</div>

{#if showUploader}
  <MediaUploader
    folderId={currentFolder}
    onComplete={() => {
      showUploader = false;
      loadAssets();
    }}
    onClose={() => showUploader = false}
  />
{/if}

<style>
  .media-browser {
    display: grid;
    grid-template-columns: 240px 1fr;
    height: 100%;
    background: var(--color-bg-surface);
  }
  
  .sidebar {
    border-right: 1px solid var(--color-border);
    padding: 1rem;
  }
  
  .upload-btn {
    width: 100%;
    margin-bottom: 1rem;
  }
  
  .content {
    display: flex;
    flex-direction: column;
  }
  
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .breadcrumbs button {
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  
  .breadcrumbs button:hover {
    background: var(--color-bg-muted);
  }
  
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--color-bg-muted);
    border-radius: 0.375rem;
  }
  
  .search-box input {
    border: none;
    background: none;
    outline: none;
    width: 200px;
  }
  
  .view-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  
  .view-toggle button {
    padding: 0.375rem 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
  }
  
  .view-toggle button.active {
    background: var(--color-primary);
    color: white;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--color-text-muted);
  }
  
  .selection-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--color-primary);
    color: white;
  }
</style>
```

### Focal Point Editor

```svelte
<!-- lib/components/media/FocalPointEditor.svelte -->
<script lang="ts">
  import { Move } from 'lucide-svelte';
  
  interface Props {
    imageUrl: string;
    focalPoint: { x: number; y: number };
    onChange: (point: { x: number; y: number }) => void;
  }
  
  let { imageUrl, focalPoint, onChange }: Props = $props();
  
  let containerRef: HTMLDivElement;
  let isDragging = $state(false);
  
  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    updatePoint(e);
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    updatePoint(e);
  }
  
  function handleMouseUp() {
    isDragging = false;
  }
  
  function updatePoint(e: MouseEvent) {
    const rect = containerRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onChange({ x, y });
  }
</script>

<div
  bind:this={containerRef}
  class="focal-point-editor"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
>
  <img src={imageUrl} alt="Focal point editor" />
  
  <div
    class="focal-marker"
    style="left: {focalPoint.x * 100}%; top: {focalPoint.y * 100}%"
  >
    <Move class="w-4 h-4" />
  </div>
  
  <div class="grid-overlay">
    <div class="grid-line horizontal" style="top: 33.33%"></div>
    <div class="grid-line horizontal" style="top: 66.66%"></div>
    <div class="grid-line vertical" style="left: 33.33%"></div>
    <div class="grid-line vertical" style="left: 66.66%"></div>
  </div>
</div>

<style>
  .focal-point-editor {
    position: relative;
    cursor: crosshair;
    user-select: none;
  }
  
  .focal-point-editor img {
    display: block;
    width: 100%;
    height: auto;
  }
  
  .focal-marker {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 2rem;
    height: 2rem;
    background: var(--color-primary);
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  }
  
  .grid-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  
  .grid-line {
    position: absolute;
    background: rgba(255, 255, 255, 0.3);
  }
  
  .grid-line.horizontal {
    left: 0;
    right: 0;
    height: 1px;
  }
  
  .grid-line.vertical {
    top: 0;
    bottom: 0;
    width: 1px;
  }
</style>
```

### Drag & Drop Uploader

```svelte
<!-- lib/components/media/MediaUploader.svelte -->
<script lang="ts">
  import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    folderId?: string | null;
    onComplete: () => void;
    onClose: () => void;
  }
  
  let { folderId, onComplete, onClose }: Props = $props();
  
  let isDragOver = $state(false);
  let files = $state<{
    file: File;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    progress: number;
    error?: string;
  }[]>([]);
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }
  
  function handleDragLeave() {
    isDragOver = false;
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    
    if (e.dataTransfer?.files) {
      addFiles(e.dataTransfer.files);
    }
  }
  
  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      addFiles(input.files);
    }
  }
  
  function addFiles(fileList: FileList) {
    const newFiles = Array.from(fileList).map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    
    files = [...files, ...newFiles];
    uploadAll();
  }
  
  async function uploadAll() {
    for (const fileEntry of files) {
      if (fileEntry.status !== 'pending') continue;
      
      fileEntry.status = 'uploading';
      files = [...files];
      
      try {
        const formData = new FormData();
        formData.append('file', fileEntry.file);
        if (folderId) formData.append('folderId', folderId);
        
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }
        
        fileEntry.status = 'complete';
        fileEntry.progress = 100;
      } catch (error) {
        fileEntry.status = 'error';
        fileEntry.error = error instanceof Error ? error.message : 'Upload failed';
      }
      
      files = [...files];
    }
    
    // Check if all complete
    if (files.every(f => f.status === 'complete' || f.status === 'error')) {
      setTimeout(onComplete, 1000);
    }
  }
</script>

<div class="uploader-overlay">
  <div class="uploader-dialog">
    <header>
      <h2>Upload Files</h2>
      <button onclick={onClose}><X class="w-5 h-5" /></button>
    </header>
    
    <div
      class="drop-zone"
      class:drag-over={isDragOver}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    >
      <Upload class="w-10 h-10" />
      <p>Drag and drop files here</p>
      <span>or</span>
      <label class="file-input-label">
        <input
          type="file"
          multiple
          onchange={handleFileSelect}
          hidden
        />
        Browse Files
      </label>
    </div>
    
    {#if files.length > 0}
      <div class="file-list">
        {#each files as fileEntry}
          <div class="file-item">
            <div class="file-info">
              <span class="filename">{fileEntry.file.name}</span>
              <span class="filesize">
                {(fileEntry.file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            
            <div class="file-status">
              {#if fileEntry.status === 'pending'}
                <span class="pending">Pending</span>
              {:else if fileEntry.status === 'uploading'}
                <Loader2 class="w-4 h-4 animate-spin" />
              {:else if fileEntry.status === 'complete'}
                <CheckCircle class="w-4 h-4 text-success" />
              {:else if fileEntry.status === 'error'}
                <AlertCircle class="w-4 h-4 text-danger" title={fileEntry.error} />
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .uploader-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .uploader-dialog {
    width: 100%;
    max-width: 500px;
    background: white;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  header h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  
  header button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
  }
  
  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 2rem;
    margin: 1rem;
    border: 2px dashed var(--color-border);
    border-radius: 0.5rem;
    text-align: center;
    transition: all 0.15s;
  }
  
  .drop-zone.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
  
  .drop-zone p {
    margin: 0.5rem 0;
    color: var(--color-text-muted);
  }
  
  .drop-zone span {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }
  
  .file-input-label {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  
  .file-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 0 1rem 1rem;
  }
  
  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .filename {
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .filesize {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .text-success { color: var(--color-success); }
  .text-danger { color: var(--color-danger); }
</style>
```

---

## Cloudflare Images Integration

### Setup

```toml
# wrangler.toml
[vars]
CF_IMAGES_ACCOUNT_ID = "your-account-id"
CF_IMAGES_API_TOKEN = "your-api-token"
```

### Predefined Variants

Configure in Cloudflare Dashboard:

| Variant Name | Width | Height | Fit | Use Case |
|--------------|-------|--------|-----|----------|
| `thumbnail` | 150 | 150 | cover | Grid view |
| `preview` | 400 | 300 | contain | Detail panel |
| `hero` | 1920 | 1080 | cover | Hero images |
| `og` | 1200 | 630 | cover | Social sharing |
| `avatar` | 80 | 80 | cover | Profile pics |

---

## Testing Strategy

```typescript
describe('MediaService', () => {
  it('uploads file and generates metadata', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const asset = await media.upload(file, {}, context);
    
    expect(asset.id).toBeDefined();
    expect(asset.mimeType).toBe('image/jpeg');
    expect(asset.r2Key).toContain('test');
  });
  
  it('detects duplicate files', async () => {
    const file = new File(['same content'], 'file1.jpg', { type: 'image/jpeg' });
    await media.upload(file, {}, context);
    
    const duplicate = new File(['same content'], 'file2.jpg', { type: 'image/jpeg' });
    await expect(media.upload(duplicate, {}, context)).rejects.toThrow('Duplicate');
  });
  
  it('sets and respects focal point', async () => {
    const asset = await media.upload(file, {}, context);
    await media.setFocalPoint(asset.id, 0.3, 0.7, context);
    
    const updated = await media.get(asset.id);
    expect(updated?.focalPoint).toEqual({ x: 0.3, y: 0.7 });
  });
  
  it('tracks usage across documents', async () => {
    const asset = await media.upload(file, {}, context);
    
    // Simulate usage in document
    await db.prepare(`
      INSERT INTO media_usage (id, asset_id, document_id, field_path, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), asset.id, docId, 'hero_image', Date.now()).run();
    
    const usage = await media.getUsage(asset.id);
    expect(usage).toHaveLength(1);
    expect(usage[0].documentId).toBe(docId);
  });
});
```

---

## Related Documents

- [hanawa-cms.md](../hanawa-cms.md) — Editor integration
- [01-audit-system.md](./01-audit-system.md) — Upload actions audited
- [15-delivery-api.md](./15-delivery-api.md) — Image URL generation

---

*Document version: 1.0*
