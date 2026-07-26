import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function BonafideCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  year,
  semester,
  course,
  academicYear,
  attendancePercentage,
  casteDisplay,
  category,
  subCaste,
  logoUrl,
  signatureUrl,
  qrUrl,
  purpose,
}) {
  const casteInfo = casteDisplay || category || '';
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={signatureUrl}
      qrUrl={qrUrl}
    >
      <CertificateTitle text="BONAFIDE CERTIFICATE" />

      <View style={styles.content}>
        <Text style={styles.paragraph}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
          {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          {casteInfo ? <>(Category/Sub-Caste: <Text style={styles.bold}>{casteInfo}</Text>) </> : null}
          is a Bonafide student of this college studying B.Tech
          {" "}<Text style={styles.bold}>{year}</Text>{" "}Year Semester
          {" "}<Text style={styles.bold}>{semester}</Text>{" "}and
          {" "}branch <Text style={styles.bold}>{course}</Text>{" "}during the academic year
          {" "}<Text style={styles.bold}>{academicYear}</Text>.
          {" "}This certificate is issued for <Text style={styles.bold}>{purpose || 'General'}</Text> purpose. His/her percentage of attendance is
          {" "}<Text style={styles.bold}>{attendancePercentage}</Text>.
        </Text>
      </View>
    </BaseCertificate>
  );
}
