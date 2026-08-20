import React from 'react';
import { useSelector } from 'react-redux';
import { ActiveUserState } from '../../kit8/redux/activeUserSlice';
import UploadFilesForAIToGoogleDriveComponent from '../../kit8/components/upload/UploadFilesForAIToGoogleDriveComponent';

export default function AboutScreen() {
    const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);
    const userState = useSelector((state: any) => state.userState);
    const userGUID = userState?.userGUID || activeUserState?.activeUserGUID || '88888999999';

    return <UploadFilesForAIToGoogleDriveComponent userGUID={userGUID} />;
}
