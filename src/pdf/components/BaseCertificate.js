import React from "react";
import { Document, Page, View, Text, Font } from "@react-pdf/renderer";
import CertificateHeader from "./CertificateHeader";
import SignatureBlock from "./SignatureBlock";
import QRBlock from "./QRBlock";
import CertificateWatermark from "./CertificateWatermark";
import { styles } from "./Styles";
import { COLLEGE_CONFIG } from "@/lib/college-config";

// Disable automatic word hyphenation globally
Font.registerHyphenationCallback((word) => [word]);

export default function BaseCertificate({
  certId,
  date,
  logoUrl,
  signatureUrl,
  qrUrl,
  showWatermark = true,
  showSignature = true,
  signatureImageStyle,
  qrStyle,
  children
}) {
  return (
    <Document>
      
      <Page size="A4" style={styles.page}>
        {certId ? <Text style={styles.certId}>Certificate ID: {certId}</Text> : null}
        <View style={styles.container}>
          

          <CertificateHeader
            logoUrl={logoUrl}
            collegeName={COLLEGE_CONFIG.name}
            collegeAddress={COLLEGE_CONFIG.address}
          />

          {date ? <Text style={styles.date}>Date: {date}</Text> : null}

          {showWatermark && <CertificateWatermark imageUrl={logoUrl} />}

          {children}

          {showSignature && (
            <SignatureBlock 
              signatureUrl={signatureUrl} 
              imageStyle={signatureImageStyle} 
            />
          )}

          <QRBlock qrUrl={qrUrl} style={qrStyle} />
        </View>
      </Page>
    </Document>
  );
}
