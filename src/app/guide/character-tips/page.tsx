export const metadata = {
  title: '주인공 디자인 잘하는 법 | World Docent',
};

export default function CharacterTipsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-5xl">🪄</span>
          <h1 className="text-2xl font-bold text-foreground mt-3 mb-2">
            주인공 디자인, 이렇게 하면 돼!
          </h1>
          <p className="text-sm text-gray-500">
            흰 배경의 멋진 캐릭터 시트를 만드는 비결
          </p>
        </div>

        {/* How it works */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">💡</span>
            이 단계에서 무슨 일이 일어나요?
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            여러분이 적어 주는 <strong>생김새</strong>와 <strong>성격</strong>을 보고,
            <strong> 흰 배경 위에 주인공 한 명</strong>이 서 있는
            캐릭터 시트가 만들어져요.
          </p>

          {/* Important callout */}
          <div className="mt-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 p-4">
            <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
              <span>🎯</span> 가장 중요해요!
            </p>
            <p className="text-sm text-amber-900 leading-relaxed">
              여기서 고른 <strong>그림 스타일</strong>과 만든
              <strong> 주인공의 모습</strong>이
              <strong> 그림책 전체</strong>의 분위기를 결정해요.
            </p>
            <p className="text-sm text-amber-900 leading-relaxed mt-2">
              모든 페이지의 그림이 이 캐릭터 시트를 보고 그려져요. 그래서
              주인공이 <strong>매 장면마다 똑같은 얼굴, 똑같은 옷, 똑같은
              그림체</strong>로 나오는 거예요. 처음에 잘 만들어 두는 게
              제일 중요해요!
            </p>
          </div>
        </section>

        {/* Two pillars */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">★</span>
            두 가지면 충분해!
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
              <span className="text-2xl block mb-1">👀</span>
              <p className="text-sm font-bold text-blue-700 mb-1">생김새</p>
              <p className="text-xs text-blue-600">눈에 띄는<br />몇 가지 특징</p>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-center">
              <span className="text-2xl block mb-1">💖</span>
              <p className="text-sm font-bold text-rose-700 mb-1">성격</p>
              <p className="text-xs text-rose-600">어떤 마음을<br />가졌는지 한두 마디</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center leading-relaxed">
            너무 길게 쓰지 않아도 돼요. 짧고 또렷하게 적는 게 더 좋아요!
          </p>
        </section>

        {/* Pillar 1 — Appearance */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">1</span>
            생김새는 이렇게 적어요
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            눈에 잘 띄는 <strong>특징 몇 가지</strong>만 골라서 적어 봐요.
            머리, 얼굴, 옷, 키 같은 것들이요.
          </p>

          {/* Checklist of features */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            {[
              { icon: '💇', label: '머리 모양/색', color: 'bg-amber-50 border-amber-200 text-amber-800' },
              { icon: '👁️', label: '눈/얼굴 특징', color: 'bg-sky-50 border-sky-200 text-sky-800' },
              { icon: '👕', label: '옷차림', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
              { icon: '📏', label: '키/나이대', color: 'bg-violet-50 border-violet-200 text-violet-800' },
            ].map(({ icon, label, color }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${color}`}
              >
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Example */}
          <div className="mb-3">
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;여자아이&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-blue-900">
                  &quot;<strong>곱슬곱슬한 짧은 머리</strong>에
                  <strong> 큰 갈색 눈</strong>,
                  <strong> 빨간 원피스</strong>를 입은 9살 소녀&quot;
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            👉 특징 <strong>3~4가지</strong>면 충분해요. 모든 걸 다 적을 필요는 없어요.
          </p>
        </section>

        {/* Pillar 2 — Personality */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-bold">2</span>
            성격은 한두 마디면 돼요
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            성격은 표정과 자세에 살짝 묻어나요. <strong>짧게 두세 단어</strong>로
            마음의 분위기를 알려 주세요.
          </p>

          {/* Personality chips */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">이런 단어를 써 봐요</p>
            <div className="flex flex-wrap gap-2">
              {[
                { word: '용감한', color: 'bg-red-100 text-red-700 border-red-200' },
                { word: '호기심 많은', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { word: '다정한', color: 'bg-pink-100 text-pink-700 border-pink-200' },
                { word: '장난기 많은', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                { word: '조용한', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                { word: '씩씩한', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                { word: '꿈이 많은', color: 'bg-violet-100 text-violet-700 border-violet-200' },
                { word: '따뜻한', color: 'bg-rose-100 text-rose-700 border-rose-200' },
              ].map(({ word, color }) => (
                <span
                  key={word}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          {/* Example */}
          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">
                  &quot;아침에 일찍 일어나고 동생을 잘 챙기고
                  과학을 좋아하고 운동도 잘하고...&quot;
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-xs text-rose-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-rose-900">
                  &quot;<strong>호기심 많고 용감함</strong>&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cautions */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">⚠️</span>
            이런 건 빼 줘요
          </h2>
          <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-red-400">✗</span>
              <span>
                <strong>다른 친구나 배경 이야기</strong>는 적지 말아요.
                여기는 주인공 <strong>한 명</strong>만 만드는 곳이에요.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">✗</span>
              <span>
                <strong>너무 길게</strong> 쓰면 그림이 헷갈려져요.
                특징 몇 가지만 또렷하게!
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">✗</span>
              <span>
                <strong>장면 묘사</strong>(예: 숲에서 뛰어가는 모습)는
                여기 말고 다음 단계에서 적어요.
              </span>
            </li>
          </ul>
        </section>

        {/* Template */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">📝</span>
            이 틀을 따라 해 봐!
          </h2>

          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5 mb-4">
            <p className="text-xs font-bold text-amber-700 mb-2">외형 설명 칸에는</p>
            <p className="text-sm text-gray-700 leading-loose">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium mr-1">[머리]</span>
              에
              <span className="inline-block px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-xs font-medium mx-1">[얼굴/눈]</span>
              ,
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-medium mx-1">[옷]</span>
              을 입은
              <span className="inline-block px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-medium mx-1">[나이/키]</span>
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 p-5 mb-4">
            <p className="text-xs font-bold text-rose-700 mb-2">성격 칸에는</p>
            <p className="text-sm text-gray-700 leading-loose">
              <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-medium mx-1">[성격 단어 1~2개]</span>
            </p>
          </div>

          <div className="px-4 py-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">완성 예시</p>
            <p className="text-sm text-gray-700 leading-relaxed mb-1">
              <span className="font-bold text-gray-500">외형 — </span>
              &quot;<strong>곱슬곱슬한 검은 머리</strong>에
              <strong> 큰 갈색 눈</strong>,
              <strong> 노란 티셔츠와 청바지</strong>를 입은
              <strong> 10살 소년</strong>&quot;
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-bold text-gray-500">성격 — </span>
              &quot;<strong>장난기 많고 다정함</strong>&quot;
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            이제 돌아가서 내 이야기의 주인공을 만들어 보자!
          </p>
        </div>
      </div>
    </main>
  );
}
