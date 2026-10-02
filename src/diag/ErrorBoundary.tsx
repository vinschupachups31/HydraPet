import { Component, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diag } from './diagStore';

interface Props { id: string; children: ReactNode; onBack?: () => void }
interface State { error: Error | null }

/** Affiche l'erreur réelle à l'écran (au lieu de « Something went wrong »), pour pouvoir me la renvoyer. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { diag.error(this.props.id, error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Erreur pendant ce test</Text>
        <ScrollView style={{ maxHeight: 280 }}>
          <Text selectable style={styles.msg}>{error.message}</Text>
          <Text selectable style={styles.stack}>{(error.stack ?? '').split('\n').slice(0, 8).join('\n')}</Text>
        </ScrollView>
        {this.props.onBack && (
          <Pressable onPress={this.props.onBack} style={styles.btn}><Text style={styles.btnText}>Retour au menu</Text></Pressable>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { margin: 16, padding: 16, borderRadius: 20, backgroundColor: '#F7F3EC', borderWidth: 1, borderColor: '#D9927A', gap: 8 },
  title: { color: '#26352D', fontSize: 18, fontWeight: '700' },
  msg: { color: '#9a3b1f', fontSize: 14, fontWeight: '600' },
  stack: { color: '#6C786F', fontSize: 11, marginTop: 8 },
  btn: { minHeight: 48, borderRadius: 20, backgroundColor: '#749B83', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
});
