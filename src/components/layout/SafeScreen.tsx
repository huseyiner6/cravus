import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = ViewProps & {
  withPadding?: boolean;
  edges?: ("top"|"bottom"|"left"|"right")[];
};

export default function SafeScreen({
  children,
  withPadding = true,
  edges = ['top','left','right','bottom'],
  style,
  ...rest
}: Props) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: '#fff' }, style]} {...rest}>
      <View style={{ flex: 1, padding: withPadding ? 16 : 0 }}>
        {children}
      </View>
    </SafeAreaView>
  );
}