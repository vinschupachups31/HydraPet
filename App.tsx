import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from './src/diag/ErrorBoundary';
import { Report } from './src/diag/Report';
import { diag } from './src/diag/diagStore';
import { MODELS } from './src/pet/models';
import { Home, TestId } from './src/screens/Home';
import { TestCube } from './src/screens/TestCube';
import { TestModel } from './src/screens/TestModel';
import { Hud } from './src/ui/Hud';
import { useView } from './src/pet/viewStore';

// toute erreur JavaScript non rattrapée est notée dans le rapport (avant d'être transmise à Expo)
const EU = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: Error, f?: boolean) => void; setGlobalHandler: (h: (e: Error, f?: boolean) => void) => void } }).ErrorUtils;
if (EU) {
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((e, fatal) => { diag.error('js-error', e); previous(e, fatal); });
}

export default function App() {
  const [test, setTest] = useState<TestId | null>(null);
  const view = useView();
  useEffect(() => { diag.step('app', 'ok', 'Application JavaScript démarrée'); }, []);

  const pick = (t: TestId) => { diag.reset(); diag.step('app', 'ok', 'Application JavaScript démarrée'); setTest(t); };
  const back = () => { setTest(null); };

  if (!test) {
    return (
      <View style={styles.root}>
        <Home onPick={pick} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ErrorBoundary id="screen" onBack={back}>
        {test === 'cube' && <TestCube />}
        {test === 'notex' && <TestModel model={MODELS['fox-notex']} label="sans texture" shadows={false} />}
        {test === 'embedded' && <TestModel model={MODELS.fox} label="texture intégrée" shadows={false} />}
        {test === 'noshadow' && <TestModel model={MODELS.fox} label="scène, sans ombres" shadows={false} />}
        {test === 'scene' && <TestModel model={MODELS.fox} label="scène, avec ombres" shadows />}
        {(test === 'noshadow' || test === 'scene') && <Hud />}
      </ErrorBoundary>
      <View style={styles.top} pointerEvents="box-none">
        <Pressable testID="btn-back" accessibilityRole="button" onPress={back} style={styles.back}><Text style={styles.backText}>← Menu</Text></Pressable>
      </View>
      {!(test === 'noshadow' || test === 'scene') && <View style={styles.report} pointerEvents="none"><Report compact /></View>}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F3EC' },
  top: { position: 'absolute', top: 40, right: 12 },
  back: { minHeight: 48, minWidth: 96, borderRadius: 20, backgroundColor: '#F7F3EC', borderWidth: 1, borderColor: '#E3E7DF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  backText: { color: '#26352D', fontWeight: '700' },
  report: { position: 'absolute', left: 12, right: 12, bottom: 160 },
});
