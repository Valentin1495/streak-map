import { createRoute } from '@granite-js/react-native';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Button, colors } from '@toss/tds-react-native';

export const Route = createRoute('/about', {
  component: Page,
});

function Page() {
  const navigation = Route.useNavigation();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About Granite</Text>
      <Text style={styles.description}>Granite is a powerful and flexible React Native Framework 🚀</Text>
      <Button
        type="primary"
        style="fill"
        size="large"
        onPress={handleGoBack}
        viewStyle={styles.button}
        containerStyle={styles.buttonContainer}
      >
        Go Back
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.grey50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.grey900,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: colors.grey700,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 26,
  },
  button: {
    marginTop: 24,
  },
  buttonContainer: {
    borderRadius: 8,
  },
});
