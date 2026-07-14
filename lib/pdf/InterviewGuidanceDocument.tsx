import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 12,
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 4,
    borderBottom: '1pt solid #000000',
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  entryBlock: {
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  bodyText: {
    fontSize: 11,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#444444',
  },
  bullet: {
    fontSize: 11,
    marginLeft: 12,
    marginBottom: 2,
  },
})

export interface InterviewGuidanceData {
  cv_changes: Array<{ section: string; what_changed: string; why: string }>
  strengths_to_emphasize: Array<{ title: string; description: string; cvEvidence: string }>
  common_question_types: Array<{ type: string; guidance: string }>
  interview_day_checklist: string[]
}

export function InterviewGuidanceDocument({ data }: { data: InterviewGuidanceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Interview Guidance</Text>
        <Text style={styles.subtitle}>
          What changed in your tailored CV, why, and how to talk about it.
        </Text>

        <Text style={styles.sectionTitle}>What Changed In Your CV</Text>
        {data.cv_changes.length === 0 ? (
          <Text style={styles.bodyText}>
            Your original CV already aligned closely with this job description — no major rewrites were needed.
          </Text>
        ) : (
          data.cv_changes.map((change, i) => (
            <View key={i} style={styles.entryBlock}>
              <Text style={styles.entryTitle}>{change.section}</Text>
              <Text style={styles.bodyText}>{change.what_changed}</Text>
              <Text style={styles.bodyText}>
                <Text style={styles.label}>Why: </Text>
                {change.why}
              </Text>
            </View>
          ))
        )}

        {data.strengths_to_emphasize.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Strengths To Emphasize</Text>
            {data.strengths_to_emphasize.map((s, i) => (
              <View key={i} style={styles.entryBlock}>
                <Text style={styles.entryTitle}>{s.title}</Text>
                <Text style={styles.bodyText}>{s.description}</Text>
                <Text style={styles.bodyText}>
                  <Text style={styles.label}>From your CV: </Text>
                  {s.cvEvidence}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Question Types To Prepare For</Text>
        {data.common_question_types.map((q, i) => (
          <View key={i} style={styles.entryBlock}>
            <Text style={styles.entryTitle}>{q.type}</Text>
            <Text style={styles.bodyText}>{q.guidance}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Interview Day Checklist</Text>
        {data.interview_day_checklist.map((item, i) => (
          <Text key={i} style={styles.bullet}>• {item}</Text>
        ))}
      </Page>
    </Document>
  )
}
