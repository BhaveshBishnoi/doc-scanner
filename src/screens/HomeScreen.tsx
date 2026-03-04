import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    TextInput,
    Platform,
    PermissionsAndroid
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, FileText, Trash2, ChevronRight, Search, LayoutGrid, List } from 'lucide-react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { MotiView, MotiText } from 'moti';
import { theme } from '../theme/theme';
import {
    Document,
    getAllDocuments,
    saveDocument,
    initStorage,
    deleteDocument,
    moveImageToFileSystem
} from '../utils/storage';
import { RootStackParamList } from '../../App';

type NavigationProp = any;

const HomeScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isGridView, setIsGridView] = useState(false);

    const fetchDocs = useCallback(async () => {
        try {
            const docs = await getAllDocuments();
            setDocuments(docs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchDocs();
        }, [fetchDocs])
    );

    useEffect(() => {
        initStorage();
    }, []);

    const handleScan = async () => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: "Camera Permission",
                        message: "App needs camera access to scan documents.",
                        buttonNeutral: "Ask Me Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK"
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission Denied', 'Camera permission is required to scan documents.');
                    return;
                }
            }

            const { scannedImages } = await DocumentScanner.scanDocument({
                maxNumDocuments: 50,
            });

            if (scannedImages && scannedImages.length > 0) {
                setLoading(true);
                const pages = await Promise.all(
                    scannedImages.map(async (uri) => {
                        const localUri = await moveImageToFileSystem(uri);
                        return {
                            id: Math.random().toString(36).substring(7),
                            uri: localUri,
                            timestamp: Date.now(),
                        };
                    })
                );

                const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '_');
                const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '');

                const newDoc: Document = {
                    id: Math.random().toString(36).substring(7),
                    title: `Document_${dateStr}_${timeStr}`,
                    pages,
                    createdAt: Date.now(),
                };

                await saveDocument(newDoc);
                await fetchDocs();
                navigation.navigate('Preview', { docId: newDoc.id });
            }
        } catch (e) {
            console.error('Scanning failed', e);
            Alert.alert('Error', 'Failed to scan document');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Delete Document',
            'Are you sure you want to delete this document?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteDocument(id);
                        fetchDocs();
                    }
                },
            ]
        );
    };

    const filteredDocs = documents
        .filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => b.createdAt - a.createdAt); // Default sort by date desc

    const renderItem = ({ item, index }: { item: Document; index: number }) => (
        <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 50 }}
            style={[styles.card, isGridView && styles.cardGrid]}
        >
            <TouchableOpacity
                style={[styles.cardContent, isGridView && styles.cardContentGrid]}
                onPress={() => navigation.navigate('Preview', { docId: item.id })}
            >
                <View style={[styles.thumbnailContainer, isGridView && styles.thumbnailContainerGrid]}>
                    {item.pages.length > 0 ? (
                        <Image source={{ uri: item.pages[0].uri }} style={styles.thumbnail} />
                    ) : (
                        <FileText size={isGridView ? 60 : 40} color={theme.colors.textMuted} />
                    )}
                </View>
                <View style={[styles.textContainer, isGridView && styles.textContainerGrid]}>
                    <Text style={[styles.docTitle, isGridView && styles.docTitleGrid]} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.docMeta}>
                        {item.pages.length} {item.pages.length === 1 ? 'page' : 'pages'} • {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>
                {!isGridView && <ChevronRight size={20} color={theme.colors.textMuted} />}
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.deleteBtn, isGridView && styles.deleteBtnGrid]}
                onPress={() => handleDelete(item.id)}
            >
                <Trash2 size={20} color={theme.colors.error} />
            </TouchableOpacity>
        </MotiView>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Search color={theme.colors.textMuted} size={20} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search documents..."
                        placeholderTextColor={theme.colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity onPress={() => setIsGridView(!isGridView)} style={styles.viewToggleBtn}>
                    {isGridView ? <List color={theme.colors.text} size={24} /> : <LayoutGrid color={theme.colors.text} size={24} />}
                </TouchableOpacity>
            </View>

            <FlatList
                key={isGridView ? 'grid' : 'list'}
                data={filteredDocs}
                numColumns={isGridView ? 2 : 1}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={isGridView ? styles.columnWrapper : undefined}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <FileText size={80} color={theme.colors.border} />
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No matching documents' : 'No documents scanned yet'}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {searchQuery ? 'Try a different search term' : 'Tap the button below to start scanning'}
                            </Text>
                        </View>
                    ) : null
                }
            />

            {loading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={handleScan}
                activeOpacity={0.8}
            >
                <Plus size={32} color="white" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    listContent: {
        padding: theme.spacing.md,
        paddingBottom: 100,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        padding: theme.spacing.md,
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.full,
        paddingHorizontal: theme.spacing.md,
        height: 44,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    searchInput: {
        flex: 1,
        color: theme.colors.text,
        marginLeft: theme.spacing.sm,
    },
    viewToggleBtn: {
        padding: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        padding: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardGrid: {
        flex: 1,
        flexDirection: 'column',
        marginHorizontal: theme.spacing.xs,
        padding: 0,
        overflow: 'hidden',
    },
    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardContentGrid: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    thumbnailContainer: {
        width: 60,
        height: 60,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginRight: theme.spacing.md,
    },
    thumbnailContainerGrid: {
        width: '100%',
        height: 140,
        borderRadius: 0,
        marginRight: 0,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    textContainer: {
        flex: 1,
    },
    textContainerGrid: {
        padding: theme.spacing.sm,
    },
    docTitle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    docTitleGrid: {
        fontSize: 14,
    },
    docMeta: {
        color: theme.colors.textMuted,
        fontSize: 12,
    },
    deleteBtn: {
        padding: theme.spacing.md,
    },
    deleteBtnGrid: {
        position: 'absolute',
        top: theme.spacing.sm,
        right: theme.spacing.sm,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderRadius: theme.borderRadius.full,
        padding: theme.spacing.sm,
    },
    fab: {
        position: 'absolute',
        bottom: theme.spacing.xl,
        right: theme.spacing.xl,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    emptyState: {
        marginTop: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '600',
        marginTop: theme.spacing.lg,
    },
    emptySubtext: {
        color: theme.colors.textMuted,
        fontSize: 14,
        marginTop: theme.spacing.sm,
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    }
});

export default HomeScreen;
