import "./globals.css"; import type {Metadata} from "next";
export const metadata:Metadata={title:"Putra AI",description:"AI assistant platform"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}