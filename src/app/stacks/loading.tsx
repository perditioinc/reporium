import { SkeletonPage } from '@/components/Skeleton';

export default function StacksLoading() {
  return <SkeletonPage title="Loading stacks…" cards={6} />;
}
