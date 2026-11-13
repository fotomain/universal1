import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import ListWebCardsComponent, { CardFullVersion } from '../../../kit8/ui/components/list/web';
import { CreateNewCardBasicForm } from '../../../kit8/ui/components/list/forms';
import { mediaPostOwnerGUID } from '../../../kit8/redux/mediaPostOwner';

export default function MediaPostCrudScreen() {
  // the FULL user GUID: the database shows and accepts only the posts owned by it (kit8/redux/mediaPostOwner.ts)
  const listOwnerGUID = useSelector(mediaPostOwnerGUID);

  // route: /posts/mediapostcrud?scrollToGUID=<post rowGUID> - scroll to that post (a post added from a
  // share intent). The card appears a moment after the list was read, so look for it for a few seconds.
  const { scrollToGUID } = useLocalSearchParams<{ scrollToGUID?: string }>();
  useEffect(() => {
    if (!scrollToGUID || typeof document === 'undefined') return;
    let tries = 0;
    const timer = setInterval(() => {
      const card = document.getElementById(`card-container-${scrollToGUID}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.click(); // marks it as the current card of the list
      }
      if (card || ++tries > 30) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [scrollToGUID]);

  return (
    <ListWebCardsComponent
      entityName="mediaPostReusable"
      crudListTitle="Media Posts"
      listOwnerGUID={listOwnerGUID}
      CardComponent={CardFullVersion}
      createNewCardComponent={CreateNewCardBasicForm}
    />
  );
}
