'use client';

/**
 * Thin client component that records a repo view in localStorage on mount.
 * Used by the repo detail page (Server Component) to feed RecommendationsWidget.
 */

import { useEffect } from 'react';
import { trackRepoView } from './RecommendationsWidget';

interface ViewTrackerProps {
  repoName: string;
}

export function ViewTracker({ repoName }: ViewTrackerProps) {
  useEffect(() => {
    trackRepoView(repoName);
  }, [repoName]);

  return null; // renders nothing
}
