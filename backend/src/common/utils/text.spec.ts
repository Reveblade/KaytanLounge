import { normalizePhone, pickText, slugify, ticketCode } from './text';

describe('slugify', () => {
  it('folds Turkish letters instead of dropping them', () => {
    expect(slugify('Süleymaniye Camii')).toBe('suleymaniye-camii');
    expect(slugify('Mısır Çarşısı')).toBe('misir-carsisi');
    expect(slugify('Başka İstanbul Yok')).toBe('baska-istanbul-yok');
    expect(slugify('Kız Kulesi')).toBe('kiz-kulesi');
  });

  it('trims separators and collapses punctuation', () => {
    expect(slugify('  Green Corner  ')).toBe('green-corner');
    expect(slugify("Çiçek Pasajı / Beyoğlu")).toBe('cicek-pasaji-beyoglu');
  });
});

describe('pickText', () => {
  it('falls back English then Turkish then anything present', () => {
    expect(pickText({ tr: 'Ayasofya', en: 'Hagia Sophia' }, 'tr')).toBe('Ayasofya');
    expect(pickText({ tr: 'Ayasofya', en: 'Hagia Sophia' }, 'de')).toBe('Hagia Sophia');
    expect(pickText({ tr: 'Ayasofya' }, 'de')).toBe('Ayasofya');
    expect(pickText({ ru: 'Айя-София' }, 'en')).toBe('Айя-София');
    expect(pickText(undefined, 'en')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('puts Turkish numbers into E.164', () => {
    expect(normalizePhone('0532 000 00 01')).toBe('+905320000001');
    expect(normalizePhone('532 000 00 01')).toBe('+905320000001');
    expect(normalizePhone('+90 532 000 00 01')).toBe('+905320000001');
    expect(normalizePhone('0090 532 000 00 01')).toBe('+905320000001');
  });

  it('leaves an international number alone', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });
});

describe('ticketCode', () => {
  it('uses an alphabet without look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = ticketCode();
      expect(code).toMatch(/^BIY-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('does not repeat across a large sample', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => ticketCode()));
    expect(seen.size).toBe(2000);
  });
});
