/**
 * Edit Profile screen — lets the user update name, position, grade, and team context.
 * Saves to Supabase user_onboarding table and updates planStore profile.
 * Route: /edit-profile
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronDown, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

const POSITIONS = ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center', 'Wing', 'Forward', 'Guard'];
const GRADES    = ['Middle School', 'Freshman (9th)', 'Sophomore (10th)', 'Junior (11th)', 'Senior (12th)', 'College', 'Post-grad / Pro'];

function PickerRow({
  label, value, options, onSelect,
}: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={p.pickerWrap}>
      <Text style={p.fieldLabel}>{label}</Text>
      <TouchableOpacity style={p.pickerBtn} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Text style={[p.pickerValue, !value && p.pickerPlaceholder]}>
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        <ChevronDown size={15} color={Colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={p.pickerDropdown}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[p.pickerOption, value === opt && p.pickerOptionActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Text style={[p.pickerOptionText, value === opt && p.pickerOptionTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={p.fieldWrap}>
      <Text style={p.fieldLabel}>{label}</Text>
      <TextInput
        style={[p.input, multiline && p.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        returnKeyType={multiline ? 'default' : 'done'}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { profile, setProfile } = usePlanStore();

  const [name,     setName]     = useState(profile?.name ?? '');
  const [position, setPosition] = useState(profile?.position ?? '');
  const [grade,    setGrade]    = useState('');
  const [team,     setTeam]     = useState('');
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      // Update planStore profile
      const updatedProfile = {
        ...profile!,
        name:     name.trim() || profile?.name,
        position: position    || profile?.position || '',
      };
      setProfile(updatedProfile);

      // Persist extra fields to Supabase user_onboarding if we have a userId
      if (userId) {
        await supabase
          .from('user_onboarding')
          .upsert({
            user_id:  userId,
            name:     name.trim() || null,
            position: position   || null,
            grade:    grade      || null,
            team:     team       || null,
          }, { onConflict: 'user_id' })
          .select();
      }

      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.error('[edit-profile] save error:', e);
      Alert.alert('Save failed', 'Could not save your profile. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[p.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={p.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <X size={22} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={p.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[p.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={p.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[p.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={p.sectionLabel}>IDENTITY</Text>
          <View style={p.card}>
            <Field
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Your name"
            />
          </View>

          <Text style={p.sectionLabel}>BASKETBALL</Text>
          <View style={p.card}>
            <PickerRow label="Position" value={position} options={POSITIONS} onSelect={setPosition} />
            <View style={p.cardDivider} />
            <PickerRow label="Grade / Level" value={grade} options={GRADES} onSelect={setGrade} />
            <View style={p.cardDivider} />
            <Field
              label="Team (optional)"
              value={team}
              onChange={setTeam}
              placeholder="e.g. Lincoln HS JV, AAU Elite..."
            />
          </View>

          <Text style={p.note}>
            Your profile helps Coach X personalize training plans and feedback.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.hairline,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.3 },
  saveBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },

  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
  },

  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    paddingHorizontal: 16, marginBottom: 24, overflow: 'hidden',
  },
  cardDivider: { height: 1, backgroundColor: Colors.hairline },

  fieldWrap:  { paddingVertical: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    fontSize: 16, color: Colors.textPrimary, fontWeight: '300',
    paddingVertical: 0,  // avoid extra iOS padding
  },
  inputMulti: { height: 72, textAlignVertical: 'top' },

  pickerWrap:        { paddingVertical: 14 },
  pickerBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue:       { fontSize: 16, color: Colors.textPrimary, fontWeight: '300', flex: 1 },
  pickerPlaceholder: { color: Colors.textMuted },
  pickerDropdown: {
    marginTop: 8, borderRadius: 12,
    backgroundColor: Colors.surfaceRecessed,
    borderWidth: 1, borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  pickerOption: { paddingVertical: 11, paddingHorizontal: 14 },
  pickerOptionActive: { backgroundColor: Colors.primarySoft },
  pickerOptionText:   { fontSize: 15, color: Colors.textPrimary, fontWeight: '400' },
  pickerOptionTextActive: { color: Colors.primary, fontWeight: '600' },

  note: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8 },
});
