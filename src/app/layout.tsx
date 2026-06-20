import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"

const geistMonoHeading = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-heading",
})

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const SITE_URL = "https://salamdesk.vercel.app"
const SITE_NAME = "SalamDesk"
const SITE_TITLE = "SalamDesk | Modern AI Helpdesk"
const SITE_DESCRIPTION =
  "Advanced helpdesk solution for modern teams, powered by AI."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: "/android-chrome-512x512.png",
    shortcut: "/android-chrome-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "id_ID",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/android-chrome-512x512.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
        geistMonoHeading.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
