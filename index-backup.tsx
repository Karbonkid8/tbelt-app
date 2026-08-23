function performClear() {
  setValues({
    ...emptyValues,
  });

  setPartialStart(null);

  // Immediately update saved PWA data while keeping recipient.
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined'
  ) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          values: emptyValues,
          phoneNumber,
          partialStart: null,
        })
      );
    } catch (error) {
      console.log('Could not clear saved entry:', error);
    }
  }
}

function clearEntry() {
  // Web / PWA
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