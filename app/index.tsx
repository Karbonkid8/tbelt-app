import React, { useMemo, useRef, useState } from 'react';

import {
  Alert,
  Linking,
  Platform,
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

const emptyValues: Record<StationKey, string> = {
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
};

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
  const [values, setValues] =
    useState<Record<StationKey, string>>({
      ...emptyValues,
    });

  const [partialStart, setPartialStart] =
    useState<StationKey | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('');

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const inputRefs = useRef<Record<StationKey, TextInput | null>>({
    b1s5: null,
    b1s4: null,
    b1s3: null,
    b1s2: null,
    b1s1: null,
    b2s5: null,
    b2s4: null,
    b2s3: null,
    b2s2: null,
    b2s1: null,
  });

  function updateValue(key: StationKey, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function togglePartialStart(key: StationKey) {
    setPartialStart((current) =>
      current === key ? null : key
    );
  }

  function focusNextInput(currentKey: StationKey) {
    const currentIndex = stationRows.findIndex(
      (row) => row.key === currentKey
    );

    const nextRow = stationRows[currentIndex + 1];

    if (nextRow) {
      inputRefs.current[nextRow.key]?.focus();
    }
  }

  const messagePreview = useMemo(() => {
    const buildLine = (
      key: StationKey,
      station: number
    ) => {
      const value = values[key].trim();

      const marker =
        partialStart === key
          ? ' Partial/Start'
          : '';

      return `Stn${station}:${value ? ` ${value}` : ''}${marker}`;
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

  function performClear() {
    setValues({
      ...emptyValues,
    });

    setPartialStart(null);
  }

  function clearEntry() {
    // Browser / PWA
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      const confirmed = window.confirm(
        'Clear all station values and the Partial/Start selection? The recipient will stay saved.'
      );

      if (confirmed) {
        performClear();
      }

      return;
    }

    // Android / iPhone
    Alert.alert(
      'Clear Entry?',
      'This will clear all station values and the Partial/Start selection. The recipient will stay saved.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: performClear,
        },
      ]
    );
  }

  async function sendText() {
    const phone = phoneNumber.trim();

    if (!phone) {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.alert(
          'Enter the recipient phone number before sending.'
        );
      } else {
        Alert.alert(
          'Phone Number Required',
          'Enter the recipient phone number before sending.'
        );
      }

      setRecipientOpen(true);
      return;
    }

    const encodedMessage =
      encodeURIComponent(messagePreview);

    const smsUrl =
      `sms:${phone}?body=${encodedMessage}`;

    try {
      // Browser / PWA
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.location.href = smsUrl;
        return;
      }

      // Android / iPhone
      const supported =
        await Linking.canOpenURL(smsUrl);

      if (!supported) {
        Alert.alert(
          'Unable to Open Messages',
          'This device could not open the text messaging app.'
        );

        return;
      }

      await Linking.openURL(smsUrl);
    } catch {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.alert(
          'The text messaging app could not be opened.'
        );
      } else {
        Alert.alert(
          'Something Went Wrong',
          'The text messaging app could not be opened.'
        );
      }
    }
  }

  function renderBelt(beltNumber: 1 | 2) {
    const rows = stationRows.filter(
      (row) => row.belt === beltNumber
    );

    return (
      <View style={styles.beltSection}>
        <Text style={styles.beltTitle}>
          T-Belt {beltNumber}
        </Text>

        {rows.map((row, index) => {
          const isSelected =
            partialStart === row.key;

          const isShaded =
            index % 2 === 1;

          const globalIndex =
            stationRows.findIndex(
              (stationRow) =>
                stationRow.key === row.key
            );

          const isLastInput =
            globalIndex ===
            stationRows.length - 1;

          return (
            <View
              key={row.key}
              style={[
                styles.row,
                isShaded &&
                  styles.rowShaded,
              ]}
            >
              <Text style={styles.stationLabel}>
                Stn{row.station}:
              </Text>

              <TextInput
                ref={(ref) => {
                  inputRefs.current[row.key] = ref;
                }}
                value={values[row.key]}
                onChangeText={(text) =>
                  updateValue(row.key, text)
                }
                placeholder="Value"
                keyboardType="numeric"
                returnKeyType={
                  isLastInput
                    ? 'done'
                    : 'next'
                }
                blurOnSubmit={isLastInput}
                onSubmitEditing={() => {
                  if (!isLastInput) {
                    focusNextInput(row.key);
                  }
                }}
                style={styles.stationInput}
              />

              <TouchableOpacity
                style={[
                  styles.partialButton,
                  isSelected &&
                    styles.partialButtonSelected,
                ]}
                onPress={() =>
                  togglePartialStart(row.key)
                }
              >
                <Text
                  style={[
                    styles.partialButtonText,
                    isSelected &&
                      styles.partialButtonTextSelected,
                  ]}
                >
                  Partial
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>
          T-Belt Entry
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.smallHeaderButton,
              recipientOpen &&
                styles.smallHeaderButtonActive,
            ]}
            onPress={() =>
              setRecipientOpen(
                (current) => !current
              )
            }
          >
            <Text
              style={
                styles.smallHeaderButtonText
              }
            >
              Recipient
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallHeaderButton,
              previewOpen &&
                styles.smallHeaderButtonActive,
            ]}
            onPress={() =>
              setPreviewOpen(
                (current) => !current
              )
            }
          >
            <Text
              style={
                styles.smallHeaderButtonText
              }
            >
              Preview
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {recipientOpen && (
        <View style={styles.inlinePanel}>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Recipient phone number"
            keyboardType="phone-pad"
            style={styles.phoneInput}
          />

          <TouchableOpacity
            style={styles.closePanelButton}
            onPress={() =>
              setRecipientOpen(false)
            }
          >
            <Text
              style={
                styles.closePanelButtonText
              }
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {previewOpen && (
        <View style={styles.previewPanel}>
          <Text style={styles.previewText}>
            {messagePreview}
          </Text>
        </View>
      )}

      <View style={styles.beltsContainer}>
        {renderBelt(1)}
        {renderBelt(2)}
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearEntry}
        >
          <Text style={styles.clearButtonText}>
            Clear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendText}
        >
          <Text style={styles.sendButtonText}>
            Send Text
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingTop: 42,
    paddingBottom: 8,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },

  headerButtons: {
    flexDirection: 'row',
    gap: 6,
  },

  smallHeaderButton: {
    borderWidth: 1,
    borderColor: '#c8ccd1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },

  smallHeaderButtonActive: {
    backgroundColor: '#e5e7eb',
  },

  smallHeaderButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
  },

  inlinePanel: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },

  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c9cdd2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 15,
    backgroundColor: '#fff',
  },

  closePanelButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },

  closePanelButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },

  previewPanel: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },

  previewText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#222',
  },

  beltsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 6,
  },

  beltSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 7,
  },

  beltTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    paddingHorizontal: 3,
    color: '#111',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 41,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    gap: 6,
  },

  rowShaded: {
    backgroundColor: '#e9edf1',
  },

  stationLabel: {
    width: 46,
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },

  stationInput: {
    flex: 1,
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#c9cdd2',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  partialButton: {
    width: 64,
    borderWidth: 1,
    borderColor: '#b7bcc2',
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  partialButtonSelected: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },

  partialButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
  },

  partialButtonTextSelected: {
    color: '#fff',
  },

  bottomButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  clearButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },

  clearButtonText: {
    color: '#222',
    fontSize: 17,
    fontWeight: '700',
  },

  sendButton: {
    flex: 2,
    backgroundColor: '#111',
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});