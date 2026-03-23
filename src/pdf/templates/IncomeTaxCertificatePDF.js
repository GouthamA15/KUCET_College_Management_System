import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function IncomeTaxCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  year,
  semester,
  course,
  feeAmount,
  purpose,
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
      <CertificateTitle text={"FEE PARTICULARS\n\nTO WHOMSOEVER IT MAY CONCERN"} />

      <View style={styles.content}>
        <Text style={styles.paragraph}>
          This is to certify that Mr. / Ms. <Text style={styles.bold}>{studentName}</Text>
          {" "}S/o. / D/o. <Text style={styles.bold}>{fatherName}</Text>
          {" "}is a student of this institution studying B.Tech. <Text style={styles.bold}>{year}</Text> Yr.
          {" "}Semester <Text style={styles.bold}>{semester}</Text> in
          {" "}<Text style={styles.bold}>{course}</Text> branch, bearing Hall Ticket No. <Text style={styles.bold}>{admissionNo}</Text>
          {" "}has <Text style={styles.bold}>paid the Tuition fee an amount of {feeAmount}</Text>.
        </Text>

        <Text style={[styles.paragraph, { marginTop: 15 }]}>
          The fee particulars above are subjected to any modifications by the Government of telangana and Kakatiya University withot any notice.
        </Text>

        <Text style={[styles.paragraph, { marginTop: 15 }]}>
          This certificate is issued in response to his/her application dated {date} for the purpose of <Text style={styles.bold}>{purpose}</Text>.
        </Text>
      </View>
    </BaseCertificate>
  );
}
