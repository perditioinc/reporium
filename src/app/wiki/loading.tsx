import { SkeletonPage } from '@/components/Skeleton';

export default function WikiLoading() {
  return <SkeletonPage title="Loading wiki…" cards={9} />;
}
