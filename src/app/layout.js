import { Geist, Plus_Jakarta_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: {
    default: "Estovia — Find Land. Build Opportunities.",
    template: "%s · Estovia",
  },
  description:
    "Discover land, properties and trusted real-estate professionals in one platform. Find land, build opportunities and connect with verified buyers, builders and suppliers.",
  keywords: [
    "real estate",
    "land",
    "property",
    "builders",
    "suppliers",
    "India",
    "Estovia",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">
        {children}
      </body>
    </html>
  );
}
