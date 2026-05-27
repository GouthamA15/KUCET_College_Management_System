import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: "#fff",
  },
  cardContainer: {
    width: 242,
    height: 385,
    margin: "auto",
    border: "0.5pt solid #ccc",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  // 1. Header Area
  logoSection: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 70,
    height: 85,
    backgroundColor: "#0b3578",
    borderBottomRightRadius: 20,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWhiteCircle: {
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "85%",
    height: "85%",
  },
  headerTextSection: {
    position: "absolute",
    top: 8,
    left: 75,
    right: 5,
    zIndex: 10,
  },
  collegeCode: {
    fontSize: 20,
    fontWeight: "black",
    color: "#000",
    letterSpacing: 0.5,
  },
  collegeName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0b3578",
    marginTop: 0,
  },
  collegeAddress: {
    fontSize: 7,
    color: "#000",
    marginTop: 2,
    fontWeight: "bold",
  },
  tel: {
    fontSize: 7,
    color: "#000",
    fontWeight: "bold",
  },
  // 2. Ribbon Title
  titleRibbon: {
    position: "absolute",
    top: 108,
    right: 0,
    width: 135,
    height: 18,
    backgroundColor: "#e91e63",
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  titleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "black",
    letterSpacing: 0.5,
  },
  // 3. Photo and Info Grid
  photoBox: {
    position: "absolute",
    top: 135,
    left: 10,
    width: 85,
    height: 105,
    border: "1.5pt solid #0b3578",
    zIndex: 20,
  },
  studentPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  infoGrid: {
    position: "absolute",
    top: 135,
    left: 100,
    width: 132,
    height: 105,
    border: "0.8pt solid #d32f2f",
    zIndex: 20,
  },
  gridRow: {
    flex: 1,
    borderBottom: "0.8pt solid #d32f2f",
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  gridRowLast: {
    flex: 1,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333",
  },
  gridValue: {
    fontSize: 10.5,
    fontWeight: "black",
    color: "#000",
  },
  // 4. Name Section
  nameSection: {
    position: "absolute",
    top: 250,
    left: 0,
    width: "100%",
    paddingHorizontal: 10,
    zIndex: 20,
  },
  studentName: {
    fontSize: 17,
    fontWeight: "black",
    color: "#d32f2f",
    textTransform: "uppercase",
    textAlign: "left",
  },
  fatherSection: {
    position: "absolute",
    top: 275,
    left: 0,
    width: "100%",
    paddingHorizontal: 10,
    zIndex: 20,
  },
  fatherName: {
    fontSize: 10,
    color: "#000",
    fontWeight: "bold",
  },
  // 5. QR and Signature
  qrBox: {
    position: "absolute",
    top: 295,
    left: 10,
    width: 60,
    height: 60,
    border: "0.5pt solid #ddd",
    padding: 1,
    zIndex: 20,
  },
  signatureArea: {
    position: "absolute",
    top: 295,
    right: 10,
    width: 100,
    alignItems: "center",
    zIndex: 20,
  },
  principalSignImg: {
    width: 75,
    height: "auto",
    marginBottom: -5,
  },
  principalNameGreen: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 1,
  },
  principalLabel: {
    fontSize: 11,
    fontWeight: "black",
    color: "#000",
    borderTop: "1pt solid #000",
    width: 70,
    textAlign: "center",
    paddingTop: 1,
  },
  // 6. Address Footer
  addressFooter: {
    position: "absolute",
    bottom: 10,
    left: 0,
    width: "100%",
    paddingHorizontal: 5,
    alignItems: "center",
    zIndex: 20,
  },
  addressLine: {
    fontSize: 8.5,
    color: "#000",
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
  },
  cellLine: {
    fontSize: 10,
    color: "#000",
    fontWeight: "black",
    marginTop: 2,
  }
});

export default function IDCardPDF({
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
  address,
  mobile,
  pfpUrl,
  logoUrl,
  signatureUrl,
  qrUrl,
}) {
  return (
    <Document>
      <Page size={[242, 385]} style={styles.page}>
        <View style={styles.cardContainer}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoWhiteCircle}>
              {logoUrl && <Image src={logoUrl} style={styles.logoImage} alt="College Logo" />}
            </View>
          </View>

          {/* Header Text */}
          <View style={styles.headerTextSection}>
            <Text style={styles.collegeCode}>KUCE&T</Text>
            <Text style={styles.collegeName}>KU COLLEGE OF ENGINEERING</Text>
            <Text style={styles.collegeName}>& TECHNOLOGY</Text>
            <Text style={styles.collegeAddress}>KAKATIYA UNIVERSITY CAMPUS</Text>
            <Text style={styles.collegeAddress}>VIDYARANYAPURI, WARANGAL 506 009</Text>
            <Text style={styles.tel}>Tel: 91- 870 - 2449191</Text>
          </View>

          {/* Ribbon */}
          <View style={styles.titleRibbon}>
            <Text style={styles.titleText}>IDENTITY CARD</Text>
          </View>

          {/* Photo */}
          <View style={styles.photoBox}>
            {pfpUrl ? (
              <Image src={pfpUrl} style={styles.studentPhoto} alt="Student Photo" />
            ) : (
              <View style={{ backgroundColor: "#eee", flex: 1 }} />
            )}
          </View>

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.gridRow}>
              <Text style={styles.gridValue}>B.Tech ({course})</Text>
            </View>
            <View style={styles.gridRow}>
              <Text style={styles.gridLabel}>H.T. No: <Text style={styles.gridValue}>{admissionNo}</Text></Text>
            </View>
            <View style={styles.gridRowLast}>
              <Text style={styles.gridLabel}>Academic Year: <Text style={styles.gridValue}>{batch}</Text></Text>
            </View>
          </View>

          {/* Name Section */}
          <View style={styles.nameSection}>
            <Text style={styles.studentName}>{studentName}</Text>
          </View>

          {/* Father's Name */}
          <View style={styles.fatherSection}>
            <Text style={styles.fatherName}>Father&apos;s Name: {(fatherName || '').toUpperCase()}</Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrBox}>
            {qrUrl && <Image src={qrUrl} style={{ width: "100%", height: "100%" }} alt="Verification QR Code" />}
          </View>

          {/* Signature Area */}
          <View style={styles.signatureArea}>
            {signatureUrl && <Image src={signatureUrl} style={styles.principalSignImg} alt="Principal Signature" />}
            <Text style={styles.principalNameGreen}>T.M. Reddy</Text>
            <Text style={styles.principalLabel}>Principal</Text>
          </View>

          {/* Footer Address */}
          <View style={styles.addressFooter}>
            <Text style={styles.addressLine}>{address}</Text>
            <Text style={styles.cellLine}>Cell: {mobile}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
