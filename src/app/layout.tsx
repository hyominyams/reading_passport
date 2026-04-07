import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthProvider';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'World Docent - 글로벌 독서 여행',
  description: '세계 각국의 이야기를 읽고, 캐릭터와 대화하고, 나만의 이야기를 쓰는 글로벌 독서 교육 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
