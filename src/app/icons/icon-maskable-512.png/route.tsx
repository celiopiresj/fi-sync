import { ImageResponse } from "next/og";
import { getLogoIconDataUri } from "@/lib/pwa-icon";

export const dynamic = "force-static";

const SIZE = 512;

// Maskable icons get cropped to a circle/rounded-square by the OS, so the
// logo must stay within the safe zone (the inner ~80% of the canvas) — see
// https://www.w3.org/TR/appmanifest/#dfn-maskable-icons. Scaling the logo
// down to 60% (well inside that safe zone) keeps it clear of any mask shape.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getLogoIconDataUri()}
          width={SIZE * 0.6}
          height={SIZE * 0.6}
          alt=""
        />
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
