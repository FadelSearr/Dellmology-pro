import { filterByPrice } from '../intelligence/AIScreener';

describe('AIScreener helper functions', () => {
  it('filterByPrice excludes results outside range', () => {
    const sample = [
      { symbol: 'A', price: 100 } as any,
      { symbol: 'B', price: 500 } as any,
      { symbol: 'C', price: 1000 } as any,
    ];
    const filtered = filterByPrice(sample, { min: 200, max: 800 });
    expect(filtered.map((r) => r.symbol)).toEqual(['B']);
  });
});
