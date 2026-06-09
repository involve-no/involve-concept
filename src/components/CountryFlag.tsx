import React from 'react';
import { countryTranslations } from '@/lib/translations';

const countryToIso: Record<string, string> = {
  'mexico': 'mx',
  'south africa': 'za',
  'rep. of korea': 'kr',
  'south korea': 'kr',
  'czech rep.': 'cz',
  'czech republic': 'cz',
  'canada': 'ca',
  'bosnia/herzeg.': 'ba',
  'usa': 'us',
  'united states': 'us',
  'paraguay': 'py',
  'haiti': 'ht',
  'scotland': 'gb-sct',
  'australia': 'au',
  'turkey': 'tr',
  'brazil': 'br',
  'morocco': 'ma',
  'qatar': 'qa',
  'switzerland': 'ch',
  'ivory coast': 'ci',
  'germany': 'de',
  'curaçao': 'cw',
  'netherlands': 'nl',
  'japan': 'jp',
  'sweden': 'se',
  'tunisia': 'tn',
  'saudi arabia': 'sa',
  'uruguay': 'uy',
  'cape verde': 'cv',
  'ir iran': 'ir',
  'iran': 'ir',
  'new zealand': 'nz',
  'belgium': 'be',
  'egypt': 'eg',
  'france': 'fr',
  'iraq': 'iq',
  'norway': 'no',
  'argentina': 'ar',
  'algeria': 'dz',
  'jordan': 'jo',
  'ghana': 'gh',
  'panama': 'pa',
  'england': 'gb-eng',
  'croatia': 'hr',
  'portugal': 'pt',
  'dr congo': 'cd',
  'uzbekistan': 'uz',
  'colombia': 'co',
  'spain': 'es',
  'austria': 'at',
  'ecuador': 'ec',
  'senegal': 'sn'
};

interface CountryFlagProps {
  countryName: string;
  className?: string;
}

export default function CountryFlag({ countryName, className = 'w-10 h-10' }: CountryFlagProps) {
  const normalized = countryName.trim().toLowerCase();
  let isoCode = countryToIso[normalized];

  if (!isoCode) {
    // Try finding the English key for this Norwegian name
    const englishKey = Object.keys(countryTranslations).find(
      key => countryTranslations[key].toLowerCase() === normalized
    );
    if (englishKey) {
      isoCode = countryToIso[englishKey];
    }
  }

  if (!isoCode) {
    // Soccer ball placeholder for knockout brackets or TBD
    return (
      <div className={`${className} rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border border-white/10 flex items-center justify-center font-bold text-xs text-gray-400 select-none`}>
        ⚽
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full overflow-hidden border border-white/15 flex items-center justify-center bg-gray-900 shadow-md relative`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w80/${isoCode}.png`}
        alt={countryName}
        className="w-full h-full object-cover scale-110"
        loading="lazy"
      />
    </div>
  );
}
