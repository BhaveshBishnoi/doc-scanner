import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Folder as FolderIcon, Plus, Trash2, Lock } from 'lucide-react-native';
import { MotiView } from 'moti';
import { theme } from '../theme/theme';
import { Folder, getAllFolders, saveFolder, deleteFolder } from '../utils/storage';

const FoldersScreen = () => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const fetchFolders = useCallback(async () => {
        const data = await getAllFolders();
        setFolders(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchFolders();
        }, [fetchFolders])
    );

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const newFolder: Folder = {
            id: Math.random().toString(36).substring(7),
            name: newFolderName.trim(),
            createdAt: Date.now(),
            isLocked: false,
        };
        await saveFolder(newFolder);
        setNewFolderName('');
        setModalVisible(false);
        fetchFolders();
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Delete Folder',
            'Are you sure? All documents inside will be moved to the root section.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteFolder(id);
                        fetchFolders();
                    }
                },
            ]
        );
    };

    const renderItem = ({ item, index }: { item: Folder; index: number }) => (
        <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 50 }}
            style={styles.card}
        >
            <TouchableOpacity style={styles.cardContent}>
                <FolderIcon size={32} color={theme.colors.primary} />
                <View style={styles.textContainer}>
                    <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.folderMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                {item.isLocked && <Lock size={16} color={theme.colors.textMuted} style={styles.lockIcon} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Trash2 size={20} color={theme.colors.error} />
            </TouchableOpacity>
        </MotiView>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={folders}
                numColumns={2}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.columnWrapper}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <FolderIcon size={80} color={theme.colors.border} />
                        <Text style={styles.emptyText}>No Folders</Text>
                        <Text style={styles.emptySubtext}>Create a folder to organize your scans.</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
            >
                <Plus size={32} color="white" />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Folder</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Folder Name"
                            placeholderTextColor={theme.colors.textMuted}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnCreate} onPress={handleCreateFolder}>
                                <Text style={styles.btnCreateText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    listContent: { padding: theme.spacing.sm, paddingBottom: 100 },
    columnWrapper: { justifyContent: 'space-between', paddingHorizontal: theme.spacing.sm },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        flex: 1,
        margin: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    cardContent: { flex: 1 },
    textContainer: { marginTop: theme.spacing.sm },
    folderName: { color: theme.colors.text, fontSize: 16, fontWeight: 'bold' },
    folderMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
    lockIcon: { position: 'absolute', right: 0, top: 0 },
    deleteBtn: { padding: theme.spacing.xs },
    fab: {
        position: 'absolute', bottom: theme.spacing.xl, right: theme.spacing.xl,
        width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary,
        justifyContent: 'center', alignItems: 'center', elevation: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4,
    },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: theme.colors.text, fontSize: 20, fontWeight: '600', marginTop: theme.spacing.lg },
    emptySubtext: { color: theme.colors.textMuted, fontSize: 14, marginTop: theme.spacing.sm },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg },
    modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md },
    input: { backgroundColor: theme.colors.background, color: theme.colors.text, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md },
    btnCancel: { padding: theme.spacing.md },
    btnCancelText: { color: theme.colors.textMuted, fontWeight: '600' },
    btnCreate: { padding: theme.spacing.md, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
    btnCreateText: { color: 'white', fontWeight: 'bold' }
});

export default FoldersScreen;
