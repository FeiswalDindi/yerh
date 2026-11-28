import { apiUrl, laravelRequest } from './laravel-api';

export type CmsSectionKey = 'site' | 'homepage' | 'faqs' | 'team' | 'partners';

export type CmsPublicSectionKey =
  | CmsSectionKey
  | 'terms'
  | 'entrepreneurship'
  | 'lessons'
  | 'sidebar';

export interface CmsLiveStats {
  mentors: number;
  users: number;
  institutions: number;
  ventures: number;
}

export interface CmsSectionState {
  section: CmsSectionKey;
  draft: unknown | null;
  published: unknown | null;
  published_version: number;
  has_draft: boolean;
  draft_author: string | null;
  draft_updated_at: string | null;
  published_author: string | null;
  published_at: string | null;
}

export interface CmsRevision {
  id: number;
  section: CmsSectionKey;
  version: number;
  summary: string | null;
  created_at: string;
  author: string | null;
}

export interface CmsWorkspaceData {
  sections: Record<CmsSectionKey, CmsSectionState>;
  revisions: CmsRevision[];
  liveStats: CmsLiveStats;
}

export interface CmsMediaAsset {
  id: number;
  uuid: string;
  url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  alt_text: string;
  folder: string;
  in_site_library?: boolean;
  uploaded_by?: string | null;
  created_at?: string;
}

export interface CmsPublicPayload {
  documents: Partial<Record<CmsPublicSectionKey, unknown>>;
  liveStats: CmsLiveStats | null;
}

export const cmsRepository = {
  async publicPayload(signal?: AbortSignal): Promise<CmsPublicPayload> {
    return (await laravelRequest<{ data: CmsPublicPayload }>('/cms/public', { signal })).data;
  },

  async workspace(signal?: AbortSignal): Promise<CmsWorkspaceData> {
    return (await laravelRequest<{ data: CmsWorkspaceData }>('/workspace/cms', { signal })).data;
  },

  async saveDraft(section: CmsSectionKey, payload: unknown) {
    return (
      await laravelRequest<{ data: { section: CmsSectionKey; saved: boolean } }>(
        `/workspace/cms/${section}/draft`,
        { method: 'PUT', data: { payload } },
      )
    ).data;
  },

  async publish(section: CmsSectionKey, payload?: unknown, summary?: string) {
    return (
      await laravelRequest<{ data: { section: CmsSectionKey; version: number } }>(
        `/workspace/cms/${section}/publish`,
        { method: 'POST', data: { payload, summary } },
      )
    ).data;
  },

  async discardDraft(section: CmsSectionKey) {
    return (
      await laravelRequest<{ data: { discarded: boolean } }>(`/workspace/cms/${section}/discard`, {
        method: 'POST',
      })
    ).data;
  },

  async restoreRevision(id: number) {
    return (
      await laravelRequest<{ data: { section: CmsSectionKey; version: number } }>(
        `/workspace/cms/revisions/${id}/restore`,
        { method: 'POST' },
      )
    ).data;
  },

  async media(signal?: AbortSignal): Promise<CmsMediaAsset[]> {
    return (await laravelRequest<{ data: CmsMediaAsset[] }>('/workspace/cms/media', { signal }))
      .data;
  },

  async uploadMedia(
    file: File,
    alt_text = '',
    folder = 'general',
    in_site_library = false,
  ): Promise<CmsMediaAsset> {
    const form = new FormData();
    form.append('file', file);
    if (alt_text.trim()) form.append('alt_text', alt_text.trim());
    if (folder.trim()) form.append('folder', folder.trim());
    if (in_site_library) form.append('in_site_library', '1');
    return (
      await laravelRequest<{ data: CmsMediaAsset }>('/workspace/cms/media', {
        method: 'POST',
        data: form,
      })
    ).data;
  },

  async updateMedia(
    id: number,
    data: { alt_text?: string; folder?: string; in_site_library?: boolean },
  ) {
    return (
      await laravelRequest<{ data: { id: number; in_site_library?: boolean } }>(
        `/workspace/cms/media/${id}`,
        {
          method: 'PATCH',
          data,
        },
      )
    ).data;
  },

  async deleteMedia(id: number): Promise<void> {
    await laravelRequest(`/workspace/cms/media/${id}`, { method: 'DELETE' });
  },

  mediaUrl(uuid: string): string {
    return apiUrl(`/cms/media/${uuid}`);
  },
};
