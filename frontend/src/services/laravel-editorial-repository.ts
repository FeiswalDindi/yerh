import type { ContentItem } from '../domain/content';
import { laravelRequest } from './laravel-api';

export interface EditorialRecord {
  id: number;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  updated_at?: string;
  content: ContentItem;
}

const path = '/workspace/editorial';
export const editorialRepository = {
  async publicFeed(signal?: AbortSignal) {
    return (
      await laravelRequest<{
        data: { items: ContentItem[]; featured: string[]; hidden: string[] };
      }>('/editorial', { signal })
    ).data;
  },
  async entries(signal?: AbortSignal) {
    return (await laravelRequest<{ data: EditorialRecord[] }>(path, { signal })).data;
  },
  save(data: object, id?: number) {
    return laravelRequest(id ? path + '/' + id : path, { method: id ? 'PATCH' : 'POST', data });
  },
  remove(id: number) {
    return laravelRequest(path + '/' + id, { method: 'DELETE' });
  },
};
