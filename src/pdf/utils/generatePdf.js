"use client";
import React from "react";
import { pdf } from "@react-pdf/renderer";

export async function generatePdf(Component, data, filename = "document.pdf") {
  const blob = await pdf(<Component {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
