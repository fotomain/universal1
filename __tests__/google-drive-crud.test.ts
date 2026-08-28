import axios from 'axios';
import { googleDrive, GoogleDriveCredentials, GoogleDriveFileInfo } from '../kit8/google/drive/googleDrive';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('googleDrive Module CRUD Operations', () => {
    const mockCredentials: GoogleDriveCredentials = {
        accessToken: 'mock-access-token-123',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    describe('1. createFile', () => {
        it('should successfully upload a file with progress callback and return metadata', async () => {
            const mockFileInfo: GoogleDriveFileInfo = {
                name: 'test-image.png',
                mimeType: 'image/png',
                blob: new Blob(['dummy content'], { type: 'image/png' }),
            };

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    id: 'created-file-123',
                    name: 'test-image.png',
                    mimeType: 'image/png',
                    size: '1024',
                    webViewLink: 'https://drive.google.com/file/d/created-file-123/view',
                },
            });

            const onProgress = jest.fn();
            const result = await googleDrive.createFile(
                mockCredentials,
                mockFileInfo,
                { parentId: 'parent-folder-id', onProgress }
            );

            expect(result.id).toBe('created-file-123');
            expect(result.name).toBe('test-image.png');
            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                expect.any(FormData),
                expect.objectContaining({
                    headers: { Authorization: 'Bearer mock-access-token-123' },
                })
            );
        });

        it('should upload file reading from disk path using createOnGoogleDrive', async () => {
            const mockFileInfo: GoogleDriveFileInfo = {
                name: 'disk-file.txt',
                mimeType: 'text/plain',
                path: '/tmp/disk-file.txt',
            };

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    id: 'disk-file-123',
                    name: 'disk-file.txt',
                    mimeType: 'text/plain',
                    size: '512',
                },
            });

            const result = await googleDrive.createOnGoogleDrive(
                mockCredentials,
                mockFileInfo,
                { parentId: 'folder-disk' }
            );

            expect(result.id).toBe('disk-file-123');
            expect(result.name).toBe('disk-file.txt');
            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        });

        it('should dispatch createOne and updateOne actions when dispatch is provided', async () => {
            const mockFileInfo: GoogleDriveFileInfo = {
                name: 'test-doc.pdf',
                mimeType: 'application/pdf',
                blob: new Blob(['pdf data'], { type: 'application/pdf' }),
            };

            mockedAxios.post.mockImplementationOnce(async (_url, _data, config) => {
                config?.onUploadProgress?.({ loaded: 50, total: 100 } as any);
                return {
                    data: {
                        id: 'pdf-file-123',
                        name: 'test-doc.pdf',
                        mimeType: 'application/pdf',
                    },
                };
            });

            const mockDispatch = jest.fn();
            const result = await googleDrive.createFile(
                mockCredentials,
                mockFileInfo,
                {
                    parentId: 'folder-abc',
                    dispatch: mockDispatch,
                    actions: {
                        createOne: (payload: any) => ({ type: 'googleDriveCommand/createOne', payload }),
                        updateOne: (payload: any) => ({ type: 'googleDriveCommand/updateOne', payload }),
                    },
                    rowOwnerGUID: 'owner-guid-1',
                    rowParentGUID: 'Clothes1',
                    orderInList: 2,
                }
            );

            expect(result.id).toBe('pdf-file-123');
            expect(mockDispatch).toHaveBeenCalled();
            // Verify at least one updateOne action was dispatched with rowJSON
            const updateActions = mockDispatch.mock.calls
                .map((call) => call[0])
                .filter((action) => action?.type?.includes('updateOne'));
            expect(updateActions.length).toBeGreaterThan(0);
            expect(updateActions[0].payload).toEqual(
                expect.objectContaining({
                    rowOwnerGUID: 'owner-guid-1',
                    rowParentGUID: 'Clothes1',
                    orderInList: 2,
                    rowJSON: expect.objectContaining({
                        googleDriveCommandName: 'createFile',
                    }),
                })
            );
        });
    });

    describe('2. createFolder (with Subfolders Support)', () => {
        it('should return existing folder if findIfExists is true and folder exists in parent', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    files: [{ id: 'existing-subfolder-id', name: 'subfolder-1', mimeType: 'application/vnd.google-apps.folder' }],
                }),
            });

            const result = await googleDrive.createFolder(
                mockCredentials,
                { name: 'subfolder-1' },
                { parentId: 'root-parent-id', findIfExists: true }
            );

            expect(result.id).toBe('existing-subfolder-id');
            expect(result.name).toBe('subfolder-1');
        });

        it('should create new folder if not found in parent', async () => {
            // First search returns empty
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ files: [] }),
            });
            // Next create returns new folder
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'new-folder-id-789',
                    name: 'new-dataset-folder',
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            });

            const result = await googleDrive.createFolder(
                mockCredentials,
                { name: 'new-dataset-folder' },
                { parentId: 'root-parent-id', findIfExists: true }
            );

            expect(result.id).toBe('new-folder-id-789');
            expect(result.name).toBe('new-dataset-folder');
        });

        it('should support multi-level nested subfolder path creation (e.g. folderPath: ["userRoot", "dataset_shop_images"])', async () => {
            // Level 1: userRoot exists
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    files: [{ id: 'user-root-id', name: 'userRoot' }],
                }),
            });
            // Level 2: dataset_shop_images search returns empty
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ files: [] }),
            });
            // Level 2: create dataset_shop_images
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'dataset-shop-images-id',
                    name: 'dataset_shop_images',
                }),
            });

            const result = await googleDrive.createFolder(
                mockCredentials,
                {},
                { folderPath: ['userRoot', 'dataset_shop_images'], parentId: 'main-drive-root' }
            );

            expect(result.id).toBe('dataset-shop-images-id');
            expect(result.name).toBe('dataset_shop_images');
        });
    });

    describe('3. deleteFile', () => {
        it('should delete a file by ID', async () => {
            mockedAxios.delete.mockResolvedValueOnce({ data: {} });

            const result = await googleDrive.deleteFile(
                mockCredentials,
                { id: 'file-to-delete-456' },
                {}
            );

            expect(result.success).toBe(true);
            expect(result.id).toBe('file-to-delete-456');
            expect(mockedAxios.delete).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v3/files/file-to-delete-456',
                expect.objectContaining({
                    headers: { Authorization: 'Bearer mock-access-token-123' },
                })
            );
        });
    });

    describe('4. listFiles', () => {
        it('should list files matching folder parentId', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    files: [
                        { id: 'f1', name: 'img1.png', mimeType: 'image/png' },
                        { id: 'f2', name: 'img2.png', mimeType: 'image/png' },
                    ],
                },
            });

            const result = await googleDrive.listFiles(
                mockCredentials,
                {},
                { parentId: 'folder-123', orderBy: 'name' }
            );

            expect(result.files).toHaveLength(2);
            expect(result.files[0].id).toBe('f1');
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('orderBy=name'),
                expect.any(Object)
            );
        });

        it('should automatically follow nextPageToken and fetch all files across multiple pages', async () => {
            // Page 1
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    files: [{ id: 'file-page-1', name: 'img1.png' }],
                    nextPageToken: 'token-page-2',
                },
            });
            // Page 2
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    files: [{ id: 'file-page-2', name: 'img2.png' }],
                    nextPageToken: undefined,
                },
            });

            const result = await googleDrive.listFiles(
                mockCredentials,
                {},
                { parentId: 'dataset-folder-large', fetchAllPages: true }
            );

            expect(result.files).toHaveLength(2);
            expect(result.files[0].id).toBe('file-page-1');
            expect(result.files[1].id).toBe('file-page-2');
            expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('5. updateFile / renameFile', () => {
        it('should update file name via PATCH', async () => {
            mockedAxios.patch.mockResolvedValueOnce({
                data: { id: 'file-123', name: 'new-name.png' },
            });

            const result = await googleDrive.updateFile(
                mockCredentials,
                { id: 'file-123' },
                { newName: 'new-name.png' }
            );

            expect(result.name).toBe('new-name.png');
            expect(mockedAxios.patch).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v3/files/file-123',
                { name: 'new-name.png' },
                expect.any(Object)
            );
        });
    });

    describe('6. getAccessToken', () => {
        it('should exchange refresh token if access token not provided', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'fresh-new-token-999' }),
            });

            const token = await googleDrive.getAccessToken(
                { refreshToken: 'my-refresh-token', clientId: 'c-id', clientSecret: 'c-sec' },
                {},
                {}
            );

            expect(token).toBe('fresh-new-token-999');
        });
    });

    describe('7. deleteFolderContents', () => {
        it('should list and delete all files in a folder', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    files: [
                        { id: 'file-a', name: 'a.png' },
                        { id: 'file-b', name: 'b.png' },
                    ],
                },
            });
            mockedAxios.delete.mockResolvedValue({ data: {} });

            const onProgress = jest.fn();
            const result = await googleDrive.deleteFolderContents(
                mockCredentials,
                { id: 'target-folder-clear' },
                { onProgress }
            );

            expect(result.deletedCount).toBe(2);
            expect(mockedAxios.delete).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenCalledWith(100, 2, 2);
        });
    });
});
