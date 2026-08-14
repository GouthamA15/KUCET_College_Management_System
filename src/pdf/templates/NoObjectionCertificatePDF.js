import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function NoObjectionCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  year,
  semester,
  course,
  academicYear,
  casteDisplay,
  category,
  subCaste: _subCaste,
  logoUrl,
  signatureUrl,
  qrUrl,
  purpose,
  fromDate,
  toDate
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
      <CertificateTitle text="NO OBJECTION CERTIFICATE" />

      <View style={styles.content}>
        <Text style={styles.paragraph}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,{" "}
          S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          {casteInfo ? <>(Category/Sub-Caste: <Text style={styles.bold}>{casteInfo}</Text>) </> : null}
          is a Bonafide student of this college studying B.Tech{" "}
          <Text style={styles.bold}>{year}</Text>{" "}Year Semester{" "}
          <Text style={styles.bold}>{semester}</Text>{" "}and branch{" "}
          <Text style={styles.bold}>{course}</Text>{" "}during the academic year{" "}
          <Text style={styles.bold}>{academicYear}</Text>.
          {"\n\n"}
          This certificate states that this Institute has No Objection to the consideration of the application for {" "}
          <Text style={styles.bold}>{purpose}</Text>{" "}
          for the period from <Text style={styles.bold}>{fromDate}</Text>{" "}
          to <Text style={styles.bold}>{toDate}</Text>.
          {"\n\n"}
          This certificate is issued upon the student’s request for official purposes.
        </Text>
      </View>
    </BaseCertificate>
  );
}
