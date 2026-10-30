import { useQuery } from '@tanstack/react-query';
import type { PublicConfigDTO } from '@workspace/live-core';
import { api } from './api';
export function useCapabilities() { return useQuery({ queryKey: ['config'], queryFn: () => api<PublicConfigDTO>('/config'), staleTime: 60_000 }); }
