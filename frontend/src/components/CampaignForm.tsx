import React, { useState } from 'react';
import { Rocket, Link2, Tag, MapPin } from 'lucide-react';

interface CampaignFormProps {
  onSubmit: (data: { name: string; niche: string; location: string; urls: string[] }) => void;
  isLoading: boolean;
  progress?: { current: number; total: number };
}

export const CampaignForm: React.FC<CampaignFormProps> = ({ onSubmit, isLoading, progress }) => {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('web_studios');
  const [location, setLocation] = useState('');
  const [urlsText, setUrlsText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)
      .map(u => u.startsWith('http') ? u : `https://${u}`);
    
    if (urls.length === 0) return;
    onSubmit({ name, niche, location, urls });
  };

  const niches = [
    { value: 'web_studios', label: 'Веб-студии' },
    { value: 'dentists', label: 'Стоматологии' },
    { value: 'restaurants', label: 'Рестораны' },
    { value: 'saas', label: 'SaaS компании' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'real_estate', label: 'Недвижимость' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название кампании</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например, SEO-аудит июль"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Ниша
          </label>
          <select
            value={niche}
            onChange={e => setNiche(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {niches.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Локация (опционально)
        </label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Москва, Россия"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Список URL (по одному на строку)
        </label>
        <textarea
          value={urlsText}
          onChange={e => setUrlsText(e.target.value)}
          placeholder="example.com&#10;site.ru&#10;https://company.org"
          required
          rows={6}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          {urlsText.split('\n').filter(u => u.trim()).length} URL загружено. Лимит: 100 за раз.
        </p>
      </div>

      {isLoading && progress && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-900">Обработка...</span>
            <span className="text-sm text-indigo-700">{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-indigo-600">
            Анализируем сайты и генерируем персонализированные письма. Не закрывайте страницу.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || urlsText.trim().length === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        <Rocket className="w-4 h-4" />
        {isLoading ? 'Обработка...' : 'Запустить кампанию'}
      </button>
    </form>
  );
};
