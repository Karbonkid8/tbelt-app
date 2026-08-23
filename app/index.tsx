import React, { useMemo, useRef, useState } from 'react';

import {
  Alert,
  Linking,
  Platform,
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

  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [recipientOpen, setRecipientOpen] =
    useState(true);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const [compactView, setCompactView] =
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

  function togglePartialStart(
    key: StationKey
  ) {
    setPartialStart((current) =>
      current === key ? null : key
    );
  }

  function focusNextInput(
    currentKey: StationKey
  ) {
    const currentIndex =
      stationRows.findIndex(
        (row) => row.key === currentKey
      );

    const nextRow =
      stationRows[currentIndex + 1];

    if (nextRow) {
      inputRefs.current[nextRow.key]?.focus();
    }
  }

  const messagePreview = useMemo(() => {
    const buildLine = (
      key: StationKey,
      station: number
    ) => {
      const value =
        values[key].trim();

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
      const confirmed =
        window.confirm(
          'Clear all station values and the Start selection? The engineer phone number will stay saved.'
        );

      if (confirmed) {
        performClear();
      }

      return;
    }

    Alert.alert(
      'Clear Entry?',
      'This will clear all station values and the Start selection. The engineer phone number will stay saved.',
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
    const phone =
      phoneNumber.trim();

    if (!phone) {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.alert(
          "Enter the engineer's phone number before sending."
        );
      } else {
        Alert.alert(
          'Phone Number Required',
          "Enter the engineer's phone number before sending."
        );
      }

      setRecipientOpen(true);
      return;
    }

    const encodedMessage =
      encodeURIComponent(
        messagePreview
      );

    const smsUrl =
      `sms:${phone}?body=${encodedMessage}`;

    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        window.location.href =
          smsUrl;

        return;
      }

      const supported =
        await Linking.canOpenURL(
          smsUrl
        );

      if (!supported) {
        Alert.alert(
          'Unable to Open Messages',
          'This device could not open the text messaging app.'
        );

        return;
      }

      await Linking.openURL(
        smsUrl
      );
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

  function renderBelt(
    beltNumber: 1 | 2
  ) {
    const rows =
      stationRows.filter(
        (row) =>
          row.belt === beltNumber
      );

    return (
      <View
        style={[
          styles.beltCard,
          compactView &&
            styles.beltCardCompact,
        ]}
      >
        <View
          style={[
            styles.beltHeader,
            compactView &&
              styles.beltHeaderCompact,
          ]}
        >
          <View
            style={
              styles.beltHeaderLeft
            }
          >
            <View
              style={[
                styles.miniLogo,
                compactView &&
                  styles.miniLogoCompact,
              ]}
            >
              <Text
                style={[
                  styles.miniLogoText,
                  compactView &&
                    styles.miniLogoTextCompact,
                ]}
              >
                T
              </Text>
            </View>

            <View>
              <Text
                style={[
                  styles.beltTitle,
                  compactView &&
                    styles.beltTitleCompact,
                ]}
              >
                T-BELT {beltNumber}
              </Text>

              <View
                style={[
                  styles.beltUnderline,
                  compactView &&
                    styles.beltUnderlineCompact,
                ]}
              />
            </View>
          </View>

          <Text
            style={[
              styles.startHeaderLabel,
              compactView &&
                styles.startHeaderLabelCompact,
            ]}
          >
            START
          </Text>
        </View>

        <View
          style={[
            styles.divider,
            compactView &&
              styles.dividerCompact,
          ]}
        />

        {rows.map(
          (row, index) => {
            const isSelected =
              partialStart ===
              row.key;

            const isAlternate =
              index % 2 === 1;

            const globalIndex =
              stationRows.findIndex(
                (stationRow) =>
                  stationRow.key ===
                  row.key
              );

            const isLastInput =
              globalIndex ===
              stationRows.length -
                1;

            return (
              <View
                key={row.key}
                style={[
                  styles.stationRow,

                  isAlternate &&
                    styles.stationRowAlternate,

                  compactView &&
                    styles.stationRowCompact,
                ]}
              >
                <View
                  style={[
                    styles.stationLabelBox,
                    compactView &&
                      styles.stationLabelBoxCompact,
                  ]}
                >
                  <Text
                    style={[
                      styles.stationLabel,
                      compactView &&
                        styles.stationLabelCompact,
                    ]}
                  >
                    Stn
                    {row.station}:
                  </Text>
                </View>

                <TextInput
                  ref={(ref) => {
                    inputRefs.current[
                      row.key
                    ] = ref;
                  }}
                  value={
                    values[
                      row.key
                    ]
                  }
                  onChangeText={(
                    text
                  ) =>
                    updateValue(
                      row.key,
                      text
                    )
                  }
                  placeholder="Enter value"
                  placeholderTextColor={
                    COLORS.gray
                  }
                  keyboardType="numeric"
                  returnKeyType={
                    isLastInput
                      ? 'done'
                      : 'next'
                  }
                  blurOnSubmit={
                    isLastInput
                  }
                  onSubmitEditing={() => {
                    if (
                      !isLastInput
                    ) {
                      focusNextInput(
                        row.key
                      );
                    }
                  }}
                  style={[
                    styles.stationInput,
                    compactView &&
                      styles.stationInputCompact,
                  ]}
                />

                <TouchableOpacity
                  activeOpacity={
                    0.75
                  }
                  style={[
                    styles.markerButton,

                    compactView &&
                      styles.markerButtonCompact,

                    isSelected &&
                      styles.markerButtonSelected,
                  ]}
                  onPress={() =>
                    togglePartialStart(
                      row.key
                    )
                  }
                >
                  <Text
                    style={[
                      styles.markerIcon,

                      compactView &&
                        styles.markerIconCompact,

                      isSelected &&
                        styles.markerIconSelected,
                    ]}
                  >
                    {isSelected
                      ? '●'
                      : '⌖'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          compactView &&
            styles.headerCompact,
        ]}
      >
        <View
          style={
            styles.brandArea
          }
        >
          {!compactView && (
            <View
              style={
                styles.logoBox
              }
            >
              <Text
                style={
                  styles.logoLetter
                }
              >
                T
              </Text>

              <View
                style={
                  styles.logoStripe
                }
              />

              <Text
                style={
                  styles.logoSmallText
                }
              >
                T-BELT
              </Text>
            </View>
          )}

          <View
            style={
              styles.brandText
            }
          >
            <Text
              style={[
                styles.brandTitle,
                compactView &&
                  styles.brandTitleCompact,
              ]}
            >
              T-BELT
            </Text>

            {!compactView && (
              <Text
                style={
                  styles.brandSubtitle
                }
              >
                STATION ENTRY
              </Text>
            )}
          </View>
        </View>

        <View
          style={[
            styles.headerActions,
            compactView &&
              styles.headerActionsCompact,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.headerButton,

              compactView &&
                styles.headerButtonCompact,

              recipientOpen &&
                styles.headerButtonActive,
            ]}
            onPress={() =>
              setRecipientOpen(
                (current) =>
                  !current
              )
            }
          >
            <Text
              style={
                styles.headerIcon
              }
            >
              {recipientOpen
                ? '▲'
                : '▼'}
            </Text>

            <Text
              style={[
                styles.headerButtonText,
                compactView &&
                  styles.headerButtonTextCompact,
              ]}
            >
              ENGINEER'S #
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.headerButton,

              compactView &&
                styles.headerButtonCompact,

              previewOpen &&
                styles.headerButtonActive,
            ]}
            onPress={() =>
              setPreviewOpen(
                (current) =>
                  !current
              )
            }
          >
            <Text
              style={
                styles.headerIcon
              }
            >
              {previewOpen
                ? '▲'
                : '▼'}
            </Text>

            <Text
              style={[
                styles.headerButtonText,
                compactView &&
                  styles.headerButtonTextCompact,
              ]}
            >
              PREVIEW
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.headerButton,

              compactView &&
                styles.headerButtonCompact,

              compactView &&
                styles.headerButtonActive,
            ]}
            onPress={() =>
              setCompactView(
                (current) =>
                  !current
              )
            }
          >
            <Text
              style={
                styles.headerIcon
              }
            >
              {compactView
                ? '■'
                : '□'}
            </Text>

            <Text
              style={[
                styles.headerButtonText,
                compactView &&
                  styles.headerButtonTextCompact,
              ]}
            >
              COMPACT
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={
          styles.redHeaderLine
        }
      />

      {recipientOpen && (
        <View
          style={[
            styles.dropdownPanel,
            compactView &&
              styles.dropdownPanelCompact,
          ]}
        >
          <Text
            style={[
              styles.panelLabel,
              compactView &&
                styles.panelLabelCompact,
            ]}
          >
            ENGINEER'S PHONE NUMBER
          </Text>

          <View
            style={
              styles.recipientRow
            }
          >
            <TextInput
              value={
                phoneNumber
              }
              onChangeText={
                setPhoneNumber
              }
              placeholder="Enter phone number"
              placeholderTextColor={
                COLORS.gray
              }
              keyboardType="phone-pad"
              style={[
                styles.phoneInput,
                compactView &&
                  styles.phoneInputCompact,
              ]}
            />

            <TouchableOpacity
              style={[
                styles.doneButton,
                compactView &&
                  styles.doneButtonCompact,
              ]}
              onPress={() =>
                setRecipientOpen(
                  false
                )
              }
            >
              <Text
                style={[
                  styles.doneButtonText,
                  compactView &&
                    styles.doneButtonTextCompact,
                ]}
              >
                DONE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {previewOpen && (
        <View
          style={[
            styles.dropdownPanel,
            compactView &&
              styles.dropdownPanelCompact,
          ]}
        >
          <Text
            style={[
              styles.panelLabel,
              compactView &&
                styles.panelLabelCompact,
            ]}
          >
            MESSAGE PREVIEW
          </Text>

          <Text
            style={[
              styles.previewText,
              compactView &&
                styles.previewTextCompact,
            ]}
          >
            {messagePreview}
          </Text>
        </View>
      )}

      <ScrollView
        style={
          styles.scrollArea
        }
        contentContainerStyle={[
          styles.content,

          compactView &&
            styles.contentCompact,
        ]}
        showsVerticalScrollIndicator={
          true
        }
        keyboardShouldPersistTaps="handled"
      >
        {renderBelt(1)}
        {renderBelt(2)}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          compactView &&
            styles.bottomBarCompact,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          style={[
            styles.clearButton,
            compactView &&
              styles.actionButtonCompact,
          ]}
          onPress={
            clearEntry
          }
        >
          <Text
            style={[
              styles.clearIcon,
              compactView &&
                styles.actionIconCompact,
            ]}
          >
            □
          </Text>

          <Text
            style={[
              styles.clearButtonText,
              compactView &&
                styles.actionTextCompact,
            ]}
          >
            CLEAR ENTRY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          style={[
            styles.sendButton,
            compactView &&
              styles.actionButtonCompact,
          ]}
          onPress={
            sendText
          }
        >
          <Text
            style={[
              styles.sendIcon,
              compactView &&
                styles.actionIconCompact,
            ]}
          >
            ➤
          </Text>

          <Text
            style={[
              styles.sendButtonText,
              compactView &&
                styles.actionTextCompact,
            ]}
          >
            SEND REPORT
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      width: '100%',
      backgroundColor:
        COLORS.charcoal,
    },

    header: {
      flexDirection: 'row',
      flexWrap: 'wrap',

      justifyContent:
        'space-between',

      alignItems: 'center',

      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 9,

      backgroundColor:
        COLORS.charcoal,

      gap: 8,
    },

    headerCompact: {
      paddingHorizontal: 5,
      paddingTop: 3,
      paddingBottom: 3,

      gap: 3,
    },

    brandArea: {
      flexDirection: 'row',
      alignItems: 'center',

      flexShrink: 1,
      minWidth: 0,

      gap: 9,
    },

    brandText: {
      flexShrink: 1,
      minWidth: 0,
    },

    logoBox: {
      width: 48,
      height: 48,

      flexShrink: 0,

      borderRadius: 7,

      backgroundColor:
        COLORS.red,

      alignItems: 'center',
      justifyContent:
        'center',

      borderWidth: 2,
      borderColor:
        COLORS.darkRed,
    },

    logoLetter: {
      color: COLORS.light,

      fontSize: 25,
      fontWeight: '900',
      lineHeight: 26,
    },

    logoStripe: {
      width: 27,
      height: 2,

      backgroundColor:
        COLORS.light,

      marginVertical: 1,
    },

    logoSmallText: {
      color: COLORS.light,

      fontSize: 8,
      fontWeight: '900',
    },

    brandTitle: {
      color: COLORS.light,

      fontSize: 22,
      fontWeight: '900',

      letterSpacing: 0.3,
    },

    brandTitleCompact: {
      fontSize: 14,
    },

    brandSubtitle: {
      marginTop: 0,

      color: COLORS.gray,

      fontSize: 11,
      fontWeight: '700',

      letterSpacing: 1,
    },

    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',

      flexShrink: 0,

      gap: 6,
    },

    headerActionsCompact: {
      gap: 3,
    },

    headerButton: {
      minHeight: 38,

      flexDirection: 'row',
      alignItems: 'center',

      gap: 5,

      paddingHorizontal: 9,

      borderRadius: 7,

      borderWidth: 1,
      borderColor:
        COLORS.gray,

      backgroundColor:
        COLORS.charcoal,
    },

    headerButtonCompact: {
      minHeight: 26,

      paddingHorizontal: 5,

      gap: 2,
    },

    headerButtonActive: {
      borderColor:
        COLORS.red,
    },

    headerIcon: {
      color: COLORS.red,

      fontSize: 10,
      fontWeight: '900',
    },

    headerButtonText: {
      color: COLORS.light,

      fontSize: 10,
      fontWeight: '800',
    },

    headerButtonTextCompact: {
      fontSize: 8,
    },

    redHeaderLine: {
      height: 3,

      backgroundColor:
        COLORS.red,
    },

    dropdownPanel: {
      marginHorizontal: 12,
      marginTop: 8,

      padding: 9,

      borderRadius: 9,

      backgroundColor:
        COLORS.charcoal,

      borderWidth: 1,
      borderColor:
        COLORS.gray,
    },

    dropdownPanelCompact: {
      marginHorizontal: 5,
      marginTop: 4,

      padding: 5,

      borderRadius: 6,
    },

    panelLabel: {
      color: COLORS.red,

      fontSize: 10,
      fontWeight: '800',

      letterSpacing: 1,

      marginBottom: 6,
    },

    panelLabelCompact: {
      fontSize: 7,

      marginBottom: 3,
    },

    recipientRow: {
      flexDirection: 'row',

      gap: 7,
    },

    phoneInput: {
      flex: 1,
      minWidth: 0,

      height: 38,

      paddingHorizontal: 10,

      borderRadius: 7,

      backgroundColor:
        COLORS.light,

      color:
        COLORS.charcoal,

      fontSize: 15,
      fontWeight: '600',
    },

    phoneInputCompact: {
      height: 27,

      fontSize: 12,

      paddingHorizontal: 6,

      borderRadius: 4,
    },

    doneButton: {
      minWidth: 70,

      justifyContent:
        'center',

      alignItems: 'center',

      paddingHorizontal: 12,

      borderRadius: 7,

      backgroundColor:
        COLORS.red,
    },

    doneButtonCompact: {
      minWidth: 48,

      paddingHorizontal: 6,

      borderRadius: 4,
    },

    doneButtonText: {
      color: COLORS.light,

      fontSize: 12,
      fontWeight: '800',
    },

    doneButtonTextCompact: {
      fontSize: 9,
    },

    previewText: {
      color: COLORS.light,

      fontSize: 12,
      lineHeight: 17,
    },

    previewTextCompact: {
      fontSize: 9,
      lineHeight: 12,
    },

    scrollArea: {
      flex: 1,
      width: '100%',
    },

    content: {
      width: '100%',

      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 10,

      gap: 10,
    },

    contentCompact: {
      paddingHorizontal: 5,
      paddingTop: 4,
      paddingBottom: 4,

      gap: 4,
    },

    beltCard: {
      width: '100%',

      paddingHorizontal: 10,
      paddingVertical: 8,

      borderRadius: 10,

      backgroundColor:
        COLORS.charcoal,

      borderWidth: 1,
      borderColor:
        COLORS.gray,
    },

    beltCardCompact: {
      paddingHorizontal: 5,
      paddingVertical: 4,

      borderRadius: 7,
    },

    beltHeader: {
      minHeight: 30,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      gap: 7,
    },

    beltHeaderCompact: {
      minHeight: 20,
    },

    beltHeaderLeft: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 7,
    },

    miniLogo: {
      width: 22,
      height: 22,

      alignItems: 'center',
      justifyContent:
        'center',

      borderRadius: 3,

      borderWidth: 2,

      borderColor:
        COLORS.red,
    },

    miniLogoCompact: {
      width: 14,
      height: 14,

      borderWidth: 1,
    },

    miniLogoText: {
      color: COLORS.red,

      fontWeight: '900',

      fontSize: 13,
    },

    miniLogoTextCompact: {
      fontSize: 8,
    },

    beltTitle: {
      color: COLORS.light,

      fontSize: 17,
      fontWeight: '900',
    },

    beltTitleCompact: {
      fontSize: 12,
    },

    beltUnderline: {
      width: 68,
      height: 3,

      marginTop: 3,

      backgroundColor:
        COLORS.red,
    },

    beltUnderlineCompact: {
      width: 42,
      height: 2,

      marginTop: 1,
    },

    startHeaderLabel: {
      width: 46,

      textAlign: 'center',

      color: COLORS.red,

      fontSize: 9,
      fontWeight: '900',

      letterSpacing: 0.7,
    },

    startHeaderLabelCompact: {
      width: 32,

      fontSize: 6,
    },

    divider: {
      height: 1,

      marginTop: 6,
      marginBottom: 5,

      backgroundColor:
        COLORS.gray,
    },

    dividerCompact: {
      marginTop: 3,
      marginBottom: 2,
    },

    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',

      minHeight: 42,

      gap: 5,

      paddingVertical: 2,
      paddingHorizontal: 3,

      borderRadius: 6,
    },

    stationRowCompact: {
      minHeight: 28,

      gap: 3,

      paddingVertical: 1,
      paddingHorizontal: 1,
    },

    stationRowAlternate: {
      backgroundColor:
        '#303030',
    },

    stationLabelBox: {
      width: 52,

      alignItems: 'center',
      justifyContent:
        'center',

      alignSelf: 'stretch',

      borderRadius: 5,

      backgroundColor:
        '#202020',
    },

    stationLabelBoxCompact: {
      width: 38,

      borderRadius: 3,
    },

    stationLabel: {
      color: COLORS.light,

      fontSize: 13,
      fontWeight: '800',
    },

    stationLabelCompact: {
      fontSize: 9,
    },

    stationInput: {
      flex: 1,
      minWidth: 0,

      height: 37,

      paddingHorizontal: 9,

      borderRadius: 6,

      backgroundColor:
        COLORS.light,

      color:
        COLORS.charcoal,

      fontSize: 15,
      fontWeight: '600',

      borderWidth: 1,
      borderColor:
        COLORS.gray,
    },

    stationInputCompact: {
      height: 26,

      paddingHorizontal: 5,

      fontSize: 11,

      borderRadius: 4,
    },

    markerButton: {
      width: 46,
      height: 38,

      flexShrink: 0,

      alignItems: 'center',
      justifyContent:
        'center',

      borderRadius: 7,

      borderWidth: 2,
      borderColor:
        COLORS.gray,

      backgroundColor:
        COLORS.charcoal,
    },

    markerButtonCompact: {
      width: 31,
      height: 27,

      borderRadius: 5,
    },

    markerButtonSelected: {
      backgroundColor:
        COLORS.red,

      borderColor:
        COLORS.darkRed,

      borderWidth: 3,
    },

    markerIcon: {
      color: COLORS.red,

      fontSize: 19,

      fontWeight: '900',
    },

    markerIconCompact: {
      fontSize: 13,
    },

    markerIconSelected: {
      color: '#FFFFFF',

      fontSize: 23,

      fontWeight: '900',
    },

    bottomBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',

      gap: 8,

      paddingHorizontal: 12,
      paddingTop: 7,
      paddingBottom: 9,

      backgroundColor:
        COLORS.charcoal,
    },

    bottomBarCompact: {
      gap: 4,

      paddingHorizontal: 5,
      paddingTop: 4,
      paddingBottom: 4,
    },

    clearButton: {
      flex: 1,

      minWidth: 130,
      minHeight: 48,

      flexDirection: 'row',

      alignItems: 'center',
      justifyContent:
        'center',

      gap: 7,

      borderRadius: 7,

      borderWidth: 1,
      borderColor:
        COLORS.gray,

      backgroundColor:
        COLORS.charcoal,
    },

    clearIcon: {
      color: COLORS.light,

      fontSize: 16,

      fontWeight: '800',
    },

    clearButtonText: {
      color: COLORS.light,

      fontSize: 13,
      fontWeight: '900',
    },

    sendButton: {
      flex: 1.65,

      minWidth: 160,
      minHeight: 48,

      flexDirection: 'row',

      alignItems: 'center',
      justifyContent:
        'center',

      gap: 7,

      borderRadius: 7,

      backgroundColor:
        COLORS.red,

      borderWidth: 1,
      borderColor:
        COLORS.darkRed,
    },

    sendIcon: {
      color: COLORS.light,

      fontSize: 18,

      fontWeight: '900',
    },

    sendButtonText: {
      color: COLORS.light,

      fontSize: 13,

      fontWeight: '900',
    },

    actionButtonCompact: {
      minHeight: 34,
    },

    actionIconCompact: {
      fontSize: 12,
    },

    actionTextCompact: {
      fontSize: 9,
    },
  });