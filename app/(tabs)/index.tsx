import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type StationKey =
  | 'b1s5'
  | 'b1s4'
  | 'b1s3'
  | 'b1s2'
  | 'b1s1'
  | 'b2s5'
  | 'b2s4'
  | 'b2s3'
  | 'b2s2'
  | 'b2s1';

const stationRows = [
  { belt: 1, station: 5, key: 'b1s5' as StationKey },
  { belt: 1, station: 4, key: 'b1s4' as StationKey },
  { belt: 1, station: 3, key: 'b1s3' as StationKey },
  { belt: 1, station: 2, key: 'b1s2' as StationKey },
  { belt: 1, station: 1, key: 'b1s1' as StationKey },

  { belt: 2, station: 5, key: 'b2s5' as StationKey },
  { belt: 2, station: 4, key: 'b2s4' as StationKey },
  { belt: 2, station: 3, key: 'b2s3' as StationKey },
  { belt: 2, station: 2, key: 'b2s2' as StationKey },
  { belt: 2, station: 1, key: 'b2s1' as StationKey },
];

export default function HomeScreen() {
  const [values, setValues] = useState<Record<StationKey, string>>({
    b1s5: '',
    b1s4: '',
    b1s3: '',
    b1s2: '',
    b1s1: '',
    b2s5: '',
    b2s4: '',
    b2s3: '',
    b2s2: '',
    b2s1: '',
  });

  const [partialStart, setPartialStart] = useState<StationKey | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('');

  function updateValue(key: StationKey, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function togglePartialStart(key: StationKey) {
    setPartialStart((current) => (current === key ? null : key));
  }

  const messagePreview = useMemo(() => {
    const buildLine = (key: StationKey, station: number) => {
      const value = values[key].trim();
      const marker = partialStart === key ? ' Partial/Start' : '';

      return `Stn ${station}${value ? ` ${value}` : ''}${marker}`;
    };

    return [
      'T-Belt 1',
      buildLine('b1s5', 5),
      buildLine('b1s4', 4),
      buildLine('b1s3', 3),
      buildLine('b1s2', 2),
      buildLine('b1s1', 1),
      '',
      'T-Belt 2',
      buildLine('b2s5', 5),
      buildLine('b2s4', 4),
      buildLine('b2s3', 3),
      buildLine('b2s2', 2),
      buildLine('b2s1', 1),
    ].join('\n');
  }, [values, partialStart]);

  async function sendText() {
    const phone = phoneNumber.trim();

    if (!phone) {
      Alert.alert(
        'Phone Number Required',
        'Enter the recipient phone number before sending.'
      );
      return;
    }

    const encodedMessage = encodeURIComponent(messagePreview);

    const smsUrl = `sms:${phone}?body=${encodedMessage}`;

    try {
      const supported = await Linking.canOpenURL(smsUrl);

      if (!supported) {
        Alert.alert(
          'Unable to Open Messages',
          'This device could not open the text messaging app.'
        );
        return;
      }

      await Linking.openURL(smsUrl);
    } catch (error) {
      Alert.alert(
        'Something Went Wrong',
        'The text messaging app could not be opened.'
      );
    }
  }

  function renderBelt(beltNumber: 1 | 2) {
    const rows = stationRows.filter((row) => row.belt === beltNumber);

    return (
      <View style={styles.section}>
        <Text style={styles.beltTitle}>T-Belt {beltNumber}</Text>

        {rows.map((row) => {
          const isSelected = partialStart === row.key;

          return (
            <View key={row.key} style={styles.row}>
              <Text style={styles.stationLabel}>Stn {row.station}</Text>

              <TextInput
                value={values[row.key]}
                onChangeText={(text) => updateValue(row.key, text)}
                placeholder="Value"
                keyboardType="numeric"
                style={styles.input}
              />

              <TouchableOpacity
                style={[
                  styles.partialButton,
                  isSelected && styles.partialButtonSelected,
                ]}
                onPress={() => togglePartialStart(row.key)}
              >
                <Text
                  style={[
                    styles.partialButtonText,
                    isSelected && styles.partialButtonTextSelected,
                  ]}
                >
                  Partial/Start
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>T-Belt Entry</Text>

      <Text style={styles.subtitle}>
        Enter the station values and select one Partial/Start line.
      </Text>

      <View style={styles.section}>
        <Text style={styles.beltTitle}>Recipient</Text>

        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Phone number"
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>

      {renderBelt(1)}

      {renderBelt(2)}

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Message Preview</Text>

        <Text style={styles.previewText}>{messagePreview}</Text>
      </View>

      <TouchableOpacity
        style={styles.sendButton}
        onPress={sendText}
      >
        <Text style={styles.sendButtonText}>Send Text</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  container: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 50,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 6,
    color: '#111',
  },

  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },

  beltTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },

  stationLabel: {
    width: 52,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },

  input: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  partialButton: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    backgroundColor: '#f7f7f7',
  },

  partialButtonSelected: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },

  partialButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },

  partialButtonTextSelected: {
    color: '#fff',
  },

  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    marginBottom: 18,
  },

  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#111',
  },

  previewText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#222',
  },

  sendButton: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});