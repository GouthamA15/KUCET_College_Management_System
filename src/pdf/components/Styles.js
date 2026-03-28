import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 14,
    color: "#000",
    padding: 42, // Exactly 15mm as requested in HTML (@page { margin: 15mm; })
  },
  container: {
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10, // Reduced from 20 to move header up
    height: "100%",
    position: "relative",
  },
  certId: {
    position: "absolute",
    top: 10, // Adjusted for new top padding
    right: 20,
    fontSize: 9,
    color: "#555",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 85,
    height: 85,
    marginRight: 5,
  },
  collegeDetails: {
    flexGrow: 1,
    justifyContent: "center",
  },
  collegeName: {
    fontSize: 14,
    textTransform: "uppercase",
    fontWeight: "bold",
    marginTop: 0,
  },
  collegeAddress: {
    fontSize: 13,
    marginTop: 4,
  },
  hr: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    marginTop: 5, // Tightened from 15
    marginBottom: 5,
    width: "100%",
  },
  date: {
    textAlign: "right",
    marginTop: 30,
    marginRight: 30,
    fontSize: 13,
  },
  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 18,
    marginTop: 40,
    marginBottom: 35,
    textTransform: "uppercase",
    textDecoration: "underline",
  },
  content: {
    textAlign: "justify",
    marginHorizontal: 10,
    marginTop: 20,
    position: "relative",
  },
  paragraph: {
    textAlign: "justify",
    lineHeight: 1.6,
    fontSize: 14,
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: "50%",
    width: 300,
    height: 300,
    opacity: 0.15,
    marginLeft: -150,
    marginTop: -75,
    zIndex: -1,
  },
  bold: {
    fontWeight: "bold",
  },
  signatureSection: {
    marginTop: 40,
    marginRight: 20,
    alignSelf: "flex-end",
    textAlign: "center",
    width: 150, // Reduced from 200
  },
  signatureImage: {
    height: 40,
    width: "auto",
    marginBottom: -5,
    alignSelf: "center",
  },
  signatureLabel: {
    fontWeight: "bold",
    fontSize: 14,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 5,
    textAlign: "center",
  },
  qrSection: {
    position: "absolute",
    bottom: 30,
    left: 20, // Perfectly aligned with container padding
    alignItems: "center",
    width: 70, // Matches qrImage width exactly
  },
  qrSectionCenter: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  qrImage: {
    height: 70,
    width: 70,
  },
  qrLabel: {
    fontSize: 7,
    fontFamily: "Helvetica", // Using sans-serif equivalent as requested
    marginTop: 4,
    fontWeight: "bold",
  }
});
