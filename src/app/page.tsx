import { getHomeData } from '@/lib/home-data';
import HomeClient from '@/components/HomeClient';

// ISR: 每 30 秒重新生成, 减少数据库压力 + 边缘缓存
export const revalidate = 30;

export default async function HomePage() {
  const initial = await getHomeData();
  return <HomeClient initial={initial} />;
}
