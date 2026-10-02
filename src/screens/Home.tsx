import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Report } from '../diag/Report';

export type TestId = 'cube' | 'notex' | 'embedded' | 'scene' | 'noshadow';

const TESTS: { id: TestId; title: string; hint: string }[] = [
  { id: 'cube', title: '1 · Rendu 3D (cube)', hint: 'Aucun fichier : valide expo-gl et React Three Fiber' },
  { id: 'notex', title: '2 · Modèle sans texture', hint: 'Charge le GLB du renard en couleur unie' },
  { id: 'embedded', title: '3 · Modèle avec texture', hint: 'Même GLB avec sa texture intégrée (chemin le plus fragile)' },
  { id: 'noshadow', title: '4 · Scène complète sans ombres', hint: 'Pièce, déplacements, toucher ; ombres coupées' },
  { id: 'scene', title: '5 · Scène complète avec ombres', hint: 'Le test final' },
];

export function Home({ onPick }: { onPick: (t: TestId) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>HydraPet · test technique</Text>
      <Text style={styles.lead}>Lancez les tests dans l'ordre. Notez ce qui marche, et ce qui échoue : l'écran « Rapport » en dessous suffit.</Text>
      {TESTS.map((t) => (
        <Pressable key={t.id} testID={`test-${t.id}`} accessibilityRole="button" onPress={() => onPick(t.id)} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.btnTitle}>{t.title}</Text>
          <Text style={styles.btnHint}>{t.hint}</Text>
        </Pressable>
      ))}
      <Text style={styles.sub}>Rapport</Text>
      <Report />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 56, gap: 10, backgroundColor: '#F7F3EC' },
  title: { color: '#26352D', fontSize: 24, fontWeight: '700' },
  lead: { color: '#6C786F', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  btn: { minHeight: 56, borderRadius: 20, borderWidth: 1, borderColor: '#E3E7DF', backgroundColor: '#fff', padding: 14 },
  btnTitle: { color: '#26352D', fontSize: 16, fontWeight: '700' },
  btnHint: { color: '#6C786F', fontSize: 12, marginTop: 2 },
  sub: { color: '#26352D', fontSize: 16, fontWeight: '700', marginTop: 8 },
});
