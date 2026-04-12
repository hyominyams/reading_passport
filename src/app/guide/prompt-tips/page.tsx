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
            내 이야기에 어울리는 그림을 만들기 위한 장면 설명 꿀팁
          </p>
        </div>

        {/* Core concept */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">1</span>
            세 가지만 기억해!
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
              <span className="text-2xl block mb-1">👤</span>
              <p className="text-sm font-bold text-blue-700 mb-1">누가</p>
              <p className="text-xs text-blue-600">어떤 사람이나 동물이<br />그림에 나올까?</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
              <span className="text-2xl block mb-1">🌄</span>
              <p className="text-sm font-bold text-green-700 mb-1">어디서</p>
              <p className="text-xs text-green-600">어떤 장소에서<br />이야기가 펼쳐질까?</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-center">
              <span className="text-2xl block mb-1">🎭</span>
              <p className="text-sm font-bold text-purple-700 mb-1">어떻게</p>
              <p className="text-xs text-purple-600">어떤 행동, 표정,<br />분위기일까?</p>
            </div>
          </div>
        </section>

        {/* Good vs Bad examples */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">2</span>
            이렇게 달라져!
          </h2>

          {/* Example 1 */}
          <div className="mb-5">
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;아이가 걷고 있어요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-amber-900">
                  &quot;갈색 머리 소녀가 <strong>노을이 지는 시골길</strong>을 <strong>웃으면서</strong> 걷고 있어요. 길 양쪽에 <strong>노란 꽃</strong>이 피어 있어요.&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Example 2 */}
          <div className="mb-5">
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;밤이에요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-amber-900">
                  &quot;<strong>별이 반짝이는 깜깜한 밤</strong>하늘 아래, 작은 오두막에서 <strong>따뜻한 불빛</strong>이 새어 나오고 있어요.&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Example 3 */}
          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex-shrink-0 text-base mt-0.5">😐</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-xs text-gray-400 font-medium mb-0.5">아쉬운 설명</p>
                <p className="text-sm text-gray-600">&quot;슬퍼요&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3 ml-6">
              <span className="flex-shrink-0 text-base mt-0.5">🌟</span>
              <div className="flex-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-500 font-medium mb-0.5">좋은 설명</p>
                <p className="text-sm text-amber-900">
                  &quot;소년이 <strong>비가 내리는 창가</strong>에 앉아서 <strong>눈물을 글썽이며</strong> 멀리 바라보고 있어요. <strong>회색빛 하늘</strong>이에요.&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Magic words */}
        <section className="bg-white rounded-2xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">3</span>
            마법 단어를 넣어 봐!
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            이 단어들을 설명에 넣으면 그림이 훨씬 생생해져요.
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
              { word: '깜깜한', color: 'bg-gray-200 text-gray-700 border-gray-300' },
              { word: '넓은', color: 'bg-green-100 text-green-700 border-green-200' },
              { word: '좁은', color: 'bg-rose-100 text-rose-700 border-rose-200' },
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
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">4</span>
            이 틀을 따라 해 봐!
          </h2>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
            <p className="text-sm text-gray-700 leading-loose">
              <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium mr-1">[누가]</span>
              가/이
              <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium mx-1">[어디서]</span>
              에서
              <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium mx-1">[어떤 표정/행동]</span>
              을/를 하고 있어요.
              <br />
              주변에는
              <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium mx-1">[배경 설명]</span>
              이/가 있고,
              <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium mx-1">[분위기/색감]</span>
              느낌이에요.
            </p>
          </div>
          <div className="mt-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">완성 예시</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              &quot;<strong>검은 고양이</strong>가 <strong>비가 오는 시장 골목</strong>에서 <strong>몸을 웅크리고</strong> 있어요. 주변에는 <strong>젖은 나무 상자</strong>들이 있고, <strong>어둡고 쓸쓸한</strong> 느낌이에요.&quot;
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            이제 돌아가서 내 이야기에 맞는 장면을 설명해 보자!
          </p>
        </div>
      </div>
    </main>
  );
}
