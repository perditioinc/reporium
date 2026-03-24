'use client';

import { useState } from 'react';
import { TagMetrics, SortOption, Category, SkillStats, BuilderStats, TaxonomyValueOption } from '@/types/repo';

interface FilterBarProps {
  categories: Category[];
  languages: string[];
  allTags: string[];
  tagMetrics: TagMetrics[];
  selectedCategory: string;
  selectedType: 'all' | 'built' | 'forked';
  selectedLanguage: string;
  selectedTags: string[];
  selectedActivity: 'all' | 'active' | 'inactive';
  selectedSyncStatus: 'all' | 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged';
  sortBy: SortOption;
  filteredCount: number;
  onCategoryChange: (id: string) => void;
  onTypeChange: (v: 'all' | 'built' | 'forked') => void;
  onLanguageChange: (v: string) => void;
  onTagToggle: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  onActivityChange: (v: 'all' | 'active' | 'inactive') => void;
  onSyncStatusChange: (v: 'all' | 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged') => void;
  onSortChange: (v: SortOption) => void;
  onClear: () => void;
  // NEW taxonomy props
  aiDevSkillStats?: SkillStats[];
  pmSkillStats?: SkillStats[];
  builderStats?: BuilderStats[];
  selectedAiDevSkills?: string[];
  selectedPmSkills?: string[];
  selectedIndustries?: string[];
  selectedBuilders?: string[];
  onAiDevSkillToggle?: (skill: string) => void;
  onPmSkillToggle?: (skill: string) => void;
  onIndustryToggle?: (industry: string) => void;
  onBuilderToggle?: (builder: string) => void;
  industryStats?: { industry: string; count: number }[];
  languageCounts?: Map<string, number>;
  aiTrendValues?: TaxonomyValueOption[];
  industryValues?: TaxonomyValueOption[];
  useCaseValues?: TaxonomyValueOption[];
  modalityValues?: TaxonomyValueOption[];
  deploymentContextValues?: TaxonomyValueOption[];
  selectedAiTrends?: string[];
  selectedUseCases?: string[];
  selectedModalities?: string[];
  selectedDeploymentContexts?: string[];
  onAiTrendToggle?: (value: string) => void;
  onUseCaseToggle?: (value: string) => void;
  onModalityToggle?: (value: string) => void;
  onDeploymentContextToggle?: (value: string) => void;
}

/** Activity indicator dot based on score */
function ActivityDot({ score }: { score: number }) {
  const color = score > 60 ? 'bg-emerald-400' : score > 30 ? 'bg-amber-400' : 'bg-zinc-600';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} mr-1.5 shrink-0`} />;
}

const SORT_LABELS: Record<SortOption, string> = {
  updated: 'Recently Updated',
  stars: 'Parent Stars ↓',
  tags: 'Most Tags',
  alpha: 'A → Z',
  oldest: 'Oldest First',
  'most-outdated': 'Most Outdated',
  'upstream-updated': 'Upstream Updated',
  'fork-oldest': 'Forked: Oldest',
  'fork-newest': 'Forked: Newest',
};

type TabId =
  | 'categories'
  | 'ai-trends'
  | 'industries'
  | 'use-cases'
  | 'modalities'
  | 'deployment-context'
  | 'ai-dev-skills'
  | 'pm-skills'
  | 'builders'
  | 'languages';

/** Filter and sort controls for the repo library */
export function FilterBar({
  categories,
  languages,
  allTags,
  tagMetrics,
  selectedCategory,
  selectedType,
  selectedLanguage,
  selectedTags,
  selectedActivity,
  selectedSyncStatus,
  sortBy,
  filteredCount,
  onCategoryChange,
  onTypeChange,
  onLanguageChange,
  onTagToggle,
  onTagRemove,
  onActivityChange,
  onSyncStatusChange,
  onSortChange,
  onClear,
  aiDevSkillStats = [],
  pmSkillStats = [],
  builderStats = [],
  selectedAiDevSkills = [],
  selectedPmSkills = [],
  selectedIndustries = [],
  selectedBuilders = [],
  selectedAiTrends = [],
  selectedUseCases = [],
  selectedModalities = [],
  selectedDeploymentContexts = [],
  onAiDevSkillToggle,
  onPmSkillToggle,
  onIndustryToggle,
  onBuilderToggle,
  industryStats,
  languageCounts,
  aiTrendValues = [],
  industryValues = [],
  useCaseValues = [],
  modalityValues = [],
  deploymentContextValues = [],
  onAiTrendToggle,
  onUseCaseToggle,
  onModalityToggle,
  onDeploymentContextToggle,
}: FilterBarProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('categories');

  const tagMetricsMap = new Map(tagMetrics.map((m) => [m.tag, m]));

  // Determine which tags to show in tag row (used in categories tab)
  const selectedCat = categories.find(c => c.id === selectedCategory);
  const tagsToShow: string[] = selectedCat
    ? allTags.filter(t => selectedCat.tags.includes(t))
    : [...allTags].sort((a, b) => {
        const ca = tagMetricsMap.get(a)?.repoCount ?? 0;
        const cb = tagMetricsMap.get(b)?.repoCount ?? 0;
        return cb - ca;
      });

  const visibleTags = showAllTags ? tagsToShow : tagsToShow.slice(0, 20);

  // Active filters for the active filter bar
  const hasActiveFilters =
    selectedCategory !== '' ||
    selectedType !== 'all' ||
    selectedLanguage !== '' ||
    selectedTags.length > 0 ||
    selectedActivity !== 'all' ||
    selectedSyncStatus !== 'all' ||
    selectedAiTrends.length > 0 ||
    selectedAiDevSkills.length > 0 ||
    selectedPmSkills.length > 0 ||
    selectedIndustries.length > 0 ||
    selectedUseCases.length > 0 ||
    selectedModalities.length > 0 ||
    selectedDeploymentContexts.length > 0 ||
    selectedBuilders.length > 0;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'categories', label: 'Categories' },
    { id: 'ai-trends', label: 'AI Trends' },
    { id: 'industries', label: 'Industries' },
    { id: 'use-cases', label: 'Use Cases' },
    { id: 'modalities', label: 'Modalities' },
    { id: 'deployment-context', label: 'Deployment' },
    { id: 'ai-dev-skills', label: 'AI Dev Skills' },
    { id: 'pm-skills', label: 'PM Skills' },
    { id: 'builders', label: 'Builders' },
    { id: 'languages', label: 'Languages' },
  ];

  // Group builders by category
  const buildersByCategory = new Map<string, BuilderStats[]>();
  for (const b of builderStats) {
    const cat = b.category;
    if (!buildersByCategory.has(cat)) buildersByCategory.set(cat, []);
    buildersByCategory.get(cat)!.push(b);
  }
  const categoryOrder = ['big-tech', 'ai-lab', 'startup', 'research', 'individual'];
  const categoryLabels: Record<string, string> = {
    'big-tech': 'Big Tech',
    'ai-lab': 'AI Labs',
    'startup': 'Startups',
    'research': 'Research',
    'individual': 'Individual',
  };

  return (
    <div className="space-y-2">
      {/* ── Active Filter Bar ── appears only when filters are active */}
      {hasActiveFilters && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-2.5">
          <span className="text-xs font-medium text-zinc-400 shrink-0">Filters:</span>
          {/* Category pill */}
          {selectedCat && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: selectedCat.color + '33', color: selectedCat.color, border: `1px solid ${selectedCat.color}66` }}
            >
              {selectedCat.icon} {selectedCat.name}
              <button
                onClick={() => onCategoryChange('')}
                className="ml-1 hover:opacity-70 transition-opacity"
                aria-label={`Remove ${selectedCat.name} filter`}
              >
                ×
              </button>
            </span>
          )}
          {/* Tag pills */}
          {selectedTags.map(tag => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-600/30 border border-blue-600/50 px-2.5 py-1 text-xs font-medium text-blue-300">
              {tag}
              <button
                onClick={() => onTagRemove(tag)}
                className="ml-1 hover:opacity-70 transition-opacity"
                aria-label={`Remove ${tag} filter`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedAiTrends.map(trend => (
            <span key={trend} className="flex items-center gap-1 rounded-full bg-sky-900/30 border border-sky-700/50 px-2.5 py-1 text-xs font-medium text-sky-300">
              {trend}
              <button onClick={() => onAiTrendToggle?.(trend)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {/* AI Dev Skill pills */}
          {selectedAiDevSkills.map(skill => (
            <span key={skill} className="flex items-center gap-1 rounded-full bg-emerald-900/30 border border-emerald-700/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
              {skill}
              <button onClick={() => onAiDevSkillToggle?.(skill)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {/* PM Skill pills */}
          {selectedPmSkills.map(skill => (
            <span key={skill} className="flex items-center gap-1 rounded-full bg-purple-900/30 border border-purple-700/50 px-2.5 py-1 text-xs font-medium text-purple-300">
              {skill}
              <button onClick={() => onPmSkillToggle?.(skill)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {/* Industry pills */}
          {selectedIndustries.map(ind => (
            <span key={ind} className="flex items-center gap-1 rounded-full bg-amber-900/30 border border-amber-700/50 px-2.5 py-1 text-xs font-medium text-amber-300">
              {ind}
              <button onClick={() => onIndustryToggle?.(ind)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {selectedUseCases.map(value => (
            <span key={value} className="flex items-center gap-1 rounded-full bg-fuchsia-900/30 border border-fuchsia-700/50 px-2.5 py-1 text-xs font-medium text-fuchsia-300">
              {value}
              <button onClick={() => onUseCaseToggle?.(value)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {selectedModalities.map(value => (
            <span key={value} className="flex items-center gap-1 rounded-full bg-teal-900/30 border border-teal-700/50 px-2.5 py-1 text-xs font-medium text-teal-300">
              {value}
              <button onClick={() => onModalityToggle?.(value)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {selectedDeploymentContexts.map(value => (
            <span key={value} className="flex items-center gap-1 rounded-full bg-orange-900/30 border border-orange-700/50 px-2.5 py-1 text-xs font-medium text-orange-300">
              {value}
              <button onClick={() => onDeploymentContextToggle?.(value)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {/* Builder pills */}
          {selectedBuilders.map(builder => (
            <span key={builder} className="flex items-center gap-1 rounded-full bg-cyan-900/30 border border-cyan-700/50 px-2.5 py-1 text-xs font-medium text-cyan-300">
              {builder}
              <button onClick={() => onBuilderToggle?.(builder)} className="ml-1 hover:opacity-70">×</button>
            </span>
          ))}
          {/* Other active filters */}
          {selectedType !== 'all' && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-700/50 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">
              {selectedType}
              <button onClick={() => onTypeChange('all')} className="ml-1 hover:opacity-70">×</button>
            </span>
          )}
          {selectedLanguage && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-700/50 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">
              {selectedLanguage}
              <button onClick={() => onLanguageChange('')} className="ml-1 hover:opacity-70">×</button>
            </span>
          )}
          {selectedActivity !== 'all' && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-700/50 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">
              {selectedActivity}
              <button onClick={() => onActivityChange('all')} className="ml-1 hover:opacity-70">×</button>
            </span>
          )}
          {selectedSyncStatus !== 'all' && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-700/50 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">
              {selectedSyncStatus}
              <button onClick={() => onSyncStatusChange('all')} className="ml-1 hover:opacity-70">×</button>
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-500">{filteredCount} repos matching</span>
          <button
            onClick={onClear}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Main filter panel ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-zinc-800 pb-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Categories tab */}
        {activeTab === 'categories' && (
          <>
            <div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onCategoryChange('')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === '' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All
                </button>
                {categories.filter(c => c.repoCount > 0).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(selectedCategory === cat.id ? '' : cat.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      selectedCategory === cat.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    style={selectedCategory === cat.id
                      ? { backgroundColor: cat.color + '33', color: cat.color, border: `1px solid ${cat.color}66` }
                      : {}}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span className={selectedCategory === cat.id ? 'opacity-70' : 'text-zinc-600'}>{cat.repoCount}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags row */}
            <div>
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2">
                {selectedCat ? `${selectedCat.name} Tags` : 'Top Tags'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map((tag) => {
                  const m = tagMetricsMap.get(tag);
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onTagToggle(tag)}
                      className={`flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {m && <ActivityDot score={m.activityScore} />}
                      {tag}
                      {m && (
                        <span className={`ml-1.5 ${isSelected ? 'text-blue-200' : 'text-zinc-600'}`}>
                          {m.repoCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                {tagsToShow.length > 20 && (
                  <button
                    onClick={() => setShowAllTags(v => !v)}
                    className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showAllTags ? 'Show less' : `+${tagsToShow.length - 20} more`}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'ai-trends' && (
          <div className="flex flex-wrap gap-1.5">
            {aiTrendValues.map((value) => {
              const isSelected = selectedAiTrends.includes(value.name);
              return (
                <button
                  key={value.id}
                  onClick={() => onAiTrendToggle?.(value.name)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-sky-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{value.name}</span>
                  <span className={isSelected ? 'text-sky-200' : 'text-zinc-600'}>{value.repo_count}</span>
                </button>
              );
            })}
            {aiTrendValues.length === 0 && (
              <p className="text-xs text-zinc-600">No AI trend values returned by the taxonomy API.</p>
            )}
          </div>
        )}

        {/* AI Dev Skills tab */}
        {activeTab === 'ai-dev-skills' && (
          <div className="flex flex-wrap gap-1.5">
            {aiDevSkillStats.map(stat => {
              const isSelected = selectedAiDevSkills.includes(stat.skill);
              const icon = stat.repoCount >= 10 ? '✅' : stat.repoCount >= 3 ? '⚠️' : '❌';
              return (
                <button
                  key={stat.skill}
                  onClick={() => onAiDevSkillToggle?.(stat.skill)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{stat.skill}</span>
                  <span className={isSelected ? 'text-emerald-200' : 'text-zinc-600'}>{stat.repoCount}</span>
                </button>
              );
            })}
            {aiDevSkillStats.length === 0 && (
              <p className="text-xs text-zinc-600">No AI dev skill data. Run npm run generate.</p>
            )}
          </div>
        )}

        {/* PM Skills tab */}
        {activeTab === 'pm-skills' && (
          <div className="flex flex-wrap gap-1.5">
            {pmSkillStats.map(stat => {
              const isSelected = selectedPmSkills.includes(stat.skill);
              return (
                <button
                  key={stat.skill}
                  onClick={() => onPmSkillToggle?.(stat.skill)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-purple-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{stat.skill}</span>
                  <span className={isSelected ? 'text-purple-200' : 'text-zinc-600'}>{stat.repoCount}</span>
                </button>
              );
            })}
            {pmSkillStats.length === 0 && (
              <p className="text-xs text-zinc-600">No PM skill data. Run npm run generate.</p>
            )}
          </div>
        )}

        {/* Industries tab */}
        {activeTab === 'industries' && (
          <div className="flex flex-wrap gap-1.5">
            {(industryValues.length > 0
              ? industryValues.map(value => ({ industry: value.name, count: value.repo_count, id: value.id }))
              : (industryStats ?? []).map(({ industry, count }, index) => ({ industry, count, id: index + 1 }))
            ).map(({ industry: ind, count, id }) => {
              const isSelected = selectedIndustries.includes(ind);
              return (
                <button
                  key={id}
                  onClick={() => onIndustryToggle?.(ind)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{ind}</span>
                  <span className={isSelected ? 'text-amber-200' : 'text-zinc-600'}>{count}</span>
                </button>
              );
            })}
            {industryValues.length === 0 && (!industryStats || industryStats.length === 0) && (
              <p className="text-xs text-zinc-600">No industry values returned by the taxonomy API.</p>
            )}
          </div>
        )}

        {activeTab === 'use-cases' && (
          <div className="flex flex-wrap gap-1.5">
            {useCaseValues.map((value) => {
              const isSelected = selectedUseCases.includes(value.name);
              return (
                <button
                  key={value.id}
                  onClick={() => onUseCaseToggle?.(value.name)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-fuchsia-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{value.name}</span>
                  <span className={isSelected ? 'text-fuchsia-200' : 'text-zinc-600'}>{value.repo_count}</span>
                </button>
              );
            })}
            {useCaseValues.length === 0 && (
              <p className="text-xs text-zinc-600">No use case values returned by the taxonomy API.</p>
            )}
          </div>
        )}

        {activeTab === 'modalities' && (
          <div className="flex flex-wrap gap-1.5">
            {modalityValues.map((value) => {
              const isSelected = selectedModalities.includes(value.name);
              return (
                <button
                  key={value.id}
                  onClick={() => onModalityToggle?.(value.name)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-teal-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{value.name}</span>
                  <span className={isSelected ? 'text-teal-200' : 'text-zinc-600'}>{value.repo_count}</span>
                </button>
              );
            })}
            {modalityValues.length === 0 && (
              <p className="text-xs text-zinc-600">No modality values returned by the taxonomy API.</p>
            )}
          </div>
        )}

        {activeTab === 'deployment-context' && (
          <div className="flex flex-wrap gap-1.5">
            {deploymentContextValues.map((value) => {
              const isSelected = selectedDeploymentContexts.includes(value.name);
              return (
                <button
                  key={value.id}
                  onClick={() => onDeploymentContextToggle?.(value.name)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{value.name}</span>
                  <span className={isSelected ? 'text-orange-200' : 'text-zinc-600'}>{value.repo_count}</span>
                </button>
              );
            })}
            {deploymentContextValues.length === 0 && (
              <p className="text-xs text-zinc-600">No deployment context values returned by the taxonomy API.</p>
            )}
          </div>
        )}

        {/* Builders tab */}
        {activeTab === 'builders' && (
          <div className="space-y-3">
            {categoryOrder.map(cat => {
              const group = buildersByCategory.get(cat) ?? [];
              if (group.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-1.5">{categoryLabels[cat]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.map(b => {
                      const isSelected = selectedBuilders.includes(b.login);
                      return (
                        <button
                          key={b.login}
                          onClick={() => onBuilderToggle?.(b.login)}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            isSelected ? 'bg-cyan-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.avatarUrl} alt={b.displayName} className="w-3.5 h-3.5 rounded-full" />
                          <span>{b.displayName}</span>
                          <span className={isSelected ? 'text-cyan-200' : 'text-zinc-600'}>{b.repoCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {builderStats.length === 0 && (
              <p className="text-xs text-zinc-600">No builder data. Run npm run generate.</p>
            )}
          </div>
        )}

        {/* Languages tab */}
        {activeTab === 'languages' && (
          <div className="flex flex-wrap gap-1.5">
            {languages.map(lang => {
              const isSelected = selectedLanguage === lang;
              const count = languageCounts?.get(lang);
              return (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(isSelected ? '' : lang)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{lang}</span>
                  {count !== undefined && (
                    <span className={isSelected ? 'text-zinc-200' : 'text-zinc-600'}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800">
          {/* Type filter */}
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
            {(['all', 'built', 'forked'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onTypeChange(type)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  selectedType === type ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <select
            value={selectedActivity}
            onChange={(e) => onActivityChange(e.target.value as 'all' | 'active' | 'inactive')}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="all">All Activity</option>
            <option value="active">Active (30d)</option>
            <option value="inactive">Inactive (1y+)</option>
          </select>

          <select
            value={selectedSyncStatus}
            onChange={(e) => onSyncStatusChange(e.target.value as typeof selectedSyncStatus)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="all">All Sync States</option>
            <option value="up-to-date">Up to date</option>
            <option value="behind">Behind (any)</option>
            <option value="behind-100">Behind 100+ commits</option>
            <option value="ahead">Ahead</option>
            <option value="diverged">Diverged</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
