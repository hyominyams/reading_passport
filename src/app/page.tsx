import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted-light px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-5xl font-bold text-primary mb-4">World Docent</h1>
        <p className="text-lg text-muted mb-8">
          세계 각국의 이야기를 읽고, 캐릭터와 대화하고, 나만의 이야기를 쓰는 글로벌 독서 교육 플랫폼
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors text-lg"
        >
          시작하기
        </Link>
      </div>
    </div>
  );
}
