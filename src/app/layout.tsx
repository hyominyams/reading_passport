import type { Metadata } from 'next';
import { Jua, Gowun_Dodum } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthProvider';
import './globals.css';

const jua = Jua({
  variable: '--font-jua',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const gowunDodum = Gowun_Dodum({
  variable: '--font-gowun-dodum',
  subsets: ['latin'],
  weight: '400',
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
    <html lang="ko" className={`${jua.variable} ${gowunDodum.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
