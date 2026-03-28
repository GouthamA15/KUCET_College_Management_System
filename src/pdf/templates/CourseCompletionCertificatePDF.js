import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function CourseCompletionCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
  aggCgpa,
  completionYear,
  logoUrl,
  signatureUrl,
  qrUrl,
}) {
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={signatureUrl}
      qrUrl={qrUrl}
    >
      <CertificateTitle text="COURSE COMPLETION CERTIFICATE" />

      <View style={styles.content}>
        <Text style={styles.paragraph}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
          {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          is a Bonafide student of this institution and
          studied B.Tech in <Text style={styles.bold}>{course}</Text> Branch
          during the academic year <Text style={styles.bold}>{batch}</Text>.
        </Text>

        <Text style={[styles.paragraph, { marginTop: 15 }]}>
          He has fulfilled the requirements of the course/program and completed his final examination for which the results are also declared.
          He has no standing backlogs and his aggregate CGPA - <Text style={styles.bold}>{aggCgpa}</Text>.
          His Certificates are under process and will be issued in the first week of July {completionYear}.
        </Text>

        <Text style={[styles.paragraph, { marginTop: 15 }]}>
          This Certificate is issued with reference to his application dated {date}.
        </Text>
      </View>
    </BaseCertificate>
  );
}
