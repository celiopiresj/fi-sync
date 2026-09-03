import { ImageResponse } from "next/og";
import { getLogoIconDataUri } from "@/lib/pwa-icon";

export const dynamic = "force-static";

const SIZE = 512;

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
          width={SIZE * 0.8}
          height={SIZE * 0.8}
          alt=""
        />
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
