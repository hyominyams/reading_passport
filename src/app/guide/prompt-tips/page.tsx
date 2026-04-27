export const metadata = {
  title: '장면 설명 잘하는 법 | World Docent',
};

export default function PromptTipsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-5xl">🎨</span>
          <h1 className="text-2xl font-bold text-foreground mt-3 mb-2">
            장면 설명, 이렇게 하면 돼!
          </h1>
          <p className="text-sm text-gray-500">
            내 이야기 속 그림이 더 멋지게 살아나는 세 가지 비법
          </p>
        </div>

        {/* Three core pillars */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">★</span>
            세 가지만 꼭 기억해!
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
              <span className="text-2xl block mb-1">👤</span>
              <p className="text-sm font-bold text-blue-700 mb-1">주인공 이름</p>
              <p className="text-xs text-blue-600">누가 그림에<br />나오는지 이름 쓰기</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
              <span className="text-2xl block mb-1">🌍</span>
              <p className="text-sm font-bold text-green-700 mb-1">이야기의 배경</p>
              <p className="text-xs text-green-600">어느 나라, 어떤<br />풍경에서 일어나는지</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-center">
              <span className="text-2xl block mb-1">🕰️</span>
              <p className="text-sm font-bold text-purple-700 mb-1">시간과 계절</p>
              <p className="text-xs text-purple-600">언제, 어떤 계절에<br />벌어지는 일인지</p>
            </div>
          </div>
        </section>

        {/* Pillar 1 — Character names */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">1</span>
            주인공 이름을 꼭 넣어 줘!
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            그림 속에 나오는 사람이 <strong>누구인지</strong> 이름으로 알려 줘야,
            매 페이지마다 똑같은 얼굴로 그림이 그려져요.
          </p>

          {/* Example A */}
          <div className="mb-4">
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;남자아이가 춤을 춰요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-blue-900">
                  &quot;<strong>타다오</strong>가 신나게 춤을 춰요.&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Example B — recall scene */}
          <div className="mb-4">
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;어린 시절 친구와 놀았던 추억을 떠올려요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-blue-900">
                  &quot;<strong>어린 타다오</strong>가 친구와 손을 잡고 들판을 뛰어가요.&quot;
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 회상 장면이라면 &quot;어린 ○○&quot;, &quot;예전의 ○○&quot;처럼
                  시기를 같이 적어 줘요.
                </p>
              </div>
            </div>
          </div>

          {/* Small tips callout */}
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
              <span>📌</span> 작은 팁
            </p>
            <ul className="space-y-1.5 text-xs text-amber-900 leading-relaxed">
              <li className="flex gap-1.5">
                <span className="text-amber-500">•</span>
                <span>
                  이름을 붙인 친구들은 <strong>[주인공 만들기]</strong> 단계에서
                  꼭 미리 만들어 둬야 매 페이지에 똑같은 모습으로 나와요.
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-amber-500">•</span>
                <span>
                  하지만 <strong>너무 많은 캐릭터</strong>를 만들면 그림이
                  복잡해지고 헷갈려요. 이야기에 꼭 필요한 인물만 만들어요!
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Pillar 2 — Background / setting */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">2</span>
            이야기의 배경을 떠올려 봐!
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            <strong>르완다, 아프리카, 옛날 마을, 지금의 도시…</strong>
            <br />
            이야기가 펼쳐지는 곳이 어디인지 적어 줘야 어울리는 그림이 나와요.
          </p>

          {/* Recall reminder */}
          <div className="mb-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-4">
            <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
              <span>🔍</span> 이렇게 떠올려 봐요
            </p>
            <ul className="space-y-1.5 text-xs text-green-900 leading-relaxed">
              <li className="flex gap-1.5">
                <span className="text-green-500">•</span>
                <span><strong>그림책</strong>에서 봤던 풍경, 집, 옷, 음식</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-green-500">•</span>
                <span><strong>자료 탐색</strong>에서 본 사진과 영상</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-green-500">•</span>
                <span><strong>질문 만들기</strong>에서 알아 본 그 나라의 모습</span>
              </li>
            </ul>
          </div>

          {/* Example */}
          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;들판에서 놀고 있어요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-green-900">
                  &quot;타다오가 <strong>르완다의 붉은 흙길과 바나나 나무가 있는
                  들판</strong>에서 놀고 있어요.&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pillar 3 — Time and season */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">3</span>
            시간의 흐름과 계절도 생각해 봐!
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            아침과 저녁은 빛이 다르고, 봄과 겨울은 풍경이 달라요.
            <br />
            <strong>언제 일어나는 일</strong>인지 같이 적어 주면 그림이 훨씬
            살아나요.
          </p>

          {/* Time chips */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">⏰ 하루의 시간</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '🌅 이른 아침', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                { label: '🌞 한낮', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                { label: '🌇 노을 지는 저녁', color: 'bg-rose-100 text-rose-700 border-rose-200' },
                { label: '🌙 깜깜한 밤', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">🍃 사계절</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '🌸 봄', color: 'bg-pink-100 text-pink-700 border-pink-200' },
                { label: '☀️ 여름', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
                { label: '🍂 가을', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { label: '❄️ 겨울', color: 'bg-sky-100 text-sky-700 border-sky-200' },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 mb-2">📜 이야기 속 시대</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '🏛️ 옛날', color: 'bg-stone-100 text-stone-700 border-stone-200' },
                { label: '🏙️ 지금', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                { label: '👶 어린 시절', color: 'bg-violet-100 text-violet-700 border-violet-200' },
                { label: '🧓 어른이 된 후', color: 'bg-teal-100 text-teal-700 border-teal-200' },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}
                >
                  {label}
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
                <p className="text-sm text-gray-600">&quot;타다오가 강가에 앉아 있어요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-xs text-purple-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-purple-900">
                  &quot;<strong>이른 아침</strong>, 안개가 살짝 낀 <strong>봄날</strong>의
                  강가에 타다오가 앉아 있어요.&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Magic words */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">✨</span>
            마법 단어를 더 넣어 봐!
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            분위기와 표정을 살리는 단어들이에요.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { word: '밝은', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
              { word: '어두운', color: 'bg-slate-200 text-slate-700 border-slate-300' },
              { word: '따뜻한', color: 'bg-orange-100 text-orange-700 border-orange-200' },
              { word: '차가운', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
              { word: '웃고 있는', color: 'bg-pink-100 text-pink-700 border-pink-200' },
              { word: '울고 있는', color: 'bg-blue-100 text-blue-700 border-blue-200' },
              { word: '놀란 표정', color: 'bg-amber-100 text-amber-700 border-amber-200' },
              { word: '반짝이는', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
              { word: '평화로운', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
              { word: '쓸쓸한', color: 'bg-gray-200 text-gray-700 border-gray-300' },
              { word: '멀리서 본', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
              { word: '가까이에서 본', color: 'bg-violet-100 text-violet-700 border-violet-200' },
            ].map(({ word, color }) => (
              <span
                key={word}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}
              >
                {word}
              </span>
            ))}
          </div>
        </section>

        {/* Practice template */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">📝</span>
            이 틀을 따라 해 봐!
          </h2>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
            <p className="text-sm text-gray-700 leading-loose">
              <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium mr-1">[시간/계절]</span>
              에,
              <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium mx-1">[주인공 이름]</span>
              이/가
              <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium mx-1">[배경/장소]</span>
              에서
              <span className="inline-block px-2 py-0.5 rounded bg-pink-100 text-pink-700 text-xs font-medium mx-1">[표정/행동]</span>
              을/를 하고 있어요.
              <br />
              주변에는
              <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium mx-1">[배경 자세히]</span>
              이/가 있고,
              <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium mx-1">[분위기/색감]</span>
              느낌이에요.
            </p>
          </div>
          <div className="mt-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">완성 예시</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              &quot;<strong>노을이 지는 저녁</strong>, <strong>어린 타다오</strong>가
              <strong> 르완다 마을의 흙길 광장</strong>에서
              친구들과 손을 잡고 <strong>웃으며 춤을 추고</strong> 있어요.
              주변에는 <strong>흙벽돌 집들과 키 큰 야자수</strong>가 있고,
              <strong> 따뜻하고 평화로운</strong> 느낌이에요.&quot;
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            이제 돌아가서 내 이야기에 어울리는 장면을 설명해 보자!
          </p>
        </div>
      </div>
    </main>
  );
}
