import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import SceneStage from "@/components/SceneStage";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display face: questions and big numbers
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
});

// The accent: a serif italic for the one stressed word in a headline or question
const accent = Instrument_Serif({
  variable: "--font-accent-face",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "howitworks",
  description: "See the CS idea inside the app you use every day",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${accent.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The 3D city sits behind every page and stays alive between them */}
        <SceneStage />
        {children}
      </body>
    </html>
  );
}
