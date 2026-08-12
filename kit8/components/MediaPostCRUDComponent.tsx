import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../redux/SystemMetaData';
import { mediaPostExample } from '../redux/lib/mediaPostExample';
import H1Mi from '../ui/H1Mi';
import TexInputMi from '../ui/TexInputMi';
import ButtonMi from '../ui/ButtonMi';
import { showSnackbar } from '../redux/uxuiSlice';

const uuid = Crypto.randomUUID;

interface MediaPostCRUDComponentProps {
    entityName?: string;
}

export default function MediaPostCRUDComponent({ entityName = 'mediaPostReusable' }: MediaPostCRUDComponentProps) {
    const dispatch = useDispatch();

    // Select entity state from Redux
    const entityState = useSelector((state: any) => state[entityName]);
    const entityMetaData = SystemMetaData[entityName];
    const actions = entityMetaData?.actions;

    // Local form states for Create
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [originUrl, setOriginUrl] = useState('');
    const [filterText, setFilterText] = useState('');

    // Local editing state for Update
    const [editingGuid, setEditingGuid] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Load data on mount or when entityName changes
    useEffect(() => {
        if (actions?.readData) {
            dispatch(actions.readData({ paginationSize: 50, originationCurrentPage: 0, readAllFilter: '' }));
        }
    }, [actions, entityName, dispatch]);

    // Handle Refresh / Read
    const handleRead = (filter?: string) => {
        if (actions?.readData) {
            dispatch(actions.readData({
                paginationSize: 50,
                originationCurrentPage: 0,
                readAllFilter: filter !== undefined ? filter : filterText,
            }));
        }
    };

    // Handle Create
    const handleCreate = () => {
        if (!title.trim() && !description.trim()) {
            return;
        }

        const newPostGUID = uuid();
        const newPostPayload = {
            mediaPostOwnerGUID: "111459c1-b433-47d4-bf99-031d23a7a389",
            mediaPostGUID: newPostGUID,
            orderInList: Date.now(),
            mediaPostJSON: {
                mediaPostTitle: title.trim() || 'Untitled Post',
                mediaPostSubTitle: subtitle.trim() || 'Subtitle',
                mediaPostDescription: description.trim() || '',
                mediaPostOrigin: originUrl.trim() || 'https://youtu.be/1iygZ8j_SSs',
                mediaPostMIME: 'youtube',
                mediaPostOriginType: 'url',
                dataOriginName: 'youtube',
                dataManipulationName: 'YOUTUBE_TO_GOOGLE_DRIVE',
            },
        };

        if (actions?.createOne) {
            dispatch(actions.createOne(newPostPayload));
            setTitle('');
            setSubtitle('');
            setDescription('');
            setOriginUrl('');
        }
    };

    // Pre-fill with Example Post
    const handleLoadExample = () => {
        const exampleJSON = mediaPostExample.mediaPostJSON;
        setTitle(exampleJSON.mediaPostTitle || '');
        setSubtitle(exampleJSON.mediaPostSubTitle || '');
        setDescription(exampleJSON.mediaPostDescription || '');
        setOriginUrl(exampleJSON.mediaPostOrigin || '');
    };

    // Start Editing an Item
    const handleStartEdit = (item: any) => {
        const json = item.mediaPostJSON || {};
        setEditingGuid(item.mediaPostGUID);
        setEditTitle(json.mediaPostTitle || '');
        setEditDescription(json.mediaPostDescription || '');
    };

    // Cancel Editing
    const handleCancelEdit = () => {
        setEditingGuid(null);
        setEditTitle('');
        setEditDescription('');
    };

    // Save Updated Item
    const handleSaveEdit = (guid: string) => {
        if (!actions) return;

        if (editTitle.trim()) {
            dispatch(actions.updateOne({
                mediaPostGUID: guid,
                field: 'mediaPostTitle',
                value: editTitle.trim(),
            }));
        }

        if (editDescription.trim()) {
            dispatch(actions.updateOne({
                mediaPostGUID: guid,
                field: 'mediaPostDescription',
                value: editDescription.trim(),
            }));
        }

        setEditingGuid(null);

        // Refresh after update
        setTimeout(() => {
            handleRead();
        }, 500);
    };

    // Delete an Item
    const handleDelete = (guid: string) => {
        if (actions?.deleteOne) {
            dispatch(actions.deleteOne({ mediaPostGUID: guid }));
            setTimeout(() => {
                handleRead();
            }, 500);
        }
        dispatch(showSnackbar({ message: "Post successfully deleted" }));
    };

    const posts = entityState?.entityDataFromServer || [];
    const isLoading = entityState?.isReading || entityState?.isCreating || entityState?.isUpdating || entityState?.isDeleting;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <H1Mi>Media Post CRUD ({entityName})</H1Mi>

            {/* Status & Error Section */}
            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6200ee" />
                    <Text style={styles.loadingText}>Processing request...</Text>
                </View>
            )}

            {entityState?.readErrorData ? (
                <Text style={styles.errorText}>Read Error: {String(entityState.readErrorData)}</Text>
            ) : null}
            {entityState?.createErrorData ? (
                <Text style={styles.errorText}>Create Error: {String(entityState.createErrorData)}</Text>
            ) : null}

            {/* Filter & Refresh Controls */}
            <View style={styles.card}>
                <Text style={styles.cardHeader}>🔍 Search & Refresh</Text>
                <TexInputMi
                    label="Search Filter"
                    value={filterText}
                    onChangeText={setFilterText}
                    placeholder="Search posts..."
                    inputMode="nativePaper"
                />
                <View style={styles.rowButtons}>
                    <ButtonMi title="Search / Read Posts" onPress={() => handleRead(filterText)} />
                </View>
            </View>

            {/* Create New Post Form */}
            <View style={styles.card}>
                <Text style={styles.cardHeader}>➕ Create New Media Post</Text>
                <TexInputMi
                    label="Title"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter post title"
                    inputMode="nativePaper"
                />
                <TexInputMi
                    label="Subtitle"
                    value={subtitle}
                    onChangeText={setSubtitle}
                    placeholder="Enter post subtitle"
                    inputMode="nativePaper"
                />
                <TexInputMi
                    label="Description"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Enter post description"
                    inputMode="nativePaper"
                />
                <TexInputMi
                    label="Origin URL"
                    value={originUrl}
                    onChangeText={setOriginUrl}
                    placeholder="https://youtu.be/..."
                    inputMode="nativePaper"
                />
                <View style={styles.rowButtons}>
                    <ButtonMi title="Create Post" onPress={handleCreate} />
                    <ButtonMi title="Fill Sample Data" onPress={handleLoadExample} color="#555" />
                </View>
            </View>

            {/* List of Posts */}
            <View style={styles.card}>
                <Text style={styles.cardHeader}>📋 Posts List ({posts.length})</Text>

                {posts.length === 0 ? (
                    <Text style={styles.emptyText}>No media posts found. Click "Create Post" or "Search / Read Posts".</Text>
                ) : (
                    posts.map((item: any, index: number) => {
                        const json = item?.mediaPostJSON || {};
                        const guid = item?.mediaPostGUID || `item-${index}`;
                        const isEditing = editingGuid === guid;

                        return (
                            <View key={guid} style={styles.postItem}>
                                {isEditing ? (
                                    <View style={styles.editContainer}>
                                        <Text style={styles.editingHeader}>Editing Post ID: {guid}</Text>
                                        <TexInputMi
                                            label="Title"
                                            value={editTitle}
                                            onChangeText={setEditTitle}
                                            inputMode="nativePaper"
                                        />
                                        <TexInputMi
                                            label="Description"
                                            value={editDescription}
                                            onChangeText={setEditDescription}
                                            inputMode="nativePaper"
                                        />
                                        <View style={styles.rowButtons}>
                                            <ButtonMi title="Save Changes" onPress={() => handleSaveEdit(guid)} color="#2e7d32" />
                                            <ButtonMi title="Cancel" onPress={handleCancelEdit} color="#757575" />
                                        </View>
                                    </View>
                                ) : (
                                    <View>
                                        <Text style={styles.postTitle}>{json.mediaPostTitle || item.title || 'Untitled'}</Text>
                                        {json.mediaPostSubTitle ? (
                                            <Text style={styles.postSubtitle}>{json.mediaPostSubTitle}</Text>
                                        ) : null}
                                        {json.mediaPostDescription ? (
                                            <Text style={styles.postDescription}>{json.mediaPostDescription}</Text>
                                        ) : null}
                                        {json.mediaPostOrigin ? (
                                            <Text style={styles.postUrl}>🔗 {json.mediaPostOrigin}</Text>
                                        ) : null}
                                        <Text style={styles.postGuid}>GUID: {guid}</Text>

                                        <View style={styles.rowButtons}>
                                            <ButtonMi title="Edit" onPress={() => handleStartEdit(item)} color="#0288d1" />
                                            <ButtonMi title="Delete" onPress={() => handleDelete(guid)} color="#d32f2f" />
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        backgroundColor: '#e8eaf6',
        borderRadius: 6,
        marginVertical: 8,
    },
    loadingText: {
        marginLeft: 8,
        color: '#3f51b5',
        fontWeight: 'bold',
    },
    errorText: {
        color: '#d32f2f',
        marginVertical: 4,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        elevation: 2,
    },
    cardHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    rowButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    postItem: {
        backgroundColor: '#f9f9f9',
        padding: 14,
        borderRadius: 6,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: '#eee',
    },
    postTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a237e',
    },
    postSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        marginTop: 2,
    },
    postDescription: {
        fontSize: 14,
        color: '#444',
        marginTop: 4,
    },
    postUrl: {
        fontSize: 12,
        color: '#1e88e5',
        marginTop: 4,
    },
    postGuid: {
        fontSize: 10,
        color: '#999',
        marginTop: 6,
    },
    emptyText: {
        textAlign: 'center',
        color: '#777',
        marginVertical: 12,
    },
    editContainer: {
        gap: 6,
    },
    editingHeader: {
        fontWeight: 'bold',
        color: '#0288d1',
        marginBottom: 6,
    },
});
