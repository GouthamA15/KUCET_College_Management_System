import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: "#fff",
  },
  cardContainer: {
    width: 242, // Roughly 85mm
    height: 385, // Roughly 135mm (Vertical ID card)
    margin: "auto",
    border: "1pt solid #ccc",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  header: {
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    borderBottom: "0.5pt solid #eee",
    zIndex: 10,
  },
  logo: {
    width: 45,
    height: 45,
    marginRight: 6,
  },
  headerTextContainer: {
    flex: 1,
  },
  collegeCode: {
    fontSize: 14,
    fontWeight: "black",
    color: "#000",
  },
  collegeName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0b3578",
    marginTop: 1,
  },
  collegeAddress: {
    fontSize: 6,
    color: "#000",
    marginTop: 2,
    fontWeight: "bold",
  },
  tel: {
    fontSize: 6,
    color: "#000",
    fontWeight: "bold",
  },
  titleBar: {
    backgroundColor: "#e91e63",
    paddingVertical: 3,
    paddingHorizontal: 15,
    alignSelf: "flex-end",
    marginTop: 4,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    zIndex: 10,
  },
  titleText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  mainContent: {
    flexDirection: "row",
    padding: 8,
    marginTop: 5,
    zIndex: 10,
  },
  photoContainer: {
    width: 75,
    height: 95,
    border: "1pt solid #0b3578",
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  infoContainer: {
    flex: 1,
    paddingLeft: 10,
    justifyContent: "center",
  },
  infoRow: {
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000",
  },
  infoValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000",
  },
  nameSection: {
    paddingHorizontal: 8,
    marginTop: 2,
    zIndex: 10,
  },
  studentName: {
    fontSize: 13,
    fontWeight: "black",
    color: "#d32f2f",
    textTransform: "uppercase",
  },
  secondaryInfo: {
    paddingHorizontal: 8,
    marginTop: 5,
    zIndex: 10,
  },
  fatherName: {
    fontSize: 8,
    color: "#000",
    fontWeight: "bold",
  },
  footerSection: {
    flexDirection: "row",
    paddingHorizontal: 8,
    marginTop: 10,
    alignItems: "flex-end",
    zIndex: 10,
  },
  qrContainer: {
    width: 60,
    height: 60,
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  signatureContainer: {
    flex: 1,
    alignItems: "flex-end",
    paddingBottom: 5,
  },
  signatureImage: {
    width: 60,
    height: "auto",
    marginBottom: -2,
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000",
  },
  bottomAddress: {
    marginTop: "auto",
    padding: 8,
    alignItems: "center",
    zIndex: 10,
  },
  addressText: {
    fontSize: 7,
    color: "#000",
    fontWeight: "bold",
    textAlign: "center",
  },
  cellText: {
    fontSize: 8,
    color: "#000",
    fontWeight: "bold",
    marginTop: 2,
  },
  // Background accents
  accentContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 40,
    zIndex: 1,
  },
  blueAccent: {
    position: "absolute",
    top: 45,
    left: 0,
    width: 30,
    height: 100,
    backgroundColor: "#0b3578",
    transform: "skewX(-20deg)",
    marginLeft: -10,
  },
  redAccent: {
    position: "absolute",
    top: 135,
    left: 0,
    width: 30,
    height: 120,
    backgroundColor: "#d32f2f",
    transform: "skewX(-20deg)",
    marginLeft: -10,
  }
});

export default function IDCardPDF({
  studentName,
  fatherName,
  admissionNo,
  course,
  academicYear,
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
          {/* Background Accents */}
          <View style={styles.accentContainer}>
             <View style={styles.blueAccent} />
             <View style={styles.redAccent} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} alt="College Logo" />}
            <View style={styles.headerTextContainer}>
              <Text style={styles.collegeCode}>KUCE&T</Text>
              <Text style={styles.collegeName}>KU COLLEGE OF ENGINEERING</Text>
              <Text style={styles.collegeName}>& TECHNOLOGY</Text>
              <Text style={styles.collegeAddress}>KAKATIYA UNIVERSITY CAMPUS</Text>
              <Text style={styles.collegeAddress}>VIDYARANYAPURI, WARANGAL 506 009</Text>
              <Text style={styles.tel}>Tel: 91- 870 - 2449191</Text>
            </View>
          </View>

          {/* Title Bar */}
          <View style={styles.titleBar}>
            <Text style={styles.titleText}>IDENTITY CARD</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.photoContainer}>
              {pfpUrl ? (
                <Image src={pfpUrl} style={styles.photo} alt="Student Photo" />
              ) : (
                <View style={{ backgroundColor: "#eee", flex: 1 }} />
              )}
            </View>
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>B.Tech ({course})</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>H.T. No: <Text style={styles.infoValue}>{admissionNo}</Text></Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Academic Year: <Text style={styles.infoValue}>{academicYear}</Text></Text>
              </View>
            </View>
          </View>

          {/* Name Section */}
          <View style={styles.nameSection}>
            <Text style={styles.studentName}>{studentName}</Text>
          </View>

          {/* Secondary Info */}
          <View style={styles.secondaryInfo}>
            <Text style={styles.fatherName}>Father&apos;s Name: {fatherName.toUpperCase()}</Text>
          </View>

          {/* Footer Section */}
          <View style={styles.footerSection}>
            <View style={styles.qrContainer}>
              {qrUrl && <Image src={qrUrl} style={styles.qrImage} alt="Verification QR Code" />}
            </View>
            <View style={styles.signatureContainer}>
              {signatureUrl && <Image src={signatureUrl} style={styles.signatureImage} alt="Principal Signature" />}
              <Text style={styles.signatureLabel}>Principal</Text>
            </View>
          </View>

          {/* Bottom Address */}
          <View style={styles.bottomAddress}>
            <Text style={styles.addressText}>{address}</Text>
            <Text style={styles.cellText}>Cell: {mobile}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
