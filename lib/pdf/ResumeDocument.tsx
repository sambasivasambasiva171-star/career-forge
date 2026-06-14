import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  contactLine: {
    fontSize: 10,
    marginBottom: 12,
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 4,
    borderBottom: '1pt solid #000000',
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  summary: {
    fontSize: 11,
    marginBottom: 4,
  },
  entryTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  entryMeta: {
    fontSize: 10,
    color: '#444444',
    marginBottom: 2,
  },
  bullet: {
    fontSize: 10.5,
    marginLeft: 12,
    marginBottom: 2,
  },
  entryBlock: {
    marginBottom: 8,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillItem: {
    fontSize: 10,
    marginRight: 8,
    marginBottom: 2,
  },
})

interface ResumeData {
  contact: { name: string | null; email: string | null; phone: string | null; location: string | null; linkedin: string | null }
  summary: string | null
  work_experience: Array<{ title: string; company: string; start_date: string | null; end_date: string | null; location: string | null; responsibilities: string[] }>
  education: Array<{ degree: string; institution: string; start_date: string | null; end_date: string | null }>
  skills: string[]
  projects: Array<{ name: string; description: string; technologies: string[] }>
  certifications: string[]
}

export function ResumeDocument({ data }: { data: ResumeData }) {
  const contactParts = [data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedin].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{data.contact.name || 'Candidate Name'}</Text>
        {contactParts.length > 0 && <Text style={styles.contactLine}>{contactParts.join('  |  ')}</Text>}

        {data.summary && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </>
        )}

        {data.skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {data.skills.map((skill, i) => (
                <Text key={i} style={styles.skillItem}>• {skill}</Text>
              ))}
            </View>
          </>
        )}

        {data.work_experience.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {data.work_experience.map((exp, i) => (
              <View key={i} style={styles.entryBlock}>
                <Text style={styles.entryTitle}>{exp.title} — {exp.company}</Text>
                <Text style={styles.entryMeta}>
                  {[exp.start_date, exp.end_date].filter(Boolean).join(' – ')}
                  {exp.location ? `  •  ${exp.location}` : ''}
                </Text>
                {exp.responsibilities.map((r, j) => (
                  <Text key={j} style={styles.bullet}>• {r}</Text>
                ))}
              </View>
            ))}
          </>
        )}

        {data.projects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {data.projects.map((proj, i) => (
              <View key={i} style={styles.entryBlock}>
                <Text style={styles.entryTitle}>{proj.name}</Text>
                <Text style={styles.bullet}>{proj.description}</Text>
                {proj.technologies.length > 0 && (
                  <Text style={styles.entryMeta}>Technologies: {proj.technologies.join(', ')}</Text>
                )}
              </View>
            ))}
          </>
        )}

        {data.education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={styles.entryBlock}>
                <Text style={styles.entryTitle}>{edu.degree} — {edu.institution}</Text>
                <Text style={styles.entryMeta}>{[edu.start_date, edu.end_date].filter(Boolean).join(' – ')}</Text>
              </View>
            ))}
          </>
        )}

        {data.certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {data.certifications.map((cert, i) => (
              <Text key={i} style={styles.bullet}>• {cert}</Text>
            ))}
          </>
        )}
      </Page>
    </Document>
  )
}
