import { SkeletonPage } from '@/components/Skeleton';

export default function TrendsLoading() {
  return <SkeletonPage title="Loading trends…" cards={6} />;
}
