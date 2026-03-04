import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Shield, Fingerprint } from 'lucide-react-native';
import { theme } from '../theme/theme';

const SettingsScreen = () => {
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [hasHardware, setHasHardware] = useState(false);

    useEffect(() => {
        (async () => {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            setHasHardware(compatible);
        })();
    }, []);

    const toggleBiometric = async () => {
        if (!biometricEnabled) {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to enable App Lock',
                fallbackLabel: 'Use PIN',
            });
            if (result.success) {
                setBiometricEnabled(true);
            }
        } else {
            setBiometricEnabled(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <View style={styles.iconContainer}>
                            <Fingerprint size={20} color={theme.colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.settingText}>App Lock</Text>
                            <Text style={styles.settingSubtext}>Require authentication to open app</Text>
                        </View>
                    </View>
                    {hasHardware ? (
                        <Switch
                            value={biometricEnabled}
                            onValueChange={toggleBiometric}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                    ) : (
                        <Text style={styles.disabledText}>Unavailable</Text>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
    section: { marginBottom: theme.spacing.xl },
    sectionTitle: { color: theme.colors.textMuted, fontSize: 14, fontWeight: 'bold', marginBottom: theme.spacing.md, textTransform: 'uppercase' },
    settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border },
    settingLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md },
    settingText: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
    settingSubtext: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    disabledText: { color: theme.colors.textMuted, fontSize: 12 }
});

export default SettingsScreen;
