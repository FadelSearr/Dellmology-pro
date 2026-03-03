import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface NewsImpactItem {
  title: string;
  score: number;
  red_flags: string[];
}

interface NewsImpactResponse {
  success: boolean;
  symbol: string;
  stress_score: number;
  penalty_ups: number;
  risk_label: 'LOW' | 'MEDIUM' | 'HIGH';
  red_flags: string[];
  sampled_headlines: NewsImpactItem[];
  checked_at: string;
}

const POSITIVE_WORDS = ['growth', 'record profit', 'expansion', 'upgrade', 'outperform', 'optimism', 'rebound', 'strong demand'];
const NEGATIVE_WORDS = [
  'default',
  'gagal bayar',
  'fraud',
  'lawsuit',
  'suspend',
  'suspensi',
  'audit issue',
  'restatement',
  'bankrupt',
  'investigation',
  'legal risk',
  'debt stress',
  'restructuring',
  'downgrade',
];

const RED_FLAG_KEYWORDS: Array<{ keyword: string; label: string; weight: number }> = [
  { keyword: 'gagal bayar', label: 'Riwayat gagal bayar', weight: 25 },
  { keyword: 'default', label: 'Default risk', weight: 25 },
  { keyword: 'fraud', label: 'Fraud allegation', weight: 30 },
  { keyword: 'lawsuit', label: 'Legal dispute', weight: 18 },
  { keyword: 'investigation', label: 'Regulatory investigation', weight: 18 },
  { keyword: 'suspensi', label: 'Suspension risk', weight: 20 },
  { keyword: 'suspend', label: 'Suspension risk', weight: 20 },
  { keyword: 'restatement', label: 'Financial restatement risk', weight: 20 },
  { keyword: 'audit issue', label: 'Audit quality concern', weight: 16 },
  { keyword: 'bankrupt', label: 'Bankruptcy risk', weight: 30 },
  { keyword: 'debt stress', label: 'Debt stress signal', weight: 16 },
  { keyword: 'restructuring', label: 'Restructuring pressure', weight: 12 },
  { keyword: 'downgrade', label: 'Credit downgrade signal', weight: 12 },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();

    const query = encodeURIComponent(`${symbol} Indonesia stock IDX company news`);
    const response = await fetch(`https://news.google.com/rss/search?q=${query}`, {
      headers: {
        'User-Agent': 'Dellmology-Pro/1.0',
        Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        fallbackPayload(symbol, 'RSS unavailable'),
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        },
      );
    }

    const rss = (await response.text()).toLowerCase();
    const titles = Array.from(rss.matchAll(/<title><!\[cdata\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g))
      .map((match) => (match[1] || match[2] || '').trim())
      .filter((title) => title.length > 0 && !title.includes('google news'))
      .slice(0, 25);

    if (titles.length === 0) {
      return NextResponse.json(fallbackPayload(symbol, 'No headlines found'), {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    const sampled: NewsImpactItem[] = [];
    const redFlagBag = new Set<string>();
    let aggregateScore = 0;

    for (const title of titles) {
      let score = 0;
      const itemFlags: string[] = [];

      for (const word of POSITIVE_WORDS) {
        if (title.includes(word)) {
          score -= 3;
        }
      }

      for (const word of NEGATIVE_WORDS) {
        if (title.includes(word)) {
          score += 5;
        }
      }

      for (const marker of RED_FLAG_KEYWORDS) {
        if (title.includes(marker.keyword)) {
          score += marker.weight;
          itemFlags.push(marker.label);
          redFlagBag.add(marker.label);
        }
      }

      aggregateScore += score;
      sampled.push({
        title,
        score,
        red_flags: itemFlags,
      });
    }

    const averageScore = aggregateScore / Math.max(1, sampled.length);
    const stressScore = Math.max(0, Math.min(100, Number(averageScore.toFixed(2))));
    const penaltyUps = stressScore >= 60 ? 25 : stressScore >= 35 ? 12 : stressScore >= 20 ? 6 : 0;
    const riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' = stressScore >= 60 ? 'HIGH' : stressScore >= 30 ? 'MEDIUM' : 'LOW';

    const payload: NewsImpactResponse = {
      success: true,
      symbol,
      stress_score: stressScore,
      penalty_ups: penaltyUps,
      risk_label: riskLabel,
      red_flags: Array.from(redFlagBag).slice(0, 6),
      sampled_headlines: sampled.slice(0, 10),
      checked_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('news-impact GET failed:', error);
    return NextResponse.json(fallbackPayload('BBCA', 'Internal failure'), {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90',
      },
    });
  }
}

function fallbackPayload(symbol: string, reason: string): NewsImpactResponse {
  return {
    success: false,
    symbol,
    stress_score: 0,
    penalty_ups: 0,
    risk_label: 'LOW',
    red_flags: reason ? [reason] : [],
    sampled_headlines: [],
    checked_at: new Date().toISOString(),
  };
}
