import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { getDatabase } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth/session";
import { accountErrorResponse } from "@/lib/security/request";
import { AccountError } from "@/lib/auth/errors";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser(),
      certificate = await getDatabase().certificate.findFirst({
        where: {
          id: (await params).id,
          revokedAt: null,
          enrollment: { userId: user.id, status: "COMPLETED", revokedAt: null },
        },
      });
    if (!certificate) throw new AccountError("FORBIDDEN", 403);
    const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 60,
      }),
      chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc
      .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .lineWidth(3)
      .stroke("#7bcce7");
    doc.font(
      resolve(
        "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff",
      ),
    );
    doc
      .fillColor("#19253c")
      .fontSize(28)
      .text("أكاديمية العباس", { align: "center", features: ["kern"] });
    doc
      .fontSize(17)
      .text("شهادة إتمام الدورة", { align: "center", features: ["kern"] });
    doc.moveDown();
    doc
      .font(
        resolve(
          "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-600-normal.woff",
        ),
      )
      .fontSize(25)
      .text("Alabbas Academy", { align: "center" });
    doc.fontSize(16).text("Certificate of Completion", { align: "center" });
    doc.moveDown();
    doc.font(
      resolve(
        "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff",
      ),
    );
    if (!/[\u0600-\u06ff]/.test(certificate.learnerName))
      doc.font(
        resolve(
          "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-400-normal.woff",
        ),
      );
    doc
      .fontSize(21)
      .text(certificate.learnerName, { align: "center", features: ["kern"] });
    doc.moveDown();
    doc.font(
      resolve(
        "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff",
      ),
    );
    doc
      .fontSize(18)
      .text(certificate.courseTitleAr, { align: "center", features: ["kern"] });
    doc
      .font(
        resolve(
          "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-400-normal.woff",
        ),
      )
      .fontSize(17)
      .text(certificate.courseTitleEn, { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(certificate.serial, { align: "center" });
    doc.text(
      certificate.issuedAt.toLocaleDateString("en-GB", {
        timeZone: "Asia/Riyadh",
      }),
      { align: "center" },
    );
    doc.end();
    return new Response(new Uint8Array(await result), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${certificate.serial}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
