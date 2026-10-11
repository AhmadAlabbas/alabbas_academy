import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
export const runtime = "nodejs";
export async function GET(r: Request) {
  const q = new URL(r.url).searchParams,
    ar = q.get("locale") !== "en",
    title = (
      q.get("title") || (ar ? "أكاديمية العباس" : "Alabbas Academy")
    ).slice(0, 100);
  const font = await readFile(
    resolve(
      "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff",
    ),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f5f7fa",
        padding: 64,
        flexDirection: "column",
        justifyContent: "space-between",
        borderBottom: "20px solid #7bcce7",
        fontFamily: ar ? "Arabic" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", color: "#19253c", fontSize: 28 }}>
        Alabbas Academy
      </div>
      <div
        style={{
          display: "flex",
          color: "#19253c",
          fontSize: 64,
          lineHeight: 1.4,
          direction: ar ? "rtl" : "ltr",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#28778e" }}>
        {ar ? "تعلّم خطوة بخطوة" : "Learn, one step at a time"}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Arabic", data: font, weight: 600, style: "normal" }],
    },
  );
}
