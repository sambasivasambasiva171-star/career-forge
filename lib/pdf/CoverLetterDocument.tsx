import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: 10,
  },
})

export function CoverLetterDocument({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {paragraphs.map((para, i) => (
          <Text key={i} style={styles.paragraph}>{para}</Text>
        ))}
      </Page>
    </Document>
  )
}
