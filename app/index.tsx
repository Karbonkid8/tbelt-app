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

const COLORS = {
  red: '#EE2827',
  charcoal: '#262626',
  darkRed: '#A91E22',
  light: '#E7E7E7',
  gray: '#7C7B7A',
};

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

  const [recipientOpen, setRecipientOpen] =
    useState(true);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const inputRefs = useRef<
    Record<StationKey, TextInput | null>
  >({
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

  function updateValue(
    key: StationKey,
    value: string
  ) {
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
          ? ' Start'
          : '';

      return `Stn${station}:${
        value ? ` ${value}` : ''
      }${marker}`;
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
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      const confirmed = window.confirm(
        'Clear all station values and the Start selection? The recipient will stay saved.'
      );

      if (confirmed) {
        performClear();
      }

      return;
    }

    Alert.alert(
      'Clear Entry?',
      'This will clear all station values and the Start selection. The recipient will stay saved.',
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
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.location.href = smsUrl;
        return;
      }

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
      <View style={styles.beltCard}>
        <View style={styles.beltHeader}>
          <View style={styles.beltHeaderLeft}>
            <View style={styles.miniLogo}>
              <Text style={styles.miniLogoText}>T</Text>
            </View>

            <View>
              <Text style={styles.beltTitle}>
                T-BELT {beltNumber}
              </Text>

              <View style={styles.beltUnderline} />
            </View>
          </View>

          <Text style={styles.startHeaderLabel}>
            START
          </Text>
        </View>

        <View style={styles.divider} />

        {rows.map((row, index) => {
          const isSelected =
            partialStart === row.key;

          const isAlternate =
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
                styles.stationRow,
                isAlternate &&
                  styles.stationRowAlternate,
              ]}
            >
              <View style={styles.stationLabelBox}>
                <Text style={styles.stationLabel}>
                  Stn{row.station}:
                </Text>
              </View>

              <TextInput
                ref={(ref) => {
                  inputRefs.current[row.key] = ref;
                }}
                value={values[row.key]}
                onChangeText={(text) =>
                  updateValue(row.key, text)
                }
                placeholder="Enter value"
                placeholderTextColor={COLORS.gray}
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
                activeOpacity={0.75}
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
                    styles.markerIcon,
                    isSelected &&
                      styles.markerIconSelected,
                  ]}
                >
                  {isSelected ? '●' : '⌖'}
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
        <View style={styles.brandArea}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>T</Text>
            <View style={styles.logoStripe} />
            <Text style={styles.logoSmallText}>
              T-BELT
            </Text>
          </View>

          <View>
            <Text style={styles.brandTitle}>
              T-BELT
            </Text>

            <Text style={styles.brandSubtitle}>
              STATION ENTRY
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.headerButton,
              recipientOpen &&
                styles.headerButtonActive,
            ]}
            onPress={() =>
              setRecipientOpen(
                (current) => !current
              )
            }
          >
            <Text style={styles.headerIcon}>
              {recipientOpen ? '▲' : '▼'}
            </Text>

            <Text style={styles.headerButtonText}>
              ENGINEER'S #
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.headerButton,
              previewOpen &&
                styles.headerButtonActive,
            ]}
            onPress={() =>
              setPreviewOpen(
                (current) => !current
              )
            }
          >
            <Text style={styles.headerIcon}>
              {previewOpen ? '▲' : '▼'}
            </Text>

            <Text style={styles.headerButtonText}>
              PREVIEW
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.redHeaderLine} />

      {recipientOpen && (
        <View style={styles.dropdownPanel}>
          <Text style={styles.panelLabel}>
            ENGINEER'S PHONE NUMBER
          </Text>

          <View style={styles.recipientRow}>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
              style={styles.phoneInput}
            />

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() =>
                setRecipientOpen(false)
              }
            >
              <Text style={styles.doneButtonText}>
                DONE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {previewOpen && (
        <View style={styles.dropdownPanel}>
          <Text style={styles.panelLabel}>
            MESSAGE PREVIEW
          </Text>

          <Text style={styles.previewText}>
            {messagePreview}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {renderBelt(1)}
        {renderBelt(2)}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.clearButton}
          onPress={clearEntry}
        >
          <Text style={styles.clearIcon}>□</Text>

          <Text style={styles.clearButtonText}>
            CLEAR ENTRY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.sendButton}
          onPress={sendText}
        >
          <Text style={styles.sendIcon}>➤</Text>

          <Text style={styles.sendButtonText}>
            SEND REPORT
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.charcoal,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,

    backgroundColor: COLORS.charcoal,
  },

  brandArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  logoBox: {
    width: 58,
    height: 58,

    borderRadius: 8,

    backgroundColor: COLORS.red,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: COLORS.darkRed,
  },

  logoLetter: {
    color: COLORS.light,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 31,
  },

  logoStripe: {
    width: 32,
    height: 2,
    backgroundColor: COLORS.light,
    marginVertical: 2,
  },

  logoSmallText: {
    color: COLORS.light,
    fontSize: 9,
    fontWeight: '900',
  },

  brandTitle: {
    color: COLORS.light,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  brandSubtitle: {
    marginTop: 1,

    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  headerButton: {
    minHeight: 42,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 7,

    paddingHorizontal: 13,

    borderRadius: 7,

    borderWidth: 1,
    borderColor: COLORS.gray,

    backgroundColor: COLORS.charcoal,
  },

  headerButtonActive: {
    borderColor: COLORS.red,
  },

  headerIcon: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '900',
  },

  headerButtonText: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: '800',
  },

  redHeaderLine: {
    height: 4,
    backgroundColor: COLORS.red,
  },

  dropdownPanel: {
    marginHorizontal: 18,
    marginTop: 10,

    padding: 12,

    borderRadius: 10,

    backgroundColor: COLORS.charcoal,

    borderWidth: 1,
    borderColor: COLORS.gray,
  },

  panelLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 7,
  },

  recipientRow: {
    flexDirection: 'row',
    gap: 8,
  },

  phoneInput: {
    flex: 1,

    minHeight: 42,

    paddingHorizontal: 12,

    borderRadius: 7,

    backgroundColor: COLORS.light,

    color: COLORS.charcoal,

    fontSize: 15,
    fontWeight: '600',
  },

  doneButton: {
    justifyContent: 'center',

    paddingHorizontal: 18,

    borderRadius: 7,

    backgroundColor: COLORS.red,
  },

  doneButtonText: {
    color: COLORS.light,
    fontWeight: '800',
  },

  previewText: {
    color: COLORS.light,
    fontSize: 12,
    lineHeight: 17,
  },

  content: {
    flex: 1,

    paddingHorizontal: 18,
    paddingTop: 12,

    gap: 10,
  },

  beltCard: {
    flex: 1,

    paddingHorizontal: 12,
    paddingVertical: 10,

    borderRadius: 11,

    backgroundColor: COLORS.charcoal,

    borderWidth: 1,
    borderColor: COLORS.gray,
  },

  beltHeader: {
    minHeight: 34,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    gap: 9,
  },

  beltHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  miniLogo: {
    width: 24,
    height: 24,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 3,

    borderWidth: 2,
    borderColor: COLORS.red,
  },

  miniLogoText: {
    color: COLORS.red,
    fontWeight: '900',
    fontSize: 14,
  },

  beltTitle: {
    color: COLORS.light,
    fontSize: 18,
    fontWeight: '900',
  },

  beltUnderline: {
    width: 74,
    height: 3,

    marginTop: 4,

    backgroundColor: COLORS.red,
  },

  startHeaderLabel: {
    width: 52,
    textAlign: 'center',

    color: COLORS.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  divider: {
    height: 1,

    marginTop: 8,
    marginBottom: 7,

    backgroundColor: COLORS.gray,
  },

  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',

    minHeight: 48,

    gap: 6,

    paddingVertical: 3,
    paddingHorizontal: 4,

    borderRadius: 7,
  },

  stationRowAlternate: {
    backgroundColor: '#303030',
  },

  stationLabelBox: {
    width: 56,

    alignItems: 'center',
    justifyContent: 'center',

    alignSelf: 'stretch',

    borderRadius: 6,

    backgroundColor: '#202020',
  },

  stationLabel: {
    color: COLORS.light,

    fontSize: 14,
    fontWeight: '800',
  },

  stationInput: {
    flex: 1,
    minWidth: 0,

    height: 42,

    paddingHorizontal: 10,

    borderRadius: 6,

    backgroundColor: COLORS.light,

    color: COLORS.charcoal,

    fontSize: 16,
    fontWeight: '600',

    borderWidth: 1,
    borderColor: COLORS.gray,
  },

  partialButton: {
    width: 52,
    height: 44,
    flexShrink: 0,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 8,

    borderWidth: 2,
    borderColor: COLORS.gray,

    backgroundColor: COLORS.charcoal,
  },

  partialButtonSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.darkRed,
    borderWidth: 3,
  },

  markerIcon: {
    color: COLORS.red,

    fontSize: 21,
    fontWeight: '900',
  },

  markerIconSelected: {
    color: '#FFFFFF',

    fontSize: 25,
    fontWeight: '900',
  },

  bottomBar: {
    flexDirection: 'row',

    gap: 10,

    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,

    backgroundColor: COLORS.charcoal,
  },

  clearButton: {
    flex: 1,

    minHeight: 54,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 10,

    borderRadius: 8,

    borderWidth: 1,
    borderColor: COLORS.gray,

    backgroundColor: COLORS.charcoal,
  },

  clearIcon: {
    color: COLORS.light,
    fontSize: 18,
    fontWeight: '800',
  },

  clearButtonText: {
    color: COLORS.light,

    fontSize: 15,
    fontWeight: '900',
  },

  sendButton: {
    flex: 1.65,

    minHeight: 54,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 10,

    borderRadius: 8,

    backgroundColor: COLORS.red,

    borderWidth: 1,
    borderColor: COLORS.darkRed,
  },

  sendIcon: {
    color: COLORS.light,
    fontSize: 20,
    fontWeight: '900',
  },

  sendButtonText: {
    color: COLORS.light,

    fontSize: 15,
    fontWeight: '900',
  },
});