import React from 'react';
import { useSelector } from 'react-redux';
import ListWebCardsComponent from '../../../kit8/components/list/web';
import { CreateRaciMemberForm } from '../../../kit8/components/list/forms/CreateRaciMemberForm';
import { RaciMemberListCard } from '../../../kit8/components/list/cards/RaciMemberListCard';
import { ActiveUserState } from '../../../kit8/redux/activeUserSlice';

export default function RaciMemberCrudScreen() {
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);
  const listOwnerGUID = activeUserState?.activeUserGUID || '';

  return (
    <ListWebCardsComponent
      entityName="raciMember"
      crudListTitle="Users (RACI)"
      listOwnerGUID={listOwnerGUID}
      CardComponent={RaciMemberListCard}
      crudCardHeight={110}
      createNewCardComponent={CreateRaciMemberForm}
    />
  );
}
