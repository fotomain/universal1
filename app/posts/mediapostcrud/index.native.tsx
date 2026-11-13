// iOS / Android: the web list (index.tsx) is built from browser tags and cannot run on a phone.
import React from 'react';
import MediaPostsNativeList from '../../../kit8/ui/components/media/MediaPostsNativeList';

export default function MediaPostCrudNativeScreen() {
  return <MediaPostsNativeList />;
}
