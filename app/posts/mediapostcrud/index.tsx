import React from 'react';
import { useSelector } from 'react-redux';
import ListWebCardsComponent, { CardFullVersion } from '../../../kit8/components/list/web';
import { CreateNewCardBasicForm } from '../../../kit8/components/list/forms';
import { ActiveUserState } from '../../../kit8/redux/activeUserSlice';

export default function MediaPostCrudScreen() {
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);
  const listOwnerGUID = activeUserState?.activeUserGUID || '';

  const crudListOptions = {
    listWebTopBarComponentNeeded: true,
    listWebOnScrollInfoNeeded: true,
    onOffSelectionButtonNeeded: true,
    fabCardNeeded: true,
    searchTextNeeded: true,
  };
  const crudListOptions1 = {
    listWebTopBarComponentNeeded: false,
    listWebOnScrollInfoNeeded: false,
    onOffSelectionButtonNeeded: false,
    fabCardNeeded: false,
    searchTextNeeded: false,
  };

  return (
    <ListWebCardsComponent
      entityName="mediaPostReusable"
      crudListTitle="Media Posts"
      crudListOwnerGUID={listOwnerGUID}
      CardComponent={CardFullVersion}
      createNewCardComponent={CreateNewCardBasicForm}
      crudListOptions={crudListOptions1}
    />
  );
}
