// @react-pdf Image components do not use HTML alt attributes
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const h = React.createElement;

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: "#ffffff",
  },
  cardContainer: {
    width: 242,
    height: 385,
    margin: "auto",
    border: "0.8pt solid #cbd5e1",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
  },
  // 1. Header Area
  logoSection: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 68,
    height: 82,
    backgroundColor: "#0b3578",
    borderBottomRightRadius: 20,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWhiteCircle: {
    width: 48,
    height: 48,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 40,
    height: 40,
    objectFit: "contain",
  },
  headerTextSection: {
    position: "absolute",
    top: 6,
    left: 74,
    right: 6,
    zIndex: 10,
  },
  collegeCode: {
    fontSize: 17,
    fontWeight: "black",
    color: "#000000",
    letterSpacing: 0.5,
  },
  collegeName: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0b3578",
    marginTop: 0.5,
  },
  collegeAddress: {
    fontSize: 6,
    color: "#000000",
    marginTop: 1,
    fontWeight: "bold",
  },
  tel: {
    fontSize: 6,
    color: "#000000",
    fontWeight: "bold",
    marginTop: 0.5,
  },
  headerSpacer: {
    height: 82,
  },
  // 2. Ribbon Title
  ribbonContainer: {
    alignSelf: "flex-end",
    marginTop: 2,
    backgroundColor: "#e91e63",
    paddingVertical: 1.5,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  ribbonText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "black",
    letterSpacing: 0.5,
  },
  // 3. Photo & Info Grid
  gridSection: {
    marginTop: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 8,
  },
  photoBox: {
    width: 78,
    height: 98,
    border: "1.2pt solid #0b3578",
    borderRadius: 3,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  noPhotoBox: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  noPhotoText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#dc2626",
    textAlign: "center",
  },
  infoGrid: {
    flex: 1,
    height: 98,
    border: "0.8pt solid #d32f2f",
    borderRadius: 3,
    backgroundColor: "#fff5f5",
    flexDirection: "column",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  infoRow1: {
    borderBottom: "0.6pt solid #fca5a5",
    paddingBottom: 4,
  },
  infoRow2: {
    borderBottom: "0.6pt solid #fca5a5",
    paddingVertical: 4,
  },
  infoRow3: {
    paddingTop: 4,
  },
  courseValue: {
    fontSize: 9.5,
    fontWeight: "black",
    color: "#000000",
  },
  infoLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#475569",
  },
  infoValue: {
    fontSize: 9.5,
    fontWeight: "black",
    color: "#000000",
  },
  // 4. Student Name & Father Name
  nameSection: {
    marginTop: 6,
    paddingHorizontal: 10,
  },
  studentName: {
    fontSize: 10.5,
    fontWeight: "black",
    color: "#d32f2f",
    textTransform: "uppercase",
    lineHeight: 1.15,
  },
  fatherName: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 2.5,
    lineHeight: 1.15,
  },
  // 5. QR Code & Signature
  bottomRow: {
    marginTop: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  qrBox: {
    width: 46,
    height: 46,
    border: "0.6pt solid #cbd5e1",
    padding: 1,
    backgroundColor: "#ffffff",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  signatureBox: {
    width: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  signatureImg: {
    width: 68,
    height: 26,
    objectFit: "contain",
    marginBottom: 2,
  },
  signatureLine: {
    borderTop: "0.8pt solid #000000",
    width: 65,
    alignItems: "center",
    paddingTop: 1,
  },
  principalLabel: {
    fontSize: 8,
    fontWeight: "black",
    color: "#000000",
    textAlign: "center",
  },
  // 6. Footer Address & Contact
  footerSection: {
    marginTop: "auto",
    marginBottom: 6,
    paddingHorizontal: 8,
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 3,
    alignItems: "center",
  },
  addressLine: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1.15,
  },
  cellLine: {
    fontSize: 7.5,
    fontWeight: "black",
    color: "#000000",
    marginTop: 1,
  },
});

