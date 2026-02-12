import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
      fontFamily: "Times-Roman",
      fontSize: 16,
      color: "#000",
      padding: 40, // approx ~15mm equivalent
      borderWidth: 4,
      borderColor: "#000",
      borderStyle: "solid",
      position: "relative",
    },
    container: {
      borderWidth: 2,
      padding: 20,
      minHeight: "100%",
      position: "relative",
    },
    certId: {
      position: "absolute",
      top: 6,
      right: 6,
      fontSize: 9,
      color: "#555",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 5,
      width: "100%",
    },
    logo: {
      width: 95,
      height: 95,
      marginRight: 15,
    },
    collegeDetails: {
      flexGrow: 2,
    },
    collegeName: {
      marginTop: 30,
      fontSize: 14,
      textTransform: "uppercase",
      fontWeight: "bold",
    },
    collegeAddress: {
      fontSize: 13,
      marginTop: 4,
    },
    hr: {
      borderTopWidth: 2,
      borderTopColor: "#000",
      marginTop: 8,
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
      marginBottom: 15,
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
    },
    watermark: {
      position: "absolute",
      top: -70,
      left: 70, 
      width: 300,
      opacity: 0.12,
      zIndex: -1,
    },
    bold: {
      fontWeight: "bold",
    },
    signatureSection: {
      marginTop: 40,
      marginRight: 20,
      alignSelf: "flex-end",
      alignItems: "flex-end",
      textAlign: "center",
      width: 300,
    },

    signatureImage: {
      width: 140,
    },

    signatureLabel: {
      fontWeight: "bold",
      fontSize: 14,
      borderTopWidth: 1,
      borderTopColor: "#000",
      paddingTop: 1,
      marginRight: 30
    },
    qrSection: {
      position: "absolute",
      bottom: 30,
      left: 30,
      alignItems: "center",
      width: 100,
    },
    qrImage: {
      height: 80,
      width: 80,
    },
    qrLabel: {
      fontSize: 7,
      fontFamily: "Helvetica",
      marginTop: 4,
      fontWeight: "bold",
    }
});
