-- ============================================================
-- Seed: 탄자니아 Hidden Stories 더미 데이터
-- 실행: supabase db에서 수동 실행
-- 주의: book_id는 실제 탄자니아 책이 등록된 후 해당 ID로 교체 필요
-- ============================================================

-- 탄자니아 Hidden Stories (book_id, created_by는 실제 값으로 교체)
-- INSERT INTO hidden_content (book_id, country_id, type, title, url, "order", created_by, scope, approved)
-- VALUES
--   ('BOOK_UUID', 'tanzania', 'link', '킬리만자로: 아프리카의 지붕', 'https://ko.wikipedia.org/wiki/킬리만자로산', 1, 'ADMIN_UUID', 'global', true),
--   ('BOOK_UUID', 'tanzania', 'link', '마사이족의 전통 문화', 'https://ko.wikipedia.org/wiki/마사이족', 2, 'ADMIN_UUID', 'global', true),
--   ('BOOK_UUID', 'tanzania', 'link', '세렝게티 국립공원', 'https://ko.wikipedia.org/wiki/세렝게티_국립공원', 3, 'ADMIN_UUID', 'global', true),
--   ('BOOK_UUID', 'tanzania', 'link', '탄자니아의 음식 문화', 'https://ko.wikipedia.org/wiki/탄자니아_요리', 4, 'ADMIN_UUID', 'global', true),
--   ('BOOK_UUID', 'tanzania', 'image', '탄자니아 전통 의상 틴가틴가', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Tingatinga_painting.jpg/640px-Tingatinga_painting.jpg', 5, 'ADMIN_UUID', 'global', true),
--   ('BOOK_UUID', 'tanzania', 'link', '스와힐리어로 인사하기', 'https://ko.wikipedia.org/wiki/스와힐리어', 6, 'ADMIN_UUID', 'global', true);

-- ============================================================
-- 탄자니아 세계 상식 (country_facts - 제작 대기 화면용)
-- ============================================================
INSERT INTO country_facts (country_id, fact_text, fact_text_en, "order")
VALUES
  ('tanzania', '탄자니아의 킬리만자로산은 아프리카에서 가장 높은 산이에요. 높이가 무려 5,895m나 됩니다!', 'Mount Kilimanjaro in Tanzania is the tallest mountain in Africa at 5,895m!', 1),
  ('tanzania', '탄자니아에서는 스와힐리어를 써요. "잠보(Jambo)"는 "안녕"이라는 뜻이에요.', 'In Tanzania, people speak Swahili. "Jambo" means "Hello"!', 2),
  ('tanzania', '마사이족은 소의 수로 부자인지 아닌지를 판단해요. 소가 많을수록 부자랍니다!', 'The Maasai people measure wealth by how many cattle they own!', 3),
  ('tanzania', '세렝게티에서는 매년 150만 마리의 누가 대이동을 해요. 세계에서 가장 큰 동물 이동이에요!', 'Every year, 1.5 million wildebeest migrate across the Serengeti - the biggest animal migration on Earth!', 4),
  ('tanzania', '탄자니아에는 "틴가틴가"라는 독특한 그림 스타일이 있어요. 밝은 색으로 동물을 그리는 거예요!', 'Tanzania has a unique art style called "Tingatinga" - bright, colorful paintings of animals!', 5),
  ('tanzania', '탄자니아 잔지바르 섬은 향신료의 섬이라고 불려요. 정향, 계피, 바닐라가 자라요!', 'Zanzibar island in Tanzania is called the "Spice Island" - cloves, cinnamon, and vanilla grow there!', 6),
  ('tanzania', '탄자니아의 올두바이 협곡에서 가장 오래된 인류 화석이 발견되었어요. 175만 년 전이에요!', 'The oldest human fossils were found in Tanzania''s Olduvai Gorge - 1.75 million years old!', 7),
  ('tanzania', '마사이족 아이들은 사자 울음소리를 듣고 자라요. 마을 바로 옆에 야생동물이 살거든요!', 'Maasai children grow up hearing lion roars - wild animals live right next to their villages!', 8),
  ('tanzania', '탄자니아 사람들은 식사할 때 오른손만 사용해요. 왼손을 쓰는 건 예의에 어긋난대요!', 'In Tanzania, people eat with their right hand only. Using the left hand is considered impolite!', 9),
  ('tanzania', '탄자니아 국기의 초록색은 자연, 파란색은 바다, 노란색은 광물, 검정색은 사람들을 뜻해요!', 'Tanzania''s flag colors mean: green=nature, blue=ocean, yellow=minerals, black=people!', 10);

-- ============================================================
-- 다른 나라 세계 상식 (범용)
-- ============================================================
INSERT INTO country_facts (country_id, fact_text, fact_text_en, "order")
VALUES
  ('colombia', '콜롬비아의 와유족은 모칠라라는 전통 가방을 직접 짜요. 하나 만드는 데 한 달이 걸린대요!', 'The Wayuu people of Colombia weave traditional bags called mochilas. One bag takes a month to make!', 1),
  ('colombia', '콜롬비아는 세계에서 에메랄드를 가장 많이 생산하는 나라예요!', 'Colombia produces more emeralds than any other country in the world!', 2),
  ('colombia', '콜롬비아에는 무지개 강이라고 불리는 카뇨 크리스탈레스가 있어요. 물속 식물 때문에 강물이 다섯 가지 색으로 빛나요!', 'Colombia has the "Rainbow River" called Cano Cristales - aquatic plants make the water glow in five colors!', 3),
  ('kenya', '케냐에서는 차(tea)를 아주 많이 마셔요. 세계에서 3번째로 차를 많이 생산하는 나라예요!', 'Kenya drinks a LOT of tea - it''s the 3rd largest tea producer in the world!', 1),
  ('kenya', '케냐의 수도 나이로비에는 도시 안에 국립공원이 있어요. 빌딩 뒤로 기린이 걸어다녀요!', 'Nairobi, Kenya''s capital, has a national park inside the city - you can see giraffes walking behind buildings!', 2),
  ('cambodia', '캄보디아의 앙코르와트는 세계에서 가장 큰 종교 건축물이에요. 국기에도 그려져 있어요!', 'Angkor Wat in Cambodia is the largest religious monument in the world - it''s even on their flag!', 1);
