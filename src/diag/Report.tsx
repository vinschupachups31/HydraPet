import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { envLines } from './env';
import { useDiagLines } from './diagStore';

const ICON = { run: '…', ok: '✔', fail: '✘' } as const;

/** Rapport lisible : environnement + étapes. Une capture d'écran de ce bloc suffit pour me le transmettre. */
export function Report({ compact }: { compact?: boolean }) {
  const lines = useDiagLines();
  return (
    <View style={styles.box}>
      {!compact && envLines().map((l) => <Text key={l} style={styles.env}>{l}</Text>)}
      <ScrollView style={{ maxHeight: compact ? 150 : 260 }}>
        {lines.length === 0 && <Text style={styles.env}>Aucune étape pour l'instant.</Text>}
        {lines.map((l) => (
          <Text key={l.id} selectable style={[styles.line, l.status === 'fail' && styles.fail, l.status === 'ok' && styles.ok]}>
            {ICON[l.status]} {l.text} <Text style={styles.t}>({l.t.toFixed(1)} s)</Text>
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: 'rgba(247,243,236,0.92)', borderRadius: 16, borderWidth: 1, borderColor: '#E3E7DF', padding: 10, gap: 2 },
  env: { color: '#6C786F', fontSize: 11, lineHeight: 15 },
  line: { color: '#26352D', fontSize: 12, lineHeight: 17 },
  ok: { color: '#3d6b52' },
  fail: { color: '#a33a1c', fontWeight: '700' },
  t: { color: '#6C786F', fontSize: 10 },
});
