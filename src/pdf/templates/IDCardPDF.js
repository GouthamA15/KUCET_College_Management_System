// @react-pdf Image components do not use HTML alt attributes
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { sanitizeBloodGroup } from "@/lib/id-card-formats";

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
    border: "1.2pt solid #0b3578",
    borderRadius: 12,
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
    borderTopLeftRadius: 10.5,
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
    top: 5,
    left: 72,
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
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#0b3578",
    marginTop: 1,
    lineHeight: 1.15,
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
    objectFit: "contain",
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
    marginTop: 5,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  qrBox: {
    width: 82,
    height: 82,
    border: "0.8pt solid #cbd5e1",
    padding: 2,
    backgroundColor: "#ffffff",
    borderRadius: 3,
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
    width: 70,
    height: 28,
    objectFit: "contain",
    marginBottom: 2,
  },
  signatureLine: {
    borderTop: "0.8pt solid #000000",
    width: 70,
    alignItems: "center",
    paddingTop: 1.5,
  },
  principalLabel: {
    fontSize: 8,
    fontWeight: "black",
    color: "#000000",
    textAlign: "center",
  },
  // 6. Address & Contact
  footerSection: {
    marginTop: 5,
    marginBottom: 6,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  addressLine: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1.2,
  },
  cellLine: {
    fontSize: 9.5,
    fontWeight: "black",
    color: "#000000",
    marginTop: 1.5,
  },

  // -------------------------------------------------------------
  // NEW OFFICIAL TEMPLATE STYLES (Formats 4, 5, 6)
  // Scale factor: ~2.65 px / pt (642x1020 px -> 242x385 pt)
  // -------------------------------------------------------------
  officialContainer: {
    width: 242,
    height: 385,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  officialBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 242,
    height: 385,
  },
  officialPhotoBox: {
    position: "absolute",
    top: 108,
    left: 14,
    width: 64,
    height: 56,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  officialPhotoImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: 2,
  },
  officialNoPhotoBox: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f8fafc",
    border: "0.5pt dashed #cbd5e1",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  officialNoPhotoText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#dc2626",
    textAlign: "center",
  },
  officialCourseBox: {
    position: "absolute",
    top: 112,
    left: 90,
    width: 142,
    height: 18,
    justifyContent: "center",
  },
  officialCourseText: {
    fontSize: 9.5,
    fontWeight: "black",
    color: "#000000",
  },
  officialHtNoBox: {
    position: "absolute",
    top: 135,
    left: 138,
    width: 94,
    height: 15,
    justifyContent: "center",
  },
  officialHtNoText: {
    fontSize: 9,
    fontWeight: "black",
    color: "#000000",
  },
  officialBatchBox: {
    position: "absolute",
    top: 152,
    left: 165,
    width: 68,
    height: 15,
    justifyContent: "center",
  },
  officialBatchText: {
    fontSize: 8.5,
    fontWeight: "black",
    color: "#000000",
  },
  officialNameBox: {
    position: "absolute",
    top: 172,
    left: 12,
    width: 218,
    height: 30,
    justifyContent: "center",
  },
  officialNameText: {
    fontWeight: "black",
    color: "#d32f2f",
    textTransform: "uppercase",
    textAlign: "left",
    lineHeight: 1.15,
  },
  officialFatherBox: {
    position: "absolute",
    top: 204,
    left: 110,
    width: 122,
    height: 16,
    justifyContent: "center",
  },
  officialFatherText: {
    fontWeight: "bold",
    color: "#000000",
    textTransform: "uppercase",
  },
  officialQrBox: {
    position: "absolute",
    top: 226,
    left: 45,
    width: 86,
    height: 86,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  officialQrImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  officialAddressBox: {
    position: "absolute",
    top: 317,
    left: 14,
    width: 214,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  officialAddressText: {
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1.18,
  },
  officialBloodGroupBox: {
    position: "absolute",
    top: 362,
    left: 27,
    width: 55,
    height: 14,
    justifyContent: "center",
  },
  officialBloodGroupText: {
    fontSize: 8.5,
    fontWeight: "black",
    color: "#d32f2f",
  },
  officialCellBox: {
    position: "absolute",
    top: 362,
    left: 120,
    width: 95,
    height: 14,
    justifyContent: "center",
  },
  officialCellText: {
    fontSize: 8.5,
    fontWeight: "black",
    color: "#000000",
  },
});

/**
 * Classic Hand-Crafted Vector Card Layout (Formats 1, 2, 3)
 */
