import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { STORAGE_KEY, DOCUMENTS_FOLDER } from '../constants';

export const FOLDERS_KEY = '@scanned_folders';

export interface ScannedPage {
    id: string;
    uri: string;
    timestamp: number;
}

export interface Document {
    id: string;
    title: string;
    folderId?: string;
    pages: ScannedPage[];
    createdAt: number;
}

export interface Folder {
    id: string;
    name: string;
    createdAt: number;
    isLocked?: boolean;
}

const getBaseDir = () => `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${DOCUMENTS_FOLDER}/`;

export const initStorage = async () => {
    const dir = getBaseDir();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
};

export const saveDocument = async (doc: Document) => {
    const docsJson = await AsyncStorage.getItem(STORAGE_KEY);
    const docs: Document[] = docsJson ? JSON.parse(docsJson) : [];
    docs.unshift(doc);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

export const getAllDocuments = async (): Promise<Document[]> => {
    const docsJson = await AsyncStorage.getItem(STORAGE_KEY);
    return docsJson ? JSON.parse(docsJson) : [];
};

export const updateDocument = async (updatedDoc: Document) => {
    const docs = await getAllDocuments();
    const index = docs.findIndex(d => d.id === updatedDoc.id);
    if (index !== -1) {
        docs[index] = updatedDoc;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }
};

export const getAllFolders = async (): Promise<Folder[]> => {
    const foldersJson = await AsyncStorage.getItem(FOLDERS_KEY);
    return foldersJson ? JSON.parse(foldersJson) : [];
};

export const saveFolder = async (folder: Folder) => {
    const folders = await getAllFolders();
    folders.push(folder);
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
};

export const deleteFolder = async (id: string) => {
    const folders = await getAllFolders();
    const updated = folders.filter(f => f.id !== id);
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));

    // Unassign documents from this folder
    const docs = await getAllDocuments();
    let changed = false;
    const newDocs = docs.map(d => {
        if (d.folderId === id) {
            changed = true;
            return { ...d, folderId: undefined };
        }
        return d;
    });
    if (changed) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
    }
};

export const deleteDocument = async (id: string) => {
    const docsJson = await AsyncStorage.getItem(STORAGE_KEY);
    if (!docsJson) return;
    const docs: Document[] = JSON.parse(docsJson);
    const docToDelete = docs.find(d => d.id === id);

    if (docToDelete) {
        // Delete files
        for (const page of docToDelete.pages) {
            try {
                await FileSystem.deleteAsync(page.uri, { idempotent: true });
            } catch (e) {
                console.error('Failed to delete page file', e);
            }
        }
    }

    const updatedDocs = docs.filter(d => d.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDocs));
};

export const moveImageToFileSystem = async (uri: string): Promise<string> => {
    const fileName = uri.split('/').pop();
    const newPath = `${getBaseDir()}${Date.now()}_${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: newPath });
    return newPath;
};
