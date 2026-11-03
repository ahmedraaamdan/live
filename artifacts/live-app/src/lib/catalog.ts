import { useQuery } from '@tanstack/react-query';
import { GRADES, SUBJECTS, setCatalog, type CatalogDTO } from '@workspace/live-core';
import { api } from './api';

export function useCatalog() {
  const q = useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const data = await api<CatalogDTO>('/catalog');
      setCatalog(data);
      return data;
    },
    staleTime: 60_000,
  });
  return {
    subjects: q.data?.subjects ?? SUBJECTS,
    grades: q.data?.grades ?? GRADES,
    isLoading: q.isPending,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}
