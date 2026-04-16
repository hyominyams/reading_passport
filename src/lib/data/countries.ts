export interface Country {
  id: string;
  name: string;
  flag: string;
  region: string;
  image_url: string;
  description: string;
}

export const countries: Country[] = [
  {
    id: 'colombia',
    name: '콜롬비아',
    flag: '🇨🇴',
    region: 'south-america',
    image_url: '/images/countries/colombia.jpg',
    description: '커피와 음악의 나라',
  },
  {
    id: 'tanzania',
    name: '탄자니아',
    flag: '🇹🇿',
    region: 'africa',
    image_url: '/images/countries/tanzania.jpg',
    description: '킬리만자로의 나라',
  },
  {
    id: 'cambodia',
    name: '캄보디아',
    flag: '🇰🇭',
    region: 'asia',
    image_url: '/images/countries/cambodia.jpg',
    description: '앙코르와트의 나라',
  },
  {
    id: 'nepal',
    name: '네팔',
    flag: '🇳🇵',
    region: 'asia',
    image_url: '/images/countries/nepal.jpg',
    description: '히말라야의 나라',
  },
  {
    id: 'rwanda',
    name: '르완다',
    flag: '🇷🇼',
    region: 'africa',
    image_url: '/images/countries/rwanda.jpg',
    description: '천 개의 언덕 나라',
  },
  {
    id: 'kenya',
    name: '케냐',
    flag: '🇰🇪',
    region: 'africa',
    image_url: '/images/countries/kenya.jpg',
    description: '사파리의 나라',
  },
];