export function IDCardPage({
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
  return h(
    Page,
    { size: [242, 385], style: styles.page },
    h(
      View,
      { style: styles.cardContainer },
      // 1. Header Section
      h(
        View,
        { style: styles.logoSection },
        h(
          View,
          { style: styles.logoWhiteCircle },
          logoUrl ? h(Image, { src: logoUrl, style: styles.logoImage }) : null
        )
      ),
      h(
        View,
        { style: styles.headerTextSection },
        h(Text, { style: styles.collegeCode }, "KUCE&T"),
        h(Text, { style: styles.collegeName }, "KU COLLEGE OF ENGINEERING & TECHNOLOGY"),
        h(Text, { style: styles.collegeAddress }, "KAKATIYA UNIVERSITY CAMPUS"),
        h(Text, { style: styles.collegeAddress }, "VIDYARANYAPURI, WARANGAL 506 009"),
        h(Text, { style: styles.tel }, "Tel: 91- 870 - 2449191")
      ),
      h(View, { style: styles.headerSpacer }),

      // 2. Ribbon
      h(
        View,
        { style: styles.ribbonContainer },
        h(Text, { style: styles.ribbonText }, "IDENTITY CARD")
      ),

      // 3. Photo & Academic Info Grid
      h(
        View,
        { style: styles.gridSection },
        h(
          View,
          { style: styles.photoBox },
          pfpUrl
            ? h(Image, { src: pfpUrl, style: styles.photoImg })
            : h(
                View,
                { style: styles.noPhotoBox },
                h(Text, { style: styles.noPhotoText }, "NO PHOTO")
              )
        ),
        h(
          View,
          { style: styles.infoGrid },
          h(
            View,
            { style: styles.infoRow1 },
            h(Text, { style: styles.courseValue }, `B.Tech (${course || '—'})`)
          ),
          h(
            View,
            { style: styles.infoRow2 },
            h(Text, { style: styles.infoLabel }, "H.T. No:"),
            h(Text, { style: styles.infoValue }, admissionNo || '—')
          ),
          h(
            View,
            { style: styles.infoRow3 },
            h(Text, { style: styles.infoLabel }, "Academic Year:"),
            h(Text, { style: styles.infoValue }, batch || '—')
          )
        )
      ),

      // 4. Student Name & Father Name
      h(
        View,
        { style: styles.nameSection },
        h(Text, { style: styles.studentName }, studentName || 'N/A'),
        h(
          Text,
          { style: styles.fatherName },
          `Father's Name: ${(fatherName || 'N/A').toUpperCase()}`
        )
      ),

      // 5. QR Code & Principal Signature
      h(
        View,
        { style: styles.bottomRow },
        h(
          View,
          { style: styles.qrBox },
          qrUrl ? h(Image, { src: qrUrl, style: styles.qrImg }) : null
        ),
        h(
          View,
          { style: styles.signatureBox },
          signatureUrl ? h(Image, { src: signatureUrl, style: styles.signatureImg }) : null,
          h(
            View,
            { style: styles.signatureLine },
            h(Text, { style: styles.principalLabel }, "Principal")
          )
        )
      ),

      // 6. Footer Address & Contact
      h(
        View,
        { style: styles.footerSection },
        h(Text, { style: styles.addressLine }, address || '—'),
        h(Text, { style: styles.cellLine }, `Cell: ${mobile || '—'}`)
      )
    )
  );
}

export function BulkIDCardPDF({ students = [], logoUrl, signatureUrl }) {
  return h(
    Document,
    null,
    students.map((student, idx) =>
      h(IDCardPage, {
        key: student.admissionNo || student.rollNo || idx,
        ...student,
        logoUrl: logoUrl || student.logoUrl,
        signatureUrl: signatureUrl || student.signatureUrl,
      })
    )
  );
}

export default function IDCardPDF(props) {
  return h(Document, null, h(IDCardPage, props));
}
