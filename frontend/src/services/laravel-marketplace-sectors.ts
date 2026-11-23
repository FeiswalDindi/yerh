import { laravelRequest } from './laravel-api';

export interface MarketplaceSector {
  id: number;
  count: number;
  name: string;
  image: string | null;
}

export async function marketplaceSectors(signal?: AbortSignal) {
  return (await laravelRequest<{ data: MarketplaceSector[] }>('/marketplace-sectors', { signal }))
    .data;
}

export function saveMarketplaceSector(data: FormData, id?: number) {
  if (!data.get('photo') || !(data.get('photo') as File).size) data.delete('photo');
  return laravelRequest('/workspace/marketplace-sectors' + (id ? '/' + id + '/image' : ''), {
    method: 'POST',
    data,
  });
}
