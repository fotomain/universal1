// Media Posts: ONE screen for the web, iOS and Android = a ReusableList (kit8/ui/components/list/reusable) with the card ReusableCardMediaPost
// (three sizes, the origin of the post, a local FAB) and the Add form CreateListElementForm. No index.native.tsx: this file serves every platform.
// route: /posts/mediapostcrud?scrollToGUID=<post rowGUID> - the list scrolls to that post (a post added from a share intent).
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import MediaPostsNativeList from '../../../kit8/ui/components/media/common/MediaPostsNativeList';
import ReusableCardMediaPost from '../../../kit8/ui/components/list/cards/mediapost/ReusableCardMediaPost';

export default function MediaPostCrudScreen() {
  const { scrollToGUID } = useLocalSearchParams<{ scrollToGUID?: string }>();
  return <MediaPostsNativeList reusableCard={ReusableCardMediaPost} focusRowGUID={typeof scrollToGUID === 'string' ? scrollToGUID : undefined} />;
}
