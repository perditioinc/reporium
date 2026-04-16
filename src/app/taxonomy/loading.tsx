import { SkeletonPage } from '@/components/Skeleton';

export default function TaxonomyLoading() {
  return <SkeletonPage title="Loading taxonomy…" cards={8} />;
}
