jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    const insets = { top: 0, right: 0, bottom: 0, left: 0 };
    return {
        useSafeAreaInsets: () => insets,
        useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
        SafeAreaProvider: ({ children }: any) => children,
        SafeAreaView: ({ children }: any) => children,
        SafeAreaInsetsContext: React.createContext(insets),
        SafeAreaFrameContext: React.createContext({ x: 0, y: 0, width: 390, height: 844 }),
        initialWindowMetrics: {
            insets,
            frame: { x: 0, y: 0, width: 390, height: 844 },
        },
    };
});

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('react-native-web/dist/cjs/exports/Modal', () => {
    const React = require('react');
    const MockModal = ({ children, visible, testID }: any) => {
        if (!visible) return null;
        return React.createElement('View', { testID }, children);
    };
    return {
        __esModule: true,
        default: MockModal,
    };
});
jest.mock('react-native/Libraries/Modal/Modal', () => {
    const React = require('react');
    const MockModal = ({ children, visible, testID }: any) => {
        if (!visible) return null;
        return React.createElement('View', { testID }, children);
    };
    return {
        __esModule: true,
        default: MockModal,
    };
});
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-symbols', () => ({
    SymbolView: ({ name, fallback }: { name: any; fallback?: any }) =>
        require('react').createElement(
            'Text',
            null,
            typeof fallback === 'string'
                ? fallback
                : typeof name === 'string'
                ? name
                : 'icon'
        ),
}));

const mockDesignSystem = {
    activeSystem: 'paper',
    setActiveSystem: jest.fn(),
    iconsVariant: 'platformOrientedIcons',
    setIconsVariant: jest.fn(),
    isDark: false,
    toggleTheme: jest.fn(),
    tamaguiConfig: {},
    themeColors: {
        primary: '#000',
        background: '#fff',
        surface: '#fff',
        text: '#000',
        border: '#ddd',
        error: '#f00',
        card: '#fff',
    },
};

jest.mock('../kit8/providers/WithDesignSystem', () => ({
    __esModule: true,
    default: require('react').createContext(mockDesignSystem),
    useDesignSystem: () => mockDesignSystem,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AskBeforeDeleteGoogleFile } from '../apps/appClothes1/AskBeforeDeleteGoogleFile';

describe('AskBeforeDeleteGoogleFile Modal Component', () => {
    it('returns null when visible is false', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={false}
                    folderTitle="dataset_shop_images"
                    onDismiss={jest.fn()}
                    onConfirm={jest.fn()}
                    isDeleting={false}
                    deleteProgress={0}
                />
            );
        });

        expect(tree!.toJSON()).toBeNull();
    });

    it('renders "Clear all files?" and folder name when folderTitle is provided (Clear All mode)', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    folderTitle="dataset_shop_images"
                    onDismiss={jest.fn()}
                    onConfirm={jest.fn()}
                    isDeleting={false}
                    deleteProgress={0}
                />
            );
        });

        const titleNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-title' });
        expect(titleNode.props.children).toBe('Clear all files?');

        const targetNameNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-targetName' });
        expect(targetNameNode.props.children).toBe('dataset_shop_images');

        const confirmBtn = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-confirmBtn' });
        expect(confirmBtn).toBeTruthy();
    });

    it('renders "Delete File?" and file name when single file is provided', () => {
        const mockFile = {
            id: 'file-123',
            name: 'sample_cloth.png',
            mimeType: 'image/png',
        };

        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    file={mockFile}
                    onDismiss={jest.fn()}
                    onConfirm={jest.fn()}
                    isDeleting={false}
                    deleteProgress={0}
                />
            );
        });

        const titleNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-title' });
        expect(titleNode.props.children).toBe('Delete File?');

        const targetNameNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-targetName' });
        expect(targetNameNode.props.children).toBe('sample_cloth.png');
    });

    it('triggers onConfirm when confirm button is pressed', () => {
        const onConfirmMock = jest.fn();
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    folderTitle="dataset_trend_images"
                    onDismiss={jest.fn()}
                    onConfirm={onConfirmMock}
                    isDeleting={false}
                    deleteProgress={0}
                />
            );
        });

        const confirmBtn = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-confirmBtn' });
        act(() => {
            confirmBtn.props.onPress();
        });

        expect(onConfirmMock).toHaveBeenCalledTimes(1);
    });

    it('triggers onDismiss when cancel button or backdrop is pressed', () => {
        const onDismissMock = jest.fn();
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    folderTitle="dataset_shop_images"
                    onDismiss={onDismissMock}
                    onConfirm={jest.fn()}
                    isDeleting={false}
                    deleteProgress={0}
                />
            );
        });

        const cancelBtn = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-cancelBtn' });
        act(() => {
            cancelBtn.props.onPress();
        });
        expect(onDismissMock).toHaveBeenCalledTimes(1);

        const backdrop = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-backdrop' });
        act(() => {
            backdrop.props.onPress();
        });
        expect(onDismissMock).toHaveBeenCalledTimes(2);
    });

    it('shows progress bar and status text during active deletion (isDeleting = true)', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    folderTitle="dataset_shop_images"
                    onDismiss={jest.fn()}
                    onConfirm={jest.fn()}
                    isDeleting={true}
                    deleteProgress={65}
                    deleteStatusText="Deleting 13/20 files..."
                />
            );
        });

        const progressNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-progress' });
        expect(progressNode).toBeTruthy();

        const json = JSON.stringify(tree!.toJSON());
        expect(json).toContain('Deleting 13/20 files...');
        expect(json).toContain('65%');
    });

    it('shows completion state when deletion reaches 100%', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <AskBeforeDeleteGoogleFile
                    visible={true}
                    folderTitle="dataset_shop_images"
                    onDismiss={jest.fn()}
                    onConfirm={jest.fn()}
                    isDeleting={true}
                    deleteProgress={100}
                    deleteStatusText="Successfully cleared all files!"
                />
            );
        });

        const titleNode = tree!.root.findByProps({ testID: 'askBeforeDeleteModal-title' });
        expect(titleNode.props.children).toBe('Successfully Cleared!');

        const json = JSON.stringify(tree!.toJSON());
        expect(json).toContain('The folder is now empty.');
        expect(json).toContain('100%');
    });
});
