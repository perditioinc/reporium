import { SkeletonPage } from '@/components/Skeleton';

export default function InsightsLoading() {
  return <SkeletonPage title="Loading insights…" cards={6} />;
}
