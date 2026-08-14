import React from "react";
import { Image } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function CertificateWatermark({ imageUrl, style }) {
  if (!imageUrl) return null;
  return <Image src={imageUrl} style={{ ...styles.watermark, ...style }} alt="Watermark" />;
}
