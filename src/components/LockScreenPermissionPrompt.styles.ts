import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E3F0',
  },
  title: {
    color: '#102033',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    marginTop: 12,
    color: '#5B6B7F',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    backgroundColor: '#E9EEF5',
  },
  primaryButton: {
    backgroundColor: '#D9283A',
  },
  secondaryText: {
    color: '#203047',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
