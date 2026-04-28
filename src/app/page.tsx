import Link from 'next/link';
import { Mail, Gamepad2, GraduationCap, Briefcase } from 'lucide-react';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import HomeCountryCarousel from '@/components/home/HomeCountryCarousel';
import HomePassportShowcase from '@/components/home/HomePassportShowcase';
import { OrbitingAvatarsCTA } from '@/components/ui/orbiting-avatars';

const ACTIVITY_STEPS = [
  {
    step: '01',
    title: 'Story Read',
    desc: '그림책을 읽고 감정 스티커와 한줄 감상을 남깁니다',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    dotColor: 'bg-amber-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    ),
  },
  {
    step: '02',
    title: 'Hidden Stories',
    desc: '영상, 사진, 문서 등 교사가 준비한 문화 콘텐츠를 탐험합니다',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    dotColor: 'bg-emerald-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
    ),
  },
  {
    step: '03',
    title: 'Expanding World',
    desc: '책에 대한 질문을 만들며 세계를 넓히고 생각을 깊이 합니다',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
    dotColor: 'bg-sky-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    ),
  },
  {
    step: '04',
    title: 'My World',
    desc: '나만의 이야기를 창작하고 그림책으로 완성합니다',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    dotColor: 'bg-violet-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    ),
  },
];

const CTA_AVATARS = [
  { src: '/generated-copyright-safe/country-colombia.jpg', alt: '콜롬비아' },
  { src: '/generated-copyright-safe/country-tanzania.jpg', alt: '탄자니아' },
  { src: '/generated-copyright-safe/country-cambodia.jpg', alt: '캄보디아' },
  { src: '/generated-copyright-safe/country-nepal.jpg', alt: '네팔' },
  { src: '/generated-copyright-safe/country-rwanda.jpg', alt: '르완다' },
  { src: '/generated-copyright-safe/country-kenya.jpg', alt: '케냐' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden">
      <HomeHeroSection />

      <div id="after-hero" className="h-24 bg-gradient-to-b from-[#08080d] to-white sm:h-32" />

      <HomeCountryCarousel />

      <section className="relative bg-white px-8 py-20 sm:px-12 sm:py-28 md:px-20 lg:px-28">
        <div className="mx-auto mb-16 max-w-5xl">
          <p className="mb-3 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-muted sm:text-xs">
            Activities
          </p>
          <h2 className="text-2xl font-heading font-bold text-foreground sm:text-3xl md:text-4xl">
            네 가지 독서 활동
          </h2>
          <p className="mt-3 max-w-lg text-sm text-muted">
            책 한 권마다 네 가지 활동을 완료하고 도장을 모아 나만의 독서 여권을 완성하세요
          </p>
        </div>

        <div className="mx-auto hidden max-w-5xl md:block">
          <div className="relative">
            <div className="absolute left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] top-6 h-px bg-border" />

            <div className="grid grid-cols-4 gap-6">
              {ACTIVITY_STEPS.map((item) => (
                <div key={item.title} className="flex flex-col items-center text-center">
                  <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${item.iconBg}`}>
                    <svg className={`h-5 w-5 ${item.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {item.icon}
                    </svg>
                  </div>
                  <p className="mt-5 text-[10px] font-heading font-medium uppercase tracking-[0.2em] text-muted">{item.step}</p>
                  <h3 className="mt-1 text-sm font-heading font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 max-w-[180px] text-xs leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-sm md:hidden">
          <div className="relative pl-10">
            <div className="absolute bottom-3 left-[19px] top-3 w-px bg-border" />

            <div className="space-y-8">
              {ACTIVITY_STEPS.map((item) => (
                <div key={item.title} className="relative flex items-start gap-4">
                  <div className={`absolute -left-10 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${item.iconBg}`}>
                    <svg className={`h-4 w-4 ${item.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {item.icon}
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-heading font-medium uppercase tracking-[0.2em] text-muted">{item.step}</p>
                    <h3 className="mt-0.5 text-sm font-heading font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HomePassportShowcase />

      <OrbitingAvatarsCTA
        className="!h-[80vh] !rounded-none bg-foreground"
        title={<span className="font-heading text-white">이야기로 세계를 연결하세요</span>}
        description={<span className="text-white/50">지금 바로 디지털 독서 여권을 시작하세요</span>}
        buttonText={<Link href="/login">시작하기</Link>}
        buttonProps={{
          asChild: true,
          className: 'rounded-full bg-white px-10 py-3 text-sm font-heading font-semibold tracking-wide text-foreground hover:bg-white/90',
        }}
        avatars={CTA_AVATARS}
        orbitRadius={18}
        orbitDuration={50}
      />

      <footer className="border-t border-black/[0.06] bg-white px-8 py-16 sm:px-12 sm:py-20 md:px-20 lg:px-28">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 sm:flex-row sm:items-start sm:gap-0">
          <div className="shrink-0 sm:w-[220px]">
            <p className="mb-3 text-base font-heading font-bold tracking-tight text-foreground">
              World Stories
            </p>
            <p className="text-xs text-black/35">
              &copy; 2026 Park Junhyo
            </p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3">
            <div>
              <p className="mb-4 text-sm font-heading font-medium text-black/40">Services</p>
              <ul className="space-y-3">
                <li>
                  <a href="https://for-teacher-ai.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    For Teacher AI
                  </a>
                </li>
                <li>
                  <a href="https://class-game-dun.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
                    Sinwol Quest
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-sm font-heading font-medium text-black/40">Contact</p>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:jhjhpark0800@gmail.com" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    Email
                  </a>
                </li>
                <li>
                  <a href="https://www.linkedin.com/in/junhyo-park-b96996394" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/odnaw.t/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-sm font-heading font-medium text-black/40">Developer</p>
              <ul className="space-y-3">
                <li>
                  <a href="https://homepage-omega-three.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    Portfolio
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
