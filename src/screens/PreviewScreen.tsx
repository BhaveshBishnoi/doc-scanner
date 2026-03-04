import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Modal, TextInput
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Download, ChevronLeft, FileText, RotateCcw, Save, Search, GripVertical, Type, ClipboardPaste } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme/theme';
import { Document, getAllDocuments, updateDocument, ScannedPage } from '../utils/storage';
import { exportToPdf } from '../utils/pdf';
import { RootStackParamList } from '../../App';

type PreviewScreenRouteProp = RouteProp<RootStackParamList, 'Preview'>;
const { width } = Dimensions.get('window');

const PreviewScreen = () => {
    const route = useRoute<PreviewScreenRouteProp>();
    const navigation = useNavigation();
    const { docId } = route.params;

    const [doc, setDoc] = useState<Document | null>(null);
    const [pages, setPages] = useState<ScannedPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [titleModalVisible, setTitleModalVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const [ocrModalVisible, setOcrModalVisible] = useState(false);
    const [extractedText, setExtractedText] = useState('');

    useEffect(() => {
        const fetchDoc = async () => {
            const docs = await getAllDocuments();
            const found = docs.find(d => d.id === docId);
            if (found) {
                setDoc(found);
                setPages(found.pages);
                setNewTitle(found.title);
            }
            setLoading(false);
        };
        fetchDoc();
    }, [docId]);

    const handleExportPdf = async () => {
        if (!doc) return;
        setLoading(true);
        try {
            await exportToPdf({ ...doc, pages });
        } catch (e) {
            Alert.alert('Error', 'Failed to generate PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleExportImages = async () => {
        if (!doc || pages.length === 0) return;
        setLoading(true);
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(pages[0].uri, {
                    dialogTitle: `Share ${doc.title}`,
                });
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to export images');
        } finally {
            setLoading(false);
        }
    };

    const saveChanges = async () => {
        if (!doc) return;
        setLoading(true);
        const updated = { ...doc, pages, title: newTitle };
        await updateDocument(updated);
        setDoc(updated);
        setEditing(false);
        setTitleModalVisible(false);
        setLoading(false);
        Alert.alert('Success', 'Document updated successfully.');
    };

    const handleRotate = async (pageIndex: number) => {
        try {
            setLoading(true);
            const pageToRotate = pages[pageIndex];
            const result = await ImageManipulator.manipulateAsync(
                pageToRotate.uri,
                [{ rotate: 90 }],
                { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
            );

            const newUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}rotated_${Date.now()}.jpg`;
            await FileSystem.copyAsync({ from: result.uri, to: newUri });

            const newPages = [...pages];
            newPages[pageIndex] = { ...pageToRotate, uri: newUri };
            setPages(newPages);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to rotate image');
        } finally {
            setLoading(false);
        }
    };

    const handleExtractText = async (pageIndex: number) => {
        try {
            setLoading(true);
            const targetPage = pages[pageIndex];
            const result = await TextRecognition.recognize(targetPage.uri);

            if (result && result.text && result.text.length > 0) {
                setExtractedText(result.text);
                setOcrModalVisible(true);
            } else {
                Alert.alert('No Text Found', 'Could not detect any text on this page.');
            }
        } catch (error) {
            console.error('OCR Error', error);
            Alert.alert('Error', 'Failed to extract text. Make sure native modules are configured.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyText = async () => {
        await Clipboard.setStringAsync(extractedText);
        Alert.alert('Copied', 'Text copied to clipboard!');
    };

    const renderPageItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ScannedPage>) => {
        const index = getIndex() || 0;
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive || !editing}
                    style={[
                        styles.pageEditorContainer,
                        { backgroundColor: isActive ? theme.colors.surface : 'transparent' }
                    ]}
                >
                    <Image source={{ uri: item.uri }} style={styles.thumbnailImg} />

                    <View style={styles.pageActions}>
                        <Text style={styles.pageLabel}>Page {index + 1}</Text>
                        {editing && (
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleExtractText(index)}>
                                    <Type size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRotate(index)}>
                                    <RotateCcw size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                                <View style={styles.dragHandle} onTouchStart={drag}>
                                    <GripVertical size={24} color={theme.colors.textMuted} />
                                </View>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    if (!doc) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <ChevronLeft color={theme.colors.text} size={28} />
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => editing && setTitleModalVisible(true)}>
                    <Text style={[styles.title, editing && styles.titleEditing]} numberOfLines={1}>
                        {editing ? newTitle : doc.title}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.iconBtn}>
                    {editing ? <Text style={styles.doneText}>Done</Text> : <Text style={styles.editText}>Edit</Text>}
                </TouchableOpacity>
            </View>

            {/* Reorderable List */}
            <DraggableFlatList
                data={pages}
                onDragEnd={({ data }) => setPages(data)}
                keyExtractor={(item) => item.id}
                renderItem={renderPageItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Footer Actions */}
            <View style={styles.footer}>
                <View style={styles.infoBox}>
                    <FileText size={20} color={theme.colors.textMuted} />
                    <Text style={styles.infoText}>{pages.length} Pages</Text>
                </View>

                {editing ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={loading}>
                        {loading ? <ActivityIndicator size="small" color="white" /> : (
                            <>
                                <Save size={24} color="white" />
                                <Text style={styles.exportText}>Save Edits</Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                        <TouchableOpacity style={styles.exportImagesBtn} onPress={handleExportImages} disabled={loading}>
                            <Text style={styles.exportTextSmall}>Share Image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf} disabled={loading}>
                            {loading ? <ActivityIndicator size="small" color="white" /> : (
                                <>
                                    <Download size={24} color="white" />
                                    <Text style={styles.exportText}>PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Title Edit Modal */}
            <Modal visible={titleModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Document</Text>
                        <TextInput
                            style={styles.input}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setTitleModalVisible(false)}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSave} onPress={() => setTitleModalVisible(false)}>
                                <Text style={styles.btnSaveText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* OCR Result Modal */}
            <Modal visible={ocrModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.ocrModalContent}>
                        <Text style={styles.modalTitle}>Extracted Text</Text>
                        <TextInput
                            style={styles.ocrInput}
                            value={extractedText}
                            onChangeText={setExtractedText}
                            multiline
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setOcrModalVisible(false)}>
                                <Text style={styles.btnCancelText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSave} onPress={handleCopyText}>
                                <ClipboardPaste size={18} color="white" style={{ marginRight: 4 }} />
                                <Text style={styles.btnSaveText}>Copy All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Screen Loader */}
            {loading && (
                <View style={styles.fullScreenLoader}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.md, paddingTop: theme.spacing.xl, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    title: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    titleEditing: { textDecorationLine: 'underline', color: theme.colors.primary },
    iconBtn: { padding: theme.spacing.sm },
    editText: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' },
    doneText: { color: theme.colors.secondary, fontSize: 16, fontWeight: '600' },
    listContent: { padding: theme.spacing.md, paddingBottom: 100 },
    pageEditorContainer: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.sm, marginBottom: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border },
    thumbnailImg: { width: 100, height: 140, borderRadius: theme.borderRadius.md, resizeMode: 'cover', backgroundColor: theme.colors.surface },
    pageActions: { flex: 1, marginLeft: theme.spacing.md, justifyContent: 'center' },
    pageLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.md },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: theme.spacing.sm },
    actionBtn: { padding: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border },
    dragHandle: { padding: theme.spacing.sm, marginLeft: 'auto' },
    footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border },
    infoBox: { flexDirection: 'row', alignItems: 'center' },
    infoText: { color: theme.colors.textMuted, fontSize: 14, marginLeft: theme.spacing.sm },
    exportBtn: { backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.full },
    exportImagesBtn: { backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border },
    saveBtn: { backgroundColor: theme.colors.secondary, flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.full },
    exportText: { color: 'white', fontWeight: 'bold', marginLeft: theme.spacing.sm },
    exportTextSmall: { color: theme.colors.text, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg },
    ocrModalContent: { width: '90%', height: '70%', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg },
    modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md },
    input: { backgroundColor: theme.colors.background, color: theme.colors.text, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg },
    ocrInput: { flex: 1, backgroundColor: theme.colors.background, color: theme.colors.text, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md },
    btnCancel: { padding: theme.spacing.md },
    btnCancelText: { color: theme.colors.textMuted, fontWeight: '600' },
    btnSave: { padding: theme.spacing.md, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, flexDirection: 'row', alignItems: 'center' },
    btnSaveText: { color: 'white', fontWeight: 'bold' },
    fullScreenLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }
});

export default PreviewScreen;