export function IDCardClassicPage({
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
        h(Text, { style: styles.collegeName }, "KU COLLEGE OF ENGINEERING\n& TECHNOLOGY"),
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

/**
 * Official Institutional PNG Template Overlay Layout (Formats 4, 5, 6)
 * Preserves the exact background artwork, institutional logo, headers, ribbon,
 * and the pre-printed blood-drop symbol and Principal seal/signature.
 */
export function IDCardOfficialPage({
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
  address,
  mobile,
  bloodGroup,
  pfpUrl,
  _signatureUrl, // Signature is pre-printed in official background template; never duplicated
  qrUrl,
  templateBgUrl,
}) {
  const cleanBloodGroup = sanitizeBloodGroup(bloodGroup);
  const cleanFatherName = (fatherName && fatherName !== 'N/A') ? String(fatherName).trim().toUpperCase() : '';
  const cleanStudentName = String(studentName || 'STUDENT').trim().toUpperCase();

  // Formatting and adaptive font scaling for student address (must begin with #)
  const formatAddress = (addr) => {
    if (!addr || addr === '—' || addr === 'N/A') return '—';
    const trimmed = String(addr).trim();
    if (trimmed.startsWith('#')) return trimmed;
    return `# ${trimmed}`;
  };
  const cleanAddress = formatAddress(address);

  // Dynamic font sizing for long student names, long father names, and long addresses
  const nameFontSize = cleanStudentName.length > 34 ? 8.2 : cleanStudentName.length > 24 ? 9.2 : 10.5;
  const fatherFontSize = cleanFatherName.length > 25 ? 7.2 : 8.2;
  const addrFontSize = cleanAddress.length > 95 ? 6.5 : cleanAddress.length > 65 ? 7.0 : 7.6;

  return h(
    Page,
    { size: [242, 385], style: styles.page },
    h(
      View,
      { style: styles.officialContainer },
      // 1. Official Background Template Artwork
      templateBgUrl
        ? h(Image, { src: templateBgUrl, style: styles.officialBackground })
        : null,

      // 2. Student Photograph (Bounded neatly above the red line at 168 pt)
      h(
        View,
        { style: styles.officialPhotoBox },
        pfpUrl
          ? h(Image, { src: pfpUrl, style: styles.officialPhotoImg })
          : h(
              View,
              { style: styles.officialNoPhotoBox },
              h(Text, { style: styles.officialNoPhotoText }, "NO PHOTO")
            )
      ),

      // 3. Course Value (Inside top cell of right info table)
      h(
        View,
        { style: styles.officialCourseBox },
        h(Text, { style: styles.officialCourseText }, `B.Tech (${course || '—'})`)
      ),

      // 4. Hall Ticket / Roll Number Value (Beside pre-printed "H.T.No:")
      h(
        View,
        { style: styles.officialHtNoBox },
        h(Text, { style: styles.officialHtNoText }, admissionNo || '—')
      ),

      // 5. Academic Year Value (Beside pre-printed "Academic Year :")
      h(
        View,
        { style: styles.officialBatchBox },
        h(Text, { style: styles.officialBatchText }, batch || '—')
      ),

      // 6. Student Full Name (Dedicated section below Academic Year and below the red line)
      h(
        View,
        { style: styles.officialNameBox },
        h(
          Text,
          { 
            style: { 
              ...styles.officialNameText, 
              fontSize: nameFontSize 
            } 
          }, 
          cleanStudentName
        )
      ),

      // 7. Father's Name Value (Beside pre-printed "Father's Name:")
      cleanFatherName
        ? h(
            View,
            { style: styles.officialFatherBox },
            h(
              Text, 
              { 
                style: { 
                  ...styles.officialFatherText, 
                  fontSize: fatherFontSize 
                } 
              }, 
              cleanFatherName
            )
          )
        : null,

      // 8. Verification QR Code (Centered in designated white QR zone, increased to 86x86 pt)
      h(
        View,
        { style: styles.officialQrBox },
        qrUrl ? h(Image, { src: qrUrl, style: styles.officialQrImg }) : null
      ),

      // Note: Authentic Principal signature & "Principal" label are embedded in the PNG background template.
      // We strictly omit dynamic signature overlay to prevent duplicate rendering.

      // 9. Complete Student Permanent Address (Prefixed with '#', balanced multi-line wrapping)
      h(
        View,
        { style: styles.officialAddressBox },
        h(
          Text, 
          { 
            style: { 
              ...styles.officialAddressText, 
              fontSize: addrFontSize 
            } 
          }, 
          cleanAddress
        )
      ),

      // 10. Blood Group Value (Placed directly beside pre-printed red blood drop symbol)
      cleanBloodGroup
        ? h(
            View,
            { style: styles.officialBloodGroupBox },
            h(Text, { style: styles.officialBloodGroupText }, cleanBloodGroup)
          )
        : null,

      // 11. Contact Cell Number Value (Placed directly beside pre-printed "Cell :" label)
      h(
        View,
        { style: styles.officialCellBox },
        h(Text, { style: styles.officialCellText }, mobile || '—')
      )
    )
  );
}

/**
 * Unified IDCardPage: Dispatches to either Classic or Official Template
 * based on template / cardFormat / format property.
 * Default remains Classic layout for 100% backward compatibility.
 */
export function IDCardPage(props) {
  const isOfficial =
    props?.template === 'official' ||
    String(props?.cardFormat || '').startsWith('official') ||
    String(props?.format || '').startsWith('official') ||
    props?.cardFormat === 4 ||
    props?.cardFormat === 5 ||
    props?.cardFormat === 6;

  if (isOfficial) {
    return IDCardOfficialPage(props);
  }

  return IDCardClassicPage(props);
}

export function BulkIDCardPDF({ students = [], logoUrl, signatureUrl, templateBgUrl, template, cardFormat, format }) {
  return h(
    Document,
    null,
    students.map((student, idx) =>
      h(IDCardPage, {
        key: student.admissionNo || student.rollNo || idx,
        ...student,
        template: student.template || template,
        cardFormat: student.cardFormat || cardFormat,
        format: student.format || format,
        templateBgUrl: student.templateBgUrl || templateBgUrl,
        logoUrl: logoUrl || student.logoUrl,
        signatureUrl: signatureUrl || student.signatureUrl,
      })
    )
  );
}

export default function IDCardPDF(props) {
  return h(Document, null, h(IDCardPage, props));
}

